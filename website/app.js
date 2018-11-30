const vm = new Vue({
	el: '#app',
	data: {
		records: null
	},
	mounted() {
		axios.get('/api/v1/records/').then((response) => {
			this.records = response.data.records;
		}).catch(error => {
			console.log(error);
		});
	}
});
