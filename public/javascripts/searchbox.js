Searchbox = {
	results: {},
	pageloaded: function(){
		$("#searchbox").typeahead({
			minLength: 2,
			source: function(typed, callback){
				$.get('/ajax/search', {term: typed}, function(data) {
					if(data && data.length >0){
						var titles = [];
						for(var i in data){
							// second field is title
							titles[i] = data[i][1];
							// keep track of ids and other metadata
							Searchbox.results[titles[i]] = data[i];
						}
						callback(titles);
					}
					else callback([]);
				});
			},
			highlighter: function(item){
				// look up item
				var founditem = {	image: Searchbox.results[item][0],
									title: Searchbox.results[item][1],
									url: Searchbox.results[item][2],
									author: Searchbox.results[item][4]
								};
				return $("#dropdownitem").tmpl(founditem).html();
			},

			// filtering already happened on mangafox
			matcher: function () { return true; },

			updater: function(item){
				document.location = Searchbox.results[item][2];
				return item;
			}

		});
		$("#searchbox").focus();
	}
};

$(Searchbox.pageloaded);