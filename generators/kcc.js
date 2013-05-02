var spawn = require('child_process').spawn;
var fs = require('fs-extra');
var config = require('../config');
var command = config.kcc.command;
var environment = config.kcc.environment;
var additionalOptions = config.kcc.options;
var keePub = config.kcc.keePub;
var kindlegen = config.kcc.kindlegen;


function parseStdOut(data){
		console.log((new Date()).toString() + ' -- ' + data.toString());
	}

function generateMobi(epubFile, dataProcessor, errorProcessor, endProcessor){
	var mobi = spawn(kindlegen, [epubFile, '-verbose']);
	mobi.stdout.on('data', parseStdOut);
	mobi.stderr.on('data', function (data) {
	  console.log('stderr at: ' + (new Date()).toString() + ' - ' + data);
	});
	mobi.on('exit', function(code){
		console.log('closed at: ' + (new Date()).toString() + ' - ' + code);
		if(code === 0 && !keePub){
			fs.remove(epubFile);
		}
		if(code === 0){
			var mobiFile = epubFile.replace('epub', 'mobi');
			endProcessor({code: code, file: mobiFile});
		}else{
			endProcessor({code: code});
		}
	});

}

// dataprocessor: text and some kind of progress
function generatEbook(inputFolder, outputFile, title, dataProcessor, errorProcessor, endProcessor){

	// see -v option below: if we know the current image vs  total -> progress
	fs.readdir(inputFolder, function(err, files){
		var nrOfImages = 0;
		for(var i = 0; i < files.length; i++){
			var isImage = (/\.(gif|jpg|jpeg|tif|tiff|png|bmp)$/i).test(files[i]);
			if(isImage) nrOfImages++;
		}
		// -v -> verbose: output displays currently processed image -> get an idea about progress
		var options = ['-u', command, '-v', '-t', title, '-o', outputFile += '.epub', inputFolder];
		// add options from config
		if(additionalOptions && Array.isArray(additionalOptions)) options.push.apply(options, additionalOptions);
		fs.mkdirs(outputFile.split('/').slice(0, -1).join('/'), function(err){
			// TODO: if(err)...
			var kcc = spawn('python', options, {env: environment});
			// kcc.stdout.setEncoding('utf8');
			kcc.stdout.on('data', parseStdOut);
			kcc.stderr.on('data', function (data) {
			  console.log('stderr at: ' + (new Date()).toString() + ' - ' + data);
			});
			kcc.on('exit', function(code){
				console.log('closed at: ' + (new Date()).toString() + ' - ' + code);
				// on success generate mobi
				if(code === 0){
					if(kindlegen && kindlegen.indexOf('kindlegen') !== -1){
						generateMobi(outputFile, dataProcessor, errorProcessor, endProcessor);
					}
					else if(endProcessor && typeof(endProcessor)==="function"){
						endProcessor({code: code, file: outputFile});
					}
				}
				else if(endProcessor && typeof(endProcessor)==="function"){
					endProcessor({code: code});
				}
			});
		});
	});
}

exports.generatEbook = generatEbook;