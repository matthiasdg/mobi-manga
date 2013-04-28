Searchbox = {
	results: {},
	pageloaded: function(){
		$("#searchbox").focus();
		$("#searchbox").typeahead({
			minLength: 2,
			source: function(typed, callback){
				$.post('/ajax/search', {term: typed}, function(data) {
					console.log(data);
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
				var founditem = {image: Searchbox.results[item][0],
								title: Searchbox.results[item][1],
								author: Searchbox.results[item][4]
							};
				console.log(founditem);
				return $("#dropdownitem").tmpl(founditem).html();
			}
		});
	}
};

$(Searchbox.pageloaded);