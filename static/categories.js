new Vue({
	el: '#popular',
	data: {
		top_entities: [],
		top_categories: [],
	},
    delimiters: ["<%","%>"],
	mounted() {
		axios.get('/api/v1/top_entities?limit=10').then((response) => {
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

		axios.get('/api/v1/top_categories?limit=10').then((response) => {
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

new Vue({
	el: '#table',
	data: {
		records: [],
		fields: [
			{ key: 'id', sortable: true, thStyle: { width: '60px' } },
			{ key: 'title', label: 'Titolo', sortable: true, thStyle: { minWidth: '250px' } },
			{ key: 'creator', label: 'Autore', sortable: true, thStyle: { minWidth: '100px' } },
			{ key: 'subject', label: 'Soggetti', sortable: true },
			{ key: 'description', label: 'Descrizione', sortable: true },
			{ key: 'more', label: '', thStyle: { width: '90px' } },
		],
		entityOptions: [],
		entities_for_record: {},
		currentPage: 1,
		totalRows: 1000,
		perPage: 25,
		filter: null,
		loadingButtonIndex: null,
		altroModalInfo: { title: '', contributor: '', date: '', language: '', publisher: '', type: '', format: '', relation: '', link: '' },
		espandiModalInfo: { title: '', viaf_id: '', author_other_works: '', author_wiki_page: '', author_wiki_info: '', entities: [] },
	},
    delimiters: ["<%","%>"],
	methods: {
		showAltro(item, button) {
			this.altroModalInfo.title = `Informazioni aggiuntive su "${item.title}"`;
			this.altroModalInfo.contributor = item.contributor;
			this.altroModalInfo.date = item.date;
			this.altroModalInfo.language = item.language;
			this.altroModalInfo.publisher = item.publisher;
			this.altroModalInfo.type = item.type;
			this.altroModalInfo.format = item.format;
			this.altroModalInfo.relation = item.relation;
			this.altroModalInfo.link = item.link;
			this.$root.$emit('bv::show::modal', 'altroModalInfo', button);
		},
		espandi(item, index, button) {
			loadingButtonIndex = index
			axios.get(`/api/v1/get_expanded_record?id=${item.id}`).then((response) => {
				this.espandiModalInfo.title = 'Risultato espansione';
				this.espandiModalInfo.viaf_id = response.data.viaf_id;
				this.espandiModalInfo.author_other_works = response.data.author_other_works.split('~~').slice(0, 5);
				this.espandiModalInfo.author_wiki_page = response.data.author_wiki_page;
				this.espandiModalInfo.author_wiki_info = response.data.author_wiki_info;
				this.espandiModalInfo.entities = response.data.entities;
				this.$root.$emit('bv::show::modal', 'espandiModalInfo', button);
				loadingButtonIndex = null;
			}).catch(error => {
				console.log(error);
			});
		},
		resetModals() {
			this.altroModalInfo.content = '';
			this.espandiModalInfo.content = '';
		},
		filterHandler(item) {
			if (this.filter && item.id in this.entities_for_record) {
				return this.entities_for_record[item.id].indexOf(this.filter.toString()) > -1 ||
					   this.entities_for_record[item.id].indexOf('Provincia di ' + this.filter.toString()) > -1;
			} else {
				return this.filter === null
			}
		},
		onFiltered(filteredItems) {
			this.totalRows = filteredItems.length;
			this.currentPage = 1;
		}
	},
	mounted() {
		axios.get('/api/v1/records').then((response) => {
			this.records = response.data;
		}).catch(error => {
			console.log(error);
		});

		axios.get('/api/v1/entities').then((response) => {
			this.entityOptions = response.data;
		}).catch(error => {
			console.log(error);
		});

		axios.get('/api/v1/get_entities_for_record').then((response) => {
			this.entities_for_record = response.data;
		}).catch(error => {
			console.log(error);
		});
	},
});