
/**
 * Module dependencies.
 */

var express = require('express')
	, http = require('http')
	, cheerio = require('cheerio')
	, httpreq = require('httpreq')
	, async = require('async')
	, fs = require('fs-extra')
	, nStore = require('nstore')
	, nStore = nStore.extend(require('nstore/query')())
	, path = require('path');

var app = express();
var mangas = nStore.new(__dirname + '/data/mangas.db', function(){

});
var generator = require(require('./config').generator);
var baseUri = 'http://mangafox.me';

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('tiny'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(require('stylus').middleware(__dirname + '/public'));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
	app.use(express.errorHandler());
}

function pad(s, len) {
	if (s.toString().length < len) {
		s = ('0000000000000' + s).slice(-len);
	}
	return s;
}


// try the 2 urls both 'tries' times
function requestImage(imageUrl, imageUrlAlternative, tries, callback){
	if(tries === 0) return callback(new Error("couldn't download " + imageUrl), null);
	httpreq.get(imageUrl, {binary: true}, function(err, res){
		// try alternative url if you don't get an image or an error
		if(err || res.headers['content-type'].indexOf('image') === -1){
			console.log("couldn't get " + imageUrl + ", trying alternative...");
			// wait 2s before trying alternative
			setTimeout(function(){
				httpreq.get(imageUrlAlternative, {binary: true}, function(err1, res1){
					if(err1 || res1.headers['content-type'].indexOf('image') === -1){
						// next loop after 10s
						console.log('trying again to download '+imageUrl + ', ' + (tries - 1) + ' tries left.');
						setTimeout(function(){
							requestImage(imageUrl, imageUrlAlternative, --tries, callback)
						}, 10000);
					}
					else return callback(null, res1);
				});
			}, 2000);
		}
		else return callback(null, res);
	});
}

function downloadPage(page, nrOfDigits, callback){
	httpreq.get(page, function(err, data){
		if(err) return callback(err, null);
		var $ = cheerio.load(data.body);
		var image = $('#image');
		var imageUrl = image.attr('src');
		// alternative url; in case first one fails
		var imageUrlAlternative = image.attr('onerror').split('=')[1];
		var extension = imageUrl.split('.').slice(-1)[0];
		var futureFilename = pad(page.split('/').slice(-1)[0].split('.')[0], nrOfDigits) + '.' + extension;
		var fileDirPath = __dirname + '/data/' + page.split('/').slice(4, -1).join('/');
		var filePath = fileDirPath + '/' + futureFilename;
		fs.mkdirs(fileDirPath, function(err){
			if(err) return callback(err, null);
			async.waterfall([
				function(asyncDone){
					requestImage(imageUrl, imageUrlAlternative, 10, asyncDone);
				}],

				function(err, res){
					if(err) return callback(err, null);
					// replaces file if already exists -> no problem with aborted stuff
					fs.writeFile(filePath, res.body, function(err){
						if(err) return callback(err, null);
						callback(null, filePath);
					});
				}
			);
		});
	});
}

function downloadPages(pageList, nrOfDigits, callback){
	// not downloading in parallel but sequential
	async.mapSeries(pageList,
		function(page, asyncDone){
			downloadPage(page, nrOfDigits, asyncDone);
		},
		function(err, results){
			if(err || !(results && results.length > 0) ) return callback(err, null);
			var commonPagePath = results[0].split('/').slice(0, -1).join('/');
			callback(null, commonPagePath);
		}
	);
}


// chapter: chapter's url on mangafox
function downloadChapter(chapter, callback){
	httpreq.get(chapter,function(err, data){
		if(err) return callback(err, null);
		var $ = cheerio.load(data.body);
		var nrPages = $('select.m').first().children().length -1;
		// we'll pad the image names with leading zero's: necessary for conversion
		var nrOfDigits = 4;
		// baseLink: part before 1.html
		var baseLink = chapter.split('/').slice(0, -1).join('/');
		var pageList =[];
		for(var i = 1; i <= nrPages; i++)
			pageList.push(baseLink + '/' + i + '.html');
		downloadPages(pageList, 4, callback);
	});
}

// mapLimit: limit number of iterations in parallel
function downloadChaptersFromList(chapterList, callback){
	async.mapLimit(chapterList, 2, downloadChapter, callback);
};

function getNrOfPages(chapter, callback){
	httpreq.get(chapter,function(err, data){
		if(err) return callback(err, null);
		var $ = cheerio.load(data.body);
		var nrPages = $('select.m').first().children().length -1;
		callback(null, nrPages);
	});
}

// check the amount of pages you are about to download...
function getNrOfPagesFromList(chapterList, callback){
	async.mapLimit(chapterList, 2, getNrOfPages, function(err, results){
		if(err) return callback(err, null);
		var total = 0;
		for(var i = 0; i < results.length; i++){
			total += results[i];
		}
		callback(null, total);
	});
}


