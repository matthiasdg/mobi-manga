var childprocess = require('child_process');
var config = require('../config');
var command = config.kcc.command;
var keePub = config.kcc.keePub;
var kindlegen = config.kcc.kindlegen;


function generateEbook(inputFolder, outputFile, dataProcessor, errorProcessor, endProcessor){
	console.log('Yay!');
// if(kindlegen)
}

exports.generateEbook = generateEbook;