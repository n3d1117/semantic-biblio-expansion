new Vue({
	el: '#popular',
	data: {
		top_entities: [],
		top_categories: [],
	},
    delimiters: ["<%","%>"],
	mounted() {
		axios.get('/api/v1/top_entities').then((response) => {
			var items = Object.keys(response.data).map(function(key) {
				return [key, response.data[key]];
			});
			items.sort(function(first, second) {
				return second[1] - first[1];
			});
			this.top_entities = items;
		}).catch(error => {
			console.log(error);
		});

		axios.get('/api/v1/top_categories').then((response) => {
			var items = Object.keys(response.data).map(function(key) {
				return [key, response.data[key]];
			});
			items.sort(function(first, second) {
				return second[1] - first[1];
			});
			this.top_categories = items;
		}).catch(error => {
			console.log(error);
		});
	}
});