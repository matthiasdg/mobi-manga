var spawn = require('child_process').spawn;
var fs = require('fs');
var config = require('../config');
var command = config.kcc.command;
var environment = config.kcc.environment;
var additionalOptions = config.kcc.options;
var keePub = config.kcc.keePub;
var kindlegen = config.kcc.kindlegen;
// var StreamSplitter = require("stream-splitter");


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
	});

}

// dataprocessor: text and some kind of progress
function generateEbook(inputFolder, outputFile, dataProcessor, errorProcessor, endProcessor){

	// see -v option below: if we know the current image vs  total -> progress
	fs.readdir(inputFolder, function(err, files){
		var nrOfImages = 0;
		for(var i = 0; i < files.length; i++){
			var isImage = (/\.(gif|jpg|jpeg|tif|tiff|png|bmp)$/i).test(files[i]);
			if(isImage) nrOfImages++;
		}
		// -v -> verbose: output displays currently processed image -> get an idea about progress
		var options = ['-u', command, '-v', '-o', outputFile += '.epub', inputFolder];
		// add options from config
		if(additionalOptions && Array.isArray(additionalOptions)) options.push.apply(options, additionalOptions);

		var kcc = spawn('python', options, {env: environment});

		// kcc.stdout.setEncoding('utf8');
		kcc.stdout.on('data', parseStdOut);
		kcc.stderr.on('data', function (data) {
		  console.log('stderr at: ' + (new Date()).toString() + ' - ' + data);
		});
		kcc.on('exit', function(code){
			console.log('closed at: ' + (new Date()).toString() + ' - ' + code);
			// on success generate mobi
			if(code === 0 && kindlegen && kindlegen.indexOf('kindlegen') !== -1){
				generateMobi(outputFile, dataProcessor, errorProcessor, endProcessor);
			}
			else if(endProcessor && typeof(endProcessor)==="function"){
				endProcessor(code);
			}
		});

	});




// if(kindlegen)
}

exports.generateEbook = generateEbook;