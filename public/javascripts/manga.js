
Manga = {
	pageloaded: function(){
		$('#volumelist').on('click', '.icon-remove', function(e){
			console.log(e.target);
		});
	},

	generatEbook: function(id, bookRef, title, listOfChapters){
		$.post('/ajax/generatebook', {list: listOfChapters, bookref: bookRef, title: title, id: id}, function(data){
			if(data.err) console.log(data.err);
		});
	},

	getNrOfPagesFromList: function(listOfChapters, callback){
		$.post('/ajax/getnrofpagesfromlist', {list: listOfChapters}, function(data){
			callback(data);
		});
	},

	checkForDownload: function(id){
		var $jQelem = $('#' + id);
		var $spinner = $jQelem;
		// Kindle PW browser doesn't support scrollTop nor its alternatives
		var clickedTop = $jQelem.offset().top;
		var url = $jQelem.find('a').first().attr('data-url');
		var extension = url.split('.').slice(-1)[0];
		if(extension === 'mobi' || extension === 'epub'){
			bootbox.confirm('Continue downloading ' + $jQelem.find('a').first().text() + '?', function(confirmed){
				if(confirmed) window.location = url;
			});
			$('.modal').css({'margin-top': clickedTop - $('.modal').height()/2, 'top': 0});
			$('.modal-backdrop.fade').css({'height': $(document).height()});
		}
		else{
			var listOfChapters = [];
			var bookRef = '';
			// if volume, get chapterurls
			var isVolume = (/v[0-9][0-9]/).test(url.split('/').slice(-1));
			if(isVolume){
				// first a is volume itself
				var $chapterElems = $jQelem.find('a').slice(1);
				listOfChapters = $chapterElems.map(function(){return this.getAttribute('data-url');}).get();
				bookRef = url.split('.').slice(0, -1).join('.');
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
				if(data.err) return bootbox.alert('Error: ' + data.err);
				$spinner.spin(false);
				if(data && data.nrofpages){
					var title = $jQelem.find('a').first().text();
					bootbox.confirm("You're about to generate an ebook of " + data.nrofpages + ' pages, holding '
					+ title + '<br>Continue?', function(confirmed){
						if(confirmed){
							var $icon = $jQelem.find('i').first();
							$icon.removeClass('icon-download', 'icon-remove');
							$icon.addClass('icon-refresh');
							// TODO: change data-url

							// hack to be able to store id in dbase upon save -> necessary to generate images for /local
							var id = window.location.search.split('=')[1];
							Manga.generatEbook(id, bookRef, title, listOfChapters);
						}
					});
					// bootbox at correct height: bottom in middle of clicked element
					// background-height = document (<-> window if position fixed)
					$('.modal').css({'margin-top': clickedTop - $('.modal').height() + $('.chapterlink').height(), 'top': 0});
					$('.modal-backdrop.fade').css({'height': $(document).height()});
				}
			});
		}
	}
};

$(Manga.pageloaded);