function mergeImageFolders(pathList, callback){
	var size = pathList.length;
	// last folder contains first images
	var destination = pathList[size - 1];
	fs.readdir(destination, function(err, files){
		var nrOfImages = 0;
		for(var i = 0; i < files.length; i++){
			var isImage = (/\.(gif|jpg|jpeg|tif|tiff|png|bmp)$/i).test(files[i]);
			if(isImage) nrOfImages++;
		}
		var sourceFolders = pathList.slice(0, -1).reverse();
		var latestImage = nrOfImages;
		async.eachSeries(sourceFolders, function(dir, asyncDone){
			nrOfImages = latestImage; //this gets updated every outer loop
			fs.readdir(dir, function(err, files){
				async.eachSeries(files, function(file, innerDone){
					var okImage = (/[0-9]+\.(gif|jpg|jpeg|tif|tiff|png|bmp)$/i).test(file);
					if(okImage){
						var parts = file.split('.');
						var imageNumber = parseInt(parts[0], 10);
						fs.rename(path.join(dir, file), path.join(destination, pad(imageNumber + nrOfImages, 4) + '.' + parts[1]), innerDone);
						latestImage = imageNumber + nrOfImages;
					}
					else innerDone(null);
				}, asyncDone);
			});

		}, function(err){
			callback(err, destination);
		});
	});
}

function successHandler(codeFileObject){
	if(codeFileObject.file){
		var fileName = codeFileObject.file;
		var seriesIndex = fileName.indexOf('/books/') + 7;
		var bookPath = fileName.slice(seriesIndex);
		var tempArray = bookPath.split('/');
		var series = tempArray[0];
		// image folders are still left
		fs.remove(__dirname + '/data/' + series);
		var bookId = tempArray.slice(-1)[0].split('.')[0];
		mangas.get(series, function(err, doc, key){
			if(err){
				// not possible, already saved on beginning of download
				console.log("Something is wrong with the database! Can't find entry for: " + series + '!');
			}
			else{
				// we prefixed the filename with the series name + _ to generate different files on the kindle. The bookid in the database does not include this prefix, hence strip it
				doc.books[bookId.split('_').slice(-1)[0]] = bookPath;
				mangas.save(series, doc, function(er){
					if(er){
						console.log(er);
					}
				});
			}
		});
	}
}

app.get('/ajax/search', function(req, res){
	// browser did 'post' but got empty result, 'get' seems to work better?
	httpreq.get(baseUri + '/ajax/search.php', {parameters: {term: req.query.term}},function(err, data){
		if(err) res.json({err: err});
		else {
			var items = JSON.parse(data.body);
			for(var i in items){
				// generate series url on localhost, id parameter cannot always be scraped from series page -> put it onto the URL
				// could store this in database but every save generates an extra line in the dbase file...
				items[i][2] = '/manga/' + items[i][2] + '?id=' + items[i][0];
				// generate thumburl (still refers to mangafox)
				items[i][0] = baseUri + '/icon/' + items[i][0] + '.jpg';
			}
			res.json(items);
		}
	});
});


app.get('/ajax/deletebook', function(req, res){
	var key = req.query.key;
	var id = req.query.field;
	mangas.get(key, function(err, obj, k){
		if(err) return res.json({err: err});
		console.log(JSON.stringify(obj));
		console.log(obj.books[id]);
		fs.remove(path.join(__dirname, 'data', 'books', obj.books[id]));
		delete obj.books[id];
		console.log(JSON.stringify(obj));
		mangas.save(key, obj, function(er){
			if(err) return res.json({err:err});
			res.json({err:0});
		});
	});
});


app.post('/ajax/generatebook', function(req, res){
	var list = req.body.list;
	var bookRef = req.body.bookref;
	var id = req.body.id;
	var title = req.body.title;
	var bookRefSplit = bookRef.split('/');
	var series = bookRefSplit[1];
	var bookId = bookRefSplit.slice(-1)[0];
	var error = 0;
	// write in dbase -> no multiple generations of the same file at the same time
	mangas.get(series, function(err, doc, key){
		// document not defined -> error create a new
		if(err){
			doc = {id: id};
			doc.books = {};
			doc.books[bookId] = '#'; // becomes book-url -> update it after successful creation
		}
		else doc.books[bookId] = '#';
		mangas.save(series, doc, function(err){
			if(err) return res.json({err: error});

			downloadChaptersFromList(list, function(err, pathList){
				if(err) console.log(err);
				else{
					async.waterfall([
						function(asyncDone){
							if(pathList.length > 1){
								mergeImageFolders(pathList, asyncDone);
							}
							else{
								asyncDone(null, pathList[0]);
							}
						}],
						function(error, onePath){
							if(err) console.log(err);
							var fileName = bookRefSplit.slice(0, -1).join('/') + '/' + series + '_' + bookId;
							generator.generatEbook(onePath, __dirname + '/data/books' + fileName, series + ': ' + title, null, null, successHandler);
						}
					);
				}
			});
			// Fire and forget; not in callback
			res.json({err: 0});
		});

	});
});

app.post('/ajax/getnrofpagesfromlist', function(req, res){
	getNrOfPagesFromList(req.body.list, function(err, nrOfPages){
		if(err) res.json({err: err});
		else res.json({nrofpages: nrOfPages});
	});
});

app.get('/', function(req, res){
	res.redirect('/mangafox');
});

app.get('/local', function(req, res){
	var localCollection = [];
	mangas.all(function(err, results){
		if(err) res.send(err.stack);
		else{
			console.log(results);
			for(var key in results){
				var books = results[key].books;
				if(Object.keys(books).length > 0){
					localCollection.push({id: results[key].id, url: '/manga/' + key + '?id=' + results[key].id});
				}
			}

			async.mapLimit(localCollection, 5, function(id_url, transformCallback){
				httpreq.post(baseUri + '/ajax/series.php', {parameters: {sid: id_url.id}}, function(err, data){
					if(err) transformCallback(err, null);
					else {
						var itemAsArray = JSON.parse(data.body);
						item = {
							id: id_url.id,
							url: id_url.url,
							title: itemAsArray[0],
							author: itemAsArray[3],
							description: itemAsArray[9],
							image: itemAsArray[10]
						};
						transformCallback(null, item);
					}
				});
			},
			function(err, itemList){
				if(err) res.send(err.stack);
				else{
					res.render('collection', {
						title: 'mobi manga: local collection',
						localCollection: itemList
					});
				}
			});
		}
	});
});

app.get('/mangafox', function(req, res){
	async.waterfall([
		function(asyncDone){
			// get latest releases from mangafox
			httpreq.get(baseUri + '/releases', function(err,data){
				if(err) return asyncDone(err, null);
				var $ = cheerio.load(data.body);
				var idList = [];
				// ul element
				$('#updates').children().each(function(i, element){
					var anchor = $(element).find('a');
					var url = anchor.attr('href');
					var id = anchor.attr('rel');
					idList.push({id: id, url: url});
				});
				asyncDone(err, idList);
			});
		},
		function(idList, asyncDone){
			async.mapLimit(idList, 5, function(id_url, transformCallback){
				httpreq.post(baseUri + '/ajax/series.php', {parameters: {sid: id_url.id}}, function(err, data){
					if(err) transformCallback(err, null);
					else {
						var itemAsArray = JSON.parse(data.body);
						item = {
							id: id_url.id,
							url: id_url.url.replace(baseUri, '').slice(0, -1) + '?id=' + id_url.id,
							title: itemAsArray[0],
							author: itemAsArray[3],
							description: itemAsArray[9],
							image: itemAsArray[10]
						};
						transformCallback(null, item);
					}
				});
			},
			asyncDone);
		}],
		function(err, itemList){
			if(err) res.send(err.stack);
			else{
				res.render('collection', {
					title: 'mobi manga: new releases',
					remoteCollection: itemList
				});
			}
		}
	);
});

app.get('/manga/:mangatitle', function(req, res){
	mangas.get(req.params.mangatitle, function(err, dBManga, key){
		if(err) {
			dBManga = {id: req.query.id};
			dBManga.books = {};
		}

		httpreq.get(baseUri + '/manga/' + req.params.mangatitle, function(err, data){
			if(err) res.send(err.stack);
			else{
				var $ = cheerio.load(data.body);
				var titleThing = $('#title');
				var title = titleThing.find('h1').first().text();
				var description = titleThing.find('.summary').first().html();
				var image = $('#series_info').find('img').first().attr('src');
				var author = titleThing.find('table').find('a').eq(1).text();
				var manga = {	title: title,
								key: req.params.mangatitle,
								author: author,
								description: description,
								image: image
							};
				manga.volumes = [];
				var volumes = $('#chapters').find(".volume");
				var chapterLists = $('#chapters').find('.chlist');
				if(volumes.length !== chapterLists.length) console.log('Warning: #volumes != #chapterlists');
				volumes.each(function(i, element){
					// latest volumes are on top, we also generate an id for series without volumes
					var id = 'v' + pad(volumes.length -i, 2);
					var chapText = $(element).find('span').first().text();
					var title = $(element).text().replace(chapText, ' (contains ' + chapText.slice(1) + ')');
					var url = '/' + req.params.mangatitle + '/' + id + '.html';
					if(dBManga.books[id]) url = '/data/books/' + dBManga.books[id];
					manga.volumes[i] = {title: title, id: id, url: url, chapterlist: []};
				});
				chapterLists.each(function(i, element){
					// chapters have h3 and h4 headings!?
					var headings = $(element).find('h3, h4');
					manga.volumes[i].chapterlist = [];
					headings.each(function(j, heading){
						var url = $(heading).find('a').attr('href');
						var id = url.split('/').slice(-2, -1)[0];
						if(dBManga.books[id]) url = '/data/books/' + dBManga.books[id];
						manga.volumes[i].chapterlist[j] = {
							title : $(heading).text().replace(/\r\n\t+/,' ').replace(/\t*/g, ''),
							url : url,
							id: id
						};
					});
				});

				res.render('manga', {
					title: manga.title,
					manga: manga
				});
			}
		});

	});

});


http.createServer(app).listen(app.get('port'), function(){
	console.log('Express server listening on port ' + app.get('port'));
});

