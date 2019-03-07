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
		currentPage: 1,
		totalRows: 1530,
		perPage: 25,
		filter: null,
		loadingButtonIndex: null,
		altroModalInfo: { place: '', title: '', contributor: '', date: '', language: '', publisher: '', type: '', format: '', relation: '', link: '' },
		espandiModalInfo: { title: '', viaf_id: '', author_other_works: '', author_wiki_page: '', author_wiki_info: '', entities: [] },
	},
    delimiters: ["<%","%>"],
	methods: {
		showAltro(item, button) {
			this.altroModalInfo.title = `Informazioni aggiuntive su "${item.title}"`;
			this.altroModalInfo.place = item.place;
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
			loadingButtonIndex = index;
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
		filterUpdate: _.debounce(function (value) {
			this.filter = value;
		}, 250),
		filterHandler(item, _) {
			if (this.filter) {
				let filter = this.filter.toLowerCase();
				return item.title.toLowerCase().includes(filter) ||
					   item.creator.toLowerCase().includes(filter) ||
					   item.description.toLowerCase().includes(filter) ||
					   item.subject.toLowerCase().includes(filter)
			} else {
				return true
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
	}
});


(function ($) {
	$.fn.button = function (action) {
		if (action === 'loading' && this.data('loading-text')) {
			this.data('original-text', this.html()).html(this.data('loading-text')).prop('disabled', true);
		}
		if (action === 'reset' && this.data('original-text')) {
			this.html(this.data('original-text')).prop('disabled', false);
		}
	};
}(jQuery));
