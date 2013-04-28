Manga = {
	pageloaded: function(){

	},

	downloadChaptersFromList: function(listOfChapters){
		$.post('/ajax/downloadchaptersfromlist', {list: listOfChapters}, function(data){
			console.log(data);
		});
	},

	getNrOfPagesFromList: function(listOfChapters){
		$.get('/ajax/getnrofpagesfromlist', {list: listOfChapters}, function(data){
			console.log(data);
		});
	}
};

$(Manga.pageloaded);