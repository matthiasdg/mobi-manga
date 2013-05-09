
Manga = {
	pageloaded: function(){
		$('#volumelist').on('click', '.icon-remove', function(e){
			var $icn = $(e.target);
			var $li = $icn.closest('li');
			var seriesKey = $icn.closest('.container').attr('id');
			var bookId = $li.attr('id');
			var $anchor = $li.find('a').first();
			var text = $anchor.text();
			var clickedTop = $icn.offset().top;
			bootbox.confirm("You're about to delete " + text + '!!'
			 + '<br>Continue?', function(confirmed){
			 	if(confirmed)
					$icn.parent().removeClass('btn btn-mini btn-inverse');
					$icn.removeClass('icon-remove').addClass('icon-download');
					var dataUrl = 'http://mangafox.me/manga';
					if($anchor.hasClass('chapterlink')){
						// revert to orig
						dataUrl += '/' + seriesKey + $anchor.attr('data-url').split(seriesKey)[1] + bookId + '/1.html';
					}
					else{
						dataUrl = '/' + seriesKey + '/' + bookId + '.html';
 					}
 					$anchor.attr('data-url', dataUrl);
 					Manga.deletEbook(seriesKey, bookId);
			});
			Manga.alignBootBox(clickedTop);

		});
		if(!Manga.socket){
			// socket.io initialiseren
			Manga.socket = io.connect(window.location.hostname);
			// some debugging statements concerning socket.io
			Manga.socket.on('reconnecting', function(seconds){
				console.log('reconnecting in ' + seconds + ' seconds');
			});
			Manga.socket.on('reconnect', function(){
				console.log('reconnected');
			});
			Manga.socket.on('reconnect_failed', function(){
				console.log('failed to reconnect');
			});
			var series = $('h2').parent().attr('id');
			Manga.socket.on(series, function(data){
				if(data.bookId){
					var $bookIdElem = $('#' + data.bookId);
					var $progress = $bookIdElem.find('.progresswrapper');
					// if no match -> no progress bar -> create one
					if($progress.length === 0){
						$progress = Manga.createProgressBar($bookIdElem);
					}
					Manga.processData(data, $progress, $bookIdElem);
				}
			});
		}
	},

	processData: function(data, $progress, $bookIdElem){
		switch(data.action){
			case 'download':
			$progress.find('.cap').text('Downloading images: ' + data.progress + '%');
			$progress.find('.imagebar').css('width', data.progress/3 + '%');
			break;

			case 'kcc':
			$progress.find('.cap').text('Converting to ePub: ' + data.progress + '%');
			$progress.find('.kccbar').css('width', data.progress/3 + '%');
			break;

			case 'mobi':
			$progress.find('.cap').text('Converting to mobi: ' + data.progress + '%');
			$progress.find('.mobibar').css('width', data.progress/3 + '%');
		};
		if(data.error){
			$progress.find('.cap').text('ERROR: ' + data.error);
			// Refresh to get a new attempt at downloading; db entry is cleared
		}
		if(data.hasOwnProperty('exit') && data.exit == 0){
			var $a = $bookIdElem.find('a').first();
			// Replace url: download possible
			$a.attr('data-url', data.file);
			$a.show();
			// remove progress bars
			$progress.remove();
			var $btnWrapper = $bookIdElem.children('.wrapper');
			if($btnWrapper.length === 0){ //volumes have an additional level in between
				$btnWrapper = $bookIdElem.find('.wrapper').first();
				$btnWrapper.removeClass('wrapper').addClass('btn btn-mini btn-inverse');
				// the timeout solves a problem in chrome where applying a btn to something that already floated, drops it to the next line
				setTimeout(function(){$btnWrapper.addClass('wrapper');}, 100);
			}
			else{ // we're dealing with a chapter
				$btnWrapper.removeClass('wrapper').addClass('btn btn-mini');
				// the timeout solves a problem in chrome where applying a btn to something that already floated, drops it to the next line
				setTimeout(function(){$btnWrapper.addClass('wrapper');}, 100);
			}
			$btnWrapper.children('i').first().removeClass('icon-refresh').addClass('icon-remove');
		}
	},

	createProgressBar: function($bookIdElem){
		var $progressBar = $('#progresstemp').tmpl();
		var $a = $bookIdElem.find('a').first();
		$a.hide();
		$a.parent().append($progressBar);
		return $progressBar;
	},

	deletEbook: function(seriesKey, bookId){
		$.get('/ajax/deletebook', {key: seriesKey, field: bookId}, function(data){
			if(data.err) console.log(data.err);
		});
	},

	// posts because of big arrays
	generatEbook: function(id, bookRef, title, listOfChapters, nrOfPages){
		$.post('/ajax/generatebook', {list: listOfChapters, bookref: bookRef, title: title, id: id, pages: nrOfPages}, function(data){
			if(data.err) console.log(data.err);
		});
	},

	getNrOfPagesFromList: function(listOfChapters, callback){
		$.post('/ajax/getnrofpagesfromlist', {list: listOfChapters}, function(data){
			callback(data);
		});
	},

	alignBootBox: function(clickedTop){
		// bootbox at correct height: bottom in middle of clicked element
		// background-height = document (<-> window if position fixed)
		$('.modal').css({'margin-top': clickedTop - $('.modal').height() + $('.chapterlink').height(), 'top': 0});
		$('.modal-backdrop.fade').css({'height': $(document).height()});
	},

	checkForDownload: function(id){
		var $jQelem = $('#' + id);
		var $spinner = $jQelem;
		// Kindle PW browser doesn't support scrollTop nor its alternatives
		var clickedTop = $jQelem.offset().top;
		var url = $jQelem.find('a').first().attr('data-url');
		var extension = url.split('.').slice(-1)[0];
		if(extension === 'mobi' || extension === 'epub'){
			window.location = url;
		}
		else{

			if((/#$/).test(url)){
				bootbox.alert("Already processing this ebook!");
				Manga.alignBootBox(clickedTop);
			}

			else{ // generate new ebook
				var listOfChapters = [];
				var bookRef = '';
				// if volume, get chapterurls -> volume-url is not generated by mangafox and ends (=slice(-1)) in /v00.html
				var isVolume = (/v[0-9][0-9]/).test(url.split('/').slice(-1));
				if(isVolume){
					// first a is volume itself
					var $chapterElems = $jQelem.find('a').slice(1);
					listOfChapters = $chapterElems.map(function(){return this.getAttribute('data-url');}).get();
					bookRef = url.split('.')[0];
					// better to spin small black div
					$spinner = $jQelem.children().first();
				}
				else {
					listOfChapters.push(url);
					bookRef = url.split('mangafox.me/manga')[1].split('/').slice(0, -1).join('/');
				}
				if(isVolume) $spinner.spin('large', '#fff');
				else $spinner.spin('large');
				Manga.getNrOfPagesFromList(listOfChapters, function(data){
					if(data.err){
						bootbox.alert('Error: ' + data.err);
						Manga.alignBootBox(clickedTop);
					}
					$spinner.spin(false);
					if(data && data.nrofpages){
						var $anchor = $jQelem.find('a').first();
						var title = $anchor.text();
						bootbox.confirm("You're about to generate an ebook of " + data.nrofpages + ' pages, holding '
						+ title + '<br>Continue?', function(confirmed){
							if(confirmed){
								var $icon = $jQelem.find('i').first();
								$icon.removeClass('icon-download');
								$icon.addClass('icon-refresh');
								$anchor.attr('data-url', '#');
								// hack to be able to store id in dbase upon save -> necessary to generate images for /local
								var id = window.location.search.split('=')[1];
								Manga.generatEbook(id, bookRef, title, listOfChapters, data.nrofpages);
							}
						});
						Manga.alignBootBox(clickedTop);
					}
				});
			}
		}
	}
};

$(Manga.pageloaded);