const vm = new Vue({
	el: '#table',
	data: {
		records: [],
		fields: [
			{
				key: 'id',
				sortable: true,
				thStyle: {
					width: '60px'
				}
			},
			{
				key: 'title',
				label: 'Titolo',
				sortable: true,
				thStyle: {
					minWidth: '250px'
				}
			},
			{
				key: 'creator',
				label: 'Autore',
				sortable: true,
				thStyle: {
					minWidth: '100px'
				}
			},
			{
				key: 'subject',
				label: 'Soggetti',
				sortable: true
			},
			{
				key: 'description',
				label: 'Descrizione',
				sortable: true
			},
			{
				key: 'more',
				label: '',
				thStyle: {
					width: '90px'
				}
			},
		],
		currentPage: 1,
		totalRows: 1000,
		perPage: 25,
		filter: null,
		modalInfo: {
			title: '',
			contributor: '',
			date: '',
			language: '',
			publisher: '',
			type: '',
			format: '',
			relation: '',
			link: ''
		}
	},
	methods: {
		info(item, button) {
			this.modalInfo.title = `Informazioni aggiuntive su "${item.title}"`
			this.modalInfo.contributor = item.contributor
			this.modalInfo.date = item.date
			this.modalInfo.language = item.language
			this.modalInfo.publisher = item.publisher
			this.modalInfo.type = item.type
			this.modalInfo.format = item.format
			this.modalInfo.relation = item.relation
			this.modalInfo.link = item.link
			this.$root.$emit('bv::show::modal', 'modalInfo', button)
		},
		resetModal() {
			this.modalInfo.title = ''
			this.modalInfo.content = ''
		},
		filterUpdate: _.debounce(function (value) {
			this.filter = value;
		}, 300),
		filterHandler(item) {
			if (this.filter) {
				let filter = this.filter.toLowerCase()
				return item.title.toLowerCase().includes(filter) || item.creator.toLowerCase().includes(filter) || item.description.toLowerCase().includes(filter) || item.subject.toLowerCase().includes(filter)
			} else {
				return true
			}
		},
		onFiltered(filteredItems) {
			this.totalRows = filteredItems.length
			this.currentPage = 1
		}
	},
	mounted() {
		axios.get('/api/v1/records/').then((response) => {
			this.records = response.data.records;
		}).catch(error => {
			console.log(error);
		});
	}
});
