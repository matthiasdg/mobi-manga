
/**
 * Module dependencies.
 */

var express = require('express')
	, http = require('http')
	, cheerio = require('cheerio')
	, httpreq = require('httpreq')
	, async = require('async')
	, mkdirp = require('mkdirp')
	, fs = require('fs')
	, nStore = require('nstore')
	, path = require('path');

var app = express();
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
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
	app.use(express.errorHandler());
}

function pad(s, len) {
	if (s.length < len) {
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
		mkdirp(fileDirPath, function(err){
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
		var nrOfDigits = nrPages.toString().length;
		// baseLink: part before 1.html
		var baseLink = chapter.split('/').slice(0, -1).join('/');
		var pageList =[];
		for(var i = 1; i <= nrPages; i++)
			pageList.push(baseLink + '/' + i + '.html');
		downloadPages(pageList, nrOfDigits, callback);
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


app.post('/ajax/search', function(req, res){
	// browser did 'post' but got empty result, 'get' seems to work better?
	httpreq.get(baseUri + '/ajax/search.php', {parameters: {term: req.body.term}},function(err, data){
		if(err) res.json({err: err});
		else {
			var items = JSON.parse(data.body);
			for(var i in items){
				items[i][0] = baseUri + '/icon/' + items[i][0] + '.jpg';
			}
			res.json(items);
		}
	});
});

app.post('/ajax/downloadchaptersfromlist', function(req, res){
	console.log((new Date()).toString());
	downloadChaptersFromList(req.body.list, function(err, pathList){
		if(err) console.log(err);
		console.log((new Date()).toString() + ' : ' + pathList);
	});
	// Fire and forget
	res.json({err: 0});
});

app.get('/ajax/getnrofpagesfromlist', function(req, res){
	getNrOfPagesFromList(req.query.list, function(err, nrOfPages){
		if(err) res.json({err: err});
		else res.json({nrofpages: nrOfPages});
	});
});

app.get('/', function(req, res){
	res.redirect('/mangafox');
});

app.get('/local', function(req, res){
	res.render('collection', {
		title: 'mobi manga: local collection',
		localCollection: []
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
							url: id_url.url.replace(baseUri, ''),
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
							author: author,
							description: description,
							image: image
						};
			manga.volumes = [];
			var volumes = $('#chapters').find(".volume");
			var chapterLists = $('#chapters').find('.chlist');
			if(volumes.length !== chapterLists.length) console.log('Warning: #volumes != #chapterlists');
			volumes.each(function(i, element){
				var chapText = $(element).find('span').first().text();
				var title = $(element).text().replace(chapText, ' (contains ' + chapText.slice(1) + ')');
				var url = 'TO BE GENERATED BY ME: DOWNLOAD ENTIRE VOLUME';
				manga.volumes[i] = {title: title, url: url, chapterlist: []};
			});
			chapterLists.each(function(i, element){
				// chapters have h3 and h4 headings!?
				var headings = $(element).find('h3, h4');
				manga.volumes[i].chapterlist = [];
				headings.each(function(j, heading){
					manga.volumes[i].chapterlist[j] = {
						title : $(heading).text().replace(/\r\n\t\t*/,' ').replace(/\t*/g, ''),
						url : $(heading).find('a').attr('href')
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


// load database before starting server
var mangas = nStore.new(__dirname + '/data/mangas.db', function(){
	http.createServer(app).listen(app.get('port'), function(){
		console.log('Express server listening on port ' + app.get('port'));
	});

});
