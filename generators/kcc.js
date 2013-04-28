var spawn = require('child_process').spawn;
var fs = require('fs');
var config = require('../config');
var command = config.kcc.command;
var environment = config.kcc.environment;
var additionalOptions = config.kcc.options;
var keePub = config.kcc.keePub;
var kindlegen = config.kcc.kindlegen;
var StreamSplitter = require("stream-splitter");


function generateEbook(inputFolder, outputFile, dataProcessor, errorProcessor, endProcessor){
	var dates = [];
	var parseStdOut = function(data){
		dates.push((new Date()).toString() + '   ---   ');
	}

	// see -v option below: if we know the current image vs progress
	fs.readdir(inputFolder, function(err, files){
		var nrOfImages = 0;
		for(var i = 0; i < files.length; i++){
			var isImage = (/\.(gif|jpg|jpeg|tif|tiff|png|bmp)$/i).test(files[i]);
			if(isImage) nrOfImages++;
		}
		var options = ['-v', '-o', outputFile, inputFolder];
		// add options from config
		if(additionalOptions && Array.isArray(additionalOptions)) options.push.apply(options, additionalOptions);
		// -v -> verbose: output displays currently processed image -> get an idea about progress
		var process = spawn(command, options, {env: environment});
		process.stdout.setEncoding('utf8');
		process.stdout.on('data', parseStdOut);
		// split stdout output by line
		// var splitter = process.stdout.pipe(StreamSplitter('\n'));
		// splitter.encoding = "utf8";
		// splitter.on("token", parseStdOut);
		// splitter.on('done', function(){
		// 	console.log('splitter done at ' + (new Date()).toString());
		// 	console.log(JSON.stringify(dates));
		// });
		// splitter.on('error', function(data){
		// 	console.log('splitter error at ' + (new Date()).toString() + ' - ' + data);
		// });
		// STDERR WINS
		process.stderr.on('data', function (data) {
		  console.log('stderr at: ' + (new Date()).toString() + ' - ' + data);
		});
		// see splitter done
		process.on('close', function(data){
			console.log('closed at: ' + (new Date()).toString() + ' - ' + data);
			console.log(JSON.stringify(dates));
		})

	});




// if(kindlegen)
}

exports.generateEbook = generateEbook;