var spawn = require('child_process').spawn;
var fs = require('fs-extra');
var config = require('../config');
var command = config.kcc.command;
var environment = config.kcc.environment;
var additionalOptions = config.kcc.options;
var keePub = config.kcc.keePub;
var kindlegen = config.kcc.kindlegen;


function parseKccOut(data, progressHandler){
	var match = /\s([0-9][0-9]+)\./.exec(data);
	if(match && progressHandler){
		var currentPage = parseInt(match[1], 10);
		progressHandler.processedPages = currentPage;
		progressHandler.sendProgress('kcc');
	}
	console.log((new Date()).toString() + ' -- ' + data.toString());
}

function parseMobiOut(data, progressHandler){
	var match = /URL:\s([0-9][0-9]+)\./.exec(data);
	if(match && progressHandler){
		var currentPage = parseInt(match[1], 10);
		progressHandler.processedPages = currentPage;
		progressHandler.sendProgress('mobi');
	}
	console.log((new Date()).toString() + ' -- ' + data.toString());
}

function generateMobi(epubFile, progressHandler){
	// Reset processedPages for the new action
	if(progressHandler) progressHandler.processedPages = 0;
	var mobi = spawn(kindlegen, [epubFile, '-verbose']);

	mobi.stdout.on('data', function(data){
		parseMobiOut(data, progressHandler);
	});

	mobi.stderr.on('data', function (data) {
	  console.log('stderr at: ' + (new Date()).toString() + ' - ' + data);
	  progressHandler.sendError(data);
	});

	mobi.on('exit', function(code){
		console.log('closed at: ' + (new Date()).toString() + ' - ' + code);
		if(code === 0 && !keePub){
			fs.remove(epubFile);
		}
		if(code === 0){
			var mobiFile = epubFile.replace('epub', 'mobi');
			progressHandler.sendEnd(code, mobiFile);
		}else{
			progressHandler.sendEnd(code);
		}
	});

}

// dataprocessor: text and some kind of progress
function generatEbook(inputFolder, outputFile, title, progressHandler){
	// Reset processedPages for the new action
	if(progressHandler) progressHandler.processedPages = 0;
	// -v -> verbose: output displays currently processed image -> get an idea about progress
	var options = ['-u', command, '-v', '-t', title, '-o', outputFile += '.epub', inputFolder];
	// add options from config
	if(additionalOptions && Array.isArray(additionalOptions)) options.push.apply(options, additionalOptions);
	fs.mkdirs(outputFile.split('/').slice(0, -1).join('/'), function(err){
		if(err){
			console.log(err);
			progressHandler.sendError(err);
		}
		else{
			var kcc = spawn('python', options, {env: environment});

			kcc.stdout.on('data', function(data){
				parseKccOut(data, progressHandler);
			});

			kcc.stderr.on('data', function (data) {
			  console.log('stderr at: ' + (new Date()).toString() + ' - ' + data);
			  progressHandler.sendError(data);
			});

			kcc.on('exit', function(code){
				console.log('closed at: ' + (new Date()).toString() + ' - ' + code);
				// on success generate mobi
				if(code === 0){
					if(kindlegen && kindlegen.indexOf('kindlegen') !== -1){
						generateMobi(outputFile, progressHandler);
					}
					else if(progressHandler){
						progressHandler.sendEnd(code, outputFile);
					}
				}
				else if(progressHandler){
					progressHandler.sendEnd(code);
				}
			});
		}
	});
}

exports.generatEbook = generatEbook;