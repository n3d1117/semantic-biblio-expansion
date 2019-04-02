let osmUrl = 'http://{s}.tile.osm.org/{z}/{x}/{y}.png',
    osmAttrib = '&copy; <a href="http://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    osm = L.tileLayer.grayscale(osmUrl, {attribution: osmAttrib}),
    toscana = [43.4148394, 11.2210621],
    layers = [],
    additionalLayers = [],
    openedInfoPanes = [];

let map = L.map('map', {
    maxZoom: 16,
    minZoom: 4,
    attributionControl: false,
    fadeAnimation: false,
}).setView(toscana, 9).addLayer(osm);

let bounds = map.getBounds();

let oms = new OverlappingMarkerSpiderfier(map, {keepSpiderfied: true, legWeight: 2});

oms.addListener('click', function (marker) {
    clickZoom(marker);
});

let wikiIcon = new L.Icon({
    iconUrl: '../static/img/wikipedia-icon.png',
    iconSize: [20, 20], iconAnchor: [8, 18], popupAnchor: [2, -20]
});
let placeIcon = new L.Icon({
    iconUrl: '../static/img/place-icon.png',
    iconSize: [20, 20], iconAnchor: [8, 18], popupAnchor: [2, -20]
});
let biblioIcon = L.icon({
    iconUrl: '../static/img/leaflet-biblio.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [29, 29], shadowSize: [30, 35], iconAnchor: [18, 28], shadowAnchor: [4, 35], popupAnchor: [-3, -30]
});

let form = document.getElementById("search-form");
form.addEventListener('submit', function (e) {
    e.preventDefault();
});

let sidebar = L.control.sidebar({autopan: true, closeButton: true, container: 'sidebar', position: 'right'}).addTo(map);

/* Toggle expansions */

let expansionsEnabled = true;
let tooltip = $('[data-toggle="tooltip"]');
tooltip.tooltip();
let enabledExpansionBtn = document.getElementById('toggle-expansion-button');
enabledExpansionBtn.addEventListener('click', function () {
    enabledExpansionBtn.classList.toggle("disabled");
    expansionsEnabled = !enabledExpansionBtn.classList.contains("disabled");
    let newText = expansionsEnabled ? 'Disattiva espansioni' : 'Attiva espansioni';
    tooltip.attr('data-original-title', newText).tooltip('show');
    tooltip.mouseleave(function () {
        $(this).tooltip('hide');
    });
});

/* Legend */

let legend = L.control({position: "bottomleft"});
legend.onAdd = function () {
    let div = L.DomUtil.create("div", "legend");
    div.innerHTML += "<h4>Legenda</h4>";
    div.innerHTML += '<i class="icon bigger" style="background-image: url(/static/img/leaflet-biblio.png);background-repeat: no-repeat;"></i><span>Biblioteca</span><br>';
    div.innerHTML += '<i class="icon bigger" style="background-image: url(/static/img/wikipedia-icon.png);background-repeat: no-repeat;"></i><span>Approfondimento</span><br>';
    div.innerHTML += '<i class="icon bigger" style="background-image: url(/static/img/place-icon.png);background-repeat: no-repeat;"></i><span>Luogo di pubblicazione</span><br>';
    return div;
};
legend.addTo(map);

/* Search */

let isSearching = false;

async function searchPlaces() {

    let query = document.getElementById("search").value;
    if (isSearching || query === '') {
        return false
    }

    isSearching = true;

    clearAllLayers();

    try {
        const response = await axios.get(`/api/v2/search?q=${query}&expansions=${expansionsEnabled}`);

        response.data.map(function (value) {
            if (value.type.includes('biblio')) {
                let markers = generateNumberedBiblioMarker(value);
                layers.push(markers[0]);
                layers.push(markers[1]);
                oms.addMarker(markers[0]);
            }
        });

        let group = L.featureGroup(layers);

        setTimeout(function () {

            try {
                map.fitBounds(group.getBounds(), {paddingTopLeft: [100, 150], paddingBottomRight: [100, 50]});
            } catch (error) {
                isSearching = false;
                console.error(error);
            }

            setTimeout(function () {
                group.addTo(map);

                isSearching = false;

                // Attiva automaticamente popup se il risultato è uno solo
                setTimeout(function () {
                    let opened = false;
                    layers.forEach(function (layer) {
                        if (!opened && layer instanceof L.Marker && response.data.length === 1) {
                            opened = true;
                            clickZoom(layer);

                            setTimeout(function () {
                                layer.openPopup();

                                setTimeout(function () {
                                    let b = response.data[0];
                                    if (b.type === 'biblio') {
                                        if (b.records.length === 1) {
                                            // Exact record match
                                            let id = b.records[0].record_id;
                                            document.getElementById(id).click();
                                        }
                                    }
                                }, 500);

                            }, 300);
                        }
                    })
                }, 700);

            }, 800);
        }, 500);

    } catch (error) {
        isSearching = false;
        console.error(error);
    }
}

/* Autocomplete */

$('#search').autocomplete({
    groupBy: 'category',
    triggerSelectOnValidInput: false,
    lookup: function (query, done) {
        axios.get(`/api/v2/autocomplete?q=${query}`).then(function (response) {
            done(response.data);
        });
    },
    onSelect: function () {
        searchPlaces();
    }
});

/* Markers */

function generateNumberedBiblioMarker(biblio) {

    let coords = [Number(biblio.biblio_coords.split(',')[0]), Number(biblio.biblio_coords.split(',')[1])];

    let className = biblio.records.length.toString().length > 2 ? 'marker-numbered-icon-smaller' : 'marker-numbered-icon';
    let numberClassName = biblio.records.length.toString().length > 2 ? 'numbered-text-smaller' : 'numbered-text';

    let rDuration = getRandomInt(400, 700);
    let rHeight = getRandomInt(50, 70);
    let rLoop = getRandomInt(2, 4);

    let icon1 = L.marker(coords, {
        icon: biblioIcon,
        bounceOnAdd: true,
        bounceOnAddOptions: {duration: rDuration, height: rHeight, loop: rLoop}
    });

    icon1.data = {name: biblio.biblio_name};
    icon1.type = "biblio";

    icon1.bindTooltip(biblio.biblio_name, {
        className: biblio.biblio_name.length > 30 ? "marker-label-longer" : "marker-label",
        direction: biblio.biblio_id === "CBRSA" ? "right" : "left",
        offset: biblio.biblio_id === "CBRSA" ? [25, -15] : [-20, -15]
    });

    let icon2 = L.marker(coords, {
        icon: L.divIcon({
            className: className,
            html: `<span class=${numberClassName}>${biblio.records.length}</span>`,
            iconSize: [22, 22],
            iconAnchor: [0, 42],
            popupAnchor: [-3, -30]
        }),
        bounceOnAdd: true,
        bounceOnAddOptions: {duration: rDuration, height: rHeight, loop: rLoop}
    });

    let query = document.getElementById("search").value;

    let div = document.createElement("div");
    div.className = "landmark";
    div.style.width = '300px';

    let title = div.appendChild(document.createElement("h1"));
    title.textContent = biblio.biblio_name.includes('Consiglio Regione Toscana') ? biblio.biblio_name.split(' -')[0] : biblio.biblio_name;

    let scrollable = div.appendChild(document.createElement("div"));
    scrollable.className = "scrollable";

    let section = scrollable.appendChild(document.createElement("section"));

    biblio.records.forEach(function (r) {
        let hoverable = section.appendChild(document.createElement("div"));
        hoverable.className = "hoverable";

        let p = hoverable.appendChild(document.createElement("p"));
        p.className = `record-title`;
        p.id = r.record_id;

        p.innerHTML = generateRecordInnerHTML(r, query);

        $(document).on('click', '#' + r.record_id, function () {

            // resetta background record attivo
            map.eachLayer(function (layer) {
                if (layer instanceof L.Marker && layer.type === 'biblio') {
                    for (let item of layer._popup._content.children[1].children[0].children) {
                        item.classList.remove('is-active');
                    }
                }
            });
            hoverable.classList.toggle('is-active');

            icon1.getPopup().bringToBack();

            fetchFullRecordAndShowCurves(r.record_id);
        });

        let i = p.appendChild(document.createElement("i"));
        i.className = "right-arrow";

        let gap = section.appendChild(document.createElement("div"));
        gap.className = "gap";
    });

    icon1.bindPopup(div, {autoClose: false, closeOnClick: false});

    icon1.on('popupopen', function() {
        map.eachLayer(function (layer) {
            if (layer instanceof L.Marker && layer._popup && (layer.data === undefined || layer.data.name !== icon1.data.name)) {
                layer.closePopup();
            }
        });
    });

    return [icon1, icon2];
}

let isFetching = false;
function fetchFullRecordAndShowCurves(id) {

    if (isFetching) {
        return false;
    }
    isFetching = true;

    axios.get(`/api/v1/get_full_record?record_id=${id}`).then(function (r) {

        setUpSidebar(r.data);

        if (expansionsEnabled) {

            additionalLayers.map(function (c) {
                c.remove();
            });
            additionalLayers = [];

            let record = r.data,
                biblio_coords = latLngFromString(record.biblio_coords),
                place_coords = latLngFromString(record.published_in_coords);

            let lay = [];
            let realLay = [L.marker(biblio_coords)];

            let toAdd = [];

            // Luogo di pubblicazione
            if (record.published_in !== 'Firenze') {
                let ldp_marker = generateMarkerForPlace(place_coords, record.published_in);
                toAdd.push({marker: ldp_marker, type: 'place', coords: place_coords, color: 'red', dash: true, text:'Luogo di pubblicazione: ' + record.published_in, needsArrow: false});
                realLay.push(ldp_marker);
            }

            // Entità
            let coords = [],
                dupeCoord = '';

            record.entities.forEach(function (entity) {
                if (entity.title !== 'Firenze') {

                    if (coords.includes(entity.coords)) {
                        dupeCoord = entity.coords;
                    } else {
                        coords.push(entity.coords);
                    }

                    let entity_coords = latLngFromString(entity.coords),
                        marker = generateMarkerForEntity(entity);

                    let needsArrow = !bounds.contains(entity_coords);
                    if (!needsArrow) {
                        realLay.push(marker);
                    }
                    toAdd.push({marker: marker, type: 'entity', coords: entity_coords, color: 'black', dash: false, text: 'Entità: ' + entity.title, needsArrow: needsArrow});

                }
            });

            // Entità multiple
            if (dupeCoord !== '') {
                let i = 0;
                toAdd.filter(function (value) {
                    return stringFromLatLng(value.coords) === dupeCoord;
                }).forEach(function (value) {
                    value.text = i === 0 ? 'Entità multiple' : '';
                    i++;
                    add(value.marker, value.type, value.coords, value.color, value.dash, value.text, value.needsArrow)
                });
            } else {
                // toAdd.forEach(function (value) {
                //     add(value.marker, value.type, value.coords, value.color, value.dash, value.text, value.needsArrow)
                // });
                coords = toAdd.map(function (value) {
                    return value.coords;
                });

                let done = [];
                coords.forEach(function (c1) {

                    let s1 = stringFromLatLng(c1);
                    if (!done.includes(s1)) {
                        done.push(s1);

                        coords.forEach(function (c2) {

                            let s2 = stringFromLatLng(c2);

                            if (!done.includes(s2)) {
                                done.push(s2);

                                if (map.distance(c1, c2) < 20000) {
                                    toAdd.filter(function (value) {
                                        return stringFromLatLng(value.coords) === s2 || stringFromLatLng(value.coords) === s1;
                                    }).forEach(function (value) {
                                        add(value.marker, value.type, value.coords, value.color, value.dash, '', value.needsArrow)
                                    });
                                } else {
                                    toAdd.filter(function (value) {
                                        return stringFromLatLng(value.coords) === s2 || stringFromLatLng(value.coords) === s1;
                                    }).forEach(function (value) {
                                        add(value.marker, value.type, value.coords, value.color, value.dash, value.text, value.needsArrow)
                                    });
                                }
                            }
                        });
                    }
                });

                if (done.length === 1) {
                    toAdd.forEach(function (value) {
                        add(value.marker, value.type, value.coords, value.color, value.dash, value.text, value.needsArrow)
                    });
                }

            }

            function add(marker, type, coords, color, dash, text, needsArrow) {
                if (!isDuplicate(marker, type) && !markerExists(marker)) {

                    oms.addMarker(marker);
                    additionalLayers.push(marker);
                    lay.push(marker);

                    let curve = bezierCurve(biblio_coords, coords, color, dash, text, needsArrow);
                    additionalLayers.push(curve);
                    lay.push(curve);
                }
            }

            let realGroup = L.featureGroup(realLay);
            let group = L.featureGroup(lay);

            map.fitBounds(realGroup.getBounds(), {paddingTopLeft: [50, 230], paddingBottomRight: [50, 50]});
            setTimeout(function () {
                group.addTo(map);
                isFetching = false;
            }, 600);
        }

    });
}

function showBiblioOnMap(biblio) {

    let lat1 = Number(biblio.old_coords.split(',')[0]);
    let long1 = Number(biblio.old_coords.split(',')[1]);

    let lat2 = Number(biblio.new_coords.split(',')[0]);
    let long2 = Number(biblio.new_coords.split(',')[1]);

    let rDuration = getRandomInt(400, 700);
    let rHeight = getRandomInt(50, 70);
    let rLoop = getRandomInt(2, 4);

    let marker = L.marker([lat2, long2], {
        icon: biblioIcon,
        bounceOnAdd: true,
        bounceOnAddOptions: {duration: rDuration, height: rHeight, loop: rLoop}
    });

    marker.data = {name: biblio.name};
    marker.type = "biblio";

    marker.bindTooltip(biblio.name, {
        className: biblio.name.length > 30 ? "marker-label-longer" : "marker-label",
        direction: biblio.id === "CBRSA" ? "right" : "left",
        offset: biblio.id === "CBRSA" ? [25, -15] : [-20, -15]
    });

    let div = document.createElement("div");
    div.className = "landmark";
    div.style.width = '300px';

    let title = div.appendChild(document.createElement("h1"));
    title.textContent = biblio.name;
    title.style.fontSize = '15px';

    let scrollable = div.appendChild(document.createElement("div"));
    scrollable.className = "scrollable";

    let section = scrollable.appendChild(document.createElement("section"));

    let content = section.appendChild(document.createElement("p"));
    content.style.wordBreak = 'break-word';
    content.style.marginTop = '5px';
    content.style.marginBottom = '7px';
    content.innerHTML = biblio.info.split(' - ').slice(0, 2).join('<br>');
    let link = biblio.info.split(' - ')[2];
    let isMail = link.includes('@');
    let href = isMail ? 'mailto:' + link : link;
    content.innerHTML += `<br><a href='${href}'>${link}`;

    marker.bindPopup();
    marker.setPopupContent(div);

    if (!isDuplicate(marker, 'biblio')) {
        layers = [];
        oms.addMarker(marker);
        additionalLayers.push(marker);
        layers.push(marker);
    }
    let curve = bezierCurve([lat1, long1], [lat2, long2], 'red', true);
    additionalLayers.push(curve);
    layers.push(curve);

    let group = L.featureGroup(layers);

    map.fitBounds(group.getBounds(), {paddingTopLeft: [150, 200], paddingBottomRight: [450, 180]});
    setTimeout(function () {
        group.addTo(map);
    }, 600);
}

function generateMarkerForEntity(entity) {
    let marker = L.marker(latLngFromString(entity.coords), {
        icon: wikiIcon,
        bounceOnAdd: true,
        bounceOnAddOptions: {duration: 1000, height: 70, loop: 3}
    });
    marker.data = {name: entity.title};
    marker.bindPopup();
    marker.bindTooltip(entity.title, {direction: "right", className: "marker-label", offset: [18, -10]});

    marker.type = 'entity';

    let div = document.createElement("div");
    div.className = "landmark";
    div.style.width = "220px";

    let title = div.appendChild(document.createElement("h1"));
    title.style.fontSize = '15px';
    title.textContent = entity.title;

    let scrollable = div.appendChild(document.createElement("div"));
    scrollable.className = "scrollable";

    if (entity.image_url !== '') {
        let img = scrollable.appendChild(document.createElement("img"));
        img.setAttribute("src", entity.image_url);
        img.setAttribute("width", "220");
        img.setAttribute("height", "80");
    }

    let section = scrollable.appendChild(document.createElement("section"));

    let coords = section.appendChild(document.createElement("div"));
    coords.className = "coords";
    let split_coords = entity.coords.split(',');
    coords.textContent = split_coords[0].substr(0, 10) + ', ' + split_coords[1].substr(0, 10);

    let abstract = section.appendChild(document.createElement("p"));
    abstract.className = "abstract";
    abstract.textContent = entity.abstract;

    let uri = section.appendChild(document.createElement("p"));
    uri.className = "wikipedia-link";
    let a = uri.appendChild(document.createElement("a"));
    a.href = entity.uri;
    a.target = "_blank";
    a.textContent = "Vedi su Wikipedia →".toUpperCase();

    marker.setPopupContent(div);
    return marker;
}

function generateMarkerForPlace(coords, name) {
    let marker = L.marker(coords, {
        icon: placeIcon,
        bounceOnAdd: true,
        bounceOnAddOptions: {duration: 1000, height: 70, loop: 3}
    });
    marker.bindTooltip(name, {direction: "right", className: "marker-label", offset: [18, -10]});
    marker.type = 'place';
    marker.data = {name: name};
    return marker;
}

/* Sidebar */

function setUpSidebar(record) {

    let infoId = 'info-' + record.id;
    let filterId = 'filter-' + record.id;

    sidebar.removePanel(infoId);
    sidebar.addPanel({
        id: infoId,
        tab: '<i class="fa fa-info" style="color: white">',
        pane: sidebarInfoPane(record).innerHTML,
        title: 'Informazioni <span class="leaflet-sidebar-close"></span>',
        button: function () {
            sidebar.open(infoId);
        }
    });

    sidebar.removePanel(filterId);
    sidebar.addPanel({
        id: filterId,
        tab: '<i class="fa fa-filter" style="color: white"></i>',
        title: 'Collegamenti <span class="leaflet-sidebar-close"></span>',
        pane: sidebarFiltersPane(record).innerHTML,
        button: function () {
            sidebar.open(filterId);
        }
    });

    openedInfoPanes.forEach(function (id) {
        if (id !== infoId && id !== filterId) {
            sidebar.removePanel(id);
        }
    });

    openedInfoPanes = [infoId, filterId];

    showSidebar();
    sidebar.close();
}

function sidebarInfoPane(record) {

    let div = document.createElement("div");
    div.id = `res-pane-${record.id}`;

    let h1 = div.appendChild(document.createElement("h4"));
    h1.textContent = record.title;

    if (record.biblio_name !== '') {
        appendLeftRightSidebarBiblioText('Collocazione: ', record.biblio_name, div);
    }
    if (record.creator !== '') {
        appendLeftRightSidebarText('Autore: ', record.creator, div);
    }
    if (record.contributor !== '') {
        appendLeftRightSidebarText('Autore secondario: ', record.contributor, div);
    }
    if (record.date !== '') {
        appendLeftRightSidebarText('Data: ', record.date, div);
    }
    if (record.description !== '') {
        appendLeftRightSidebarText('Descrizione: ', record.description, div);
    }
    if (record.format !== '') {
        appendLeftRightSidebarText('Formato: ', record.format, div);
    }
    if (record.language !== '') {
        appendLeftRightSidebarText('Lingua: ', record.language, div);
    }
    if (record.link !== '') {
        appendLeftRightSidebarTextWithHref('Link: ', record.link, div, record.link);
    }
    if (record.published_in !== '') {
        appendLeftRightSidebarPublishedInText('Luogo di pubblicazione: ', record.published_in, div);
    }
    if (record.publisher !== '') {
        appendLeftRightSidebarText('Editore: ', record.publisher, div);
    }
    if (record.relation !== '') {
        appendLeftRightSidebarText('Relazione: ', record.relation, div);
    }
    if (record.subject !== '') {
        appendLeftRightSidebarText('Soggetti: ', record.subject, div);
    }
    if (record.type !== '') {
        appendLeftRightSidebarText('Tipo: ', record.type, div);
    }
    if (record.viaf_id !== '') {
        appendLeftRightSidebarTextWithHref('Viaf ID autore: ', record.viaf_id, div, 'https://viaf.org/viaf/' + record.viaf_id);
    }
    if (record.author_other_works !== '') {
        appendLeftRightSidebarArrayText('Altre pubblicazioni (fonte VIAF): ', record.author_other_works.split('~~'), div);
    }
    if (record.author_wiki_info !== '') {
        appendLeftRightSidebarText('Biografia Wikipedia Autore: ', record.author_wiki_info, div);
    }
    if (record.author_wiki_page !== '') {
        appendLeftRightSidebarTextWithHref('Link Wikipedia Autore: ', record.author_wiki_page, div, record.author_wiki_page);
    }
    if (record.entities.length > 0) {
        appendLeftRightSidebarEntitiesText('Entità trovate nel campo descrizione/autore/soggetti: ', record.entities, record.biblio_coords, div);
    }
    return div;
}

function sidebarFiltersPane(record) {
    let div = document.createElement("div");

    let h4 = div.appendChild(document.createElement("h4"));
    h4.style.fontSize = '20px';
    h4.style.fontWeight = '500';
    h4.style.marginBottom = '0px';
    h4.textContent = "Filtri avanzati di ricerca";

    let h5 = div.appendChild(document.createElement("h5"));
    h5.style.fontSize = '13px';
    h5.style.fontWeight = 'normal';
    h5.style.color = 'gray';
    h5.style.marginTop = '3px';
    h5.style.marginBottom = '13px';
    h5.textContent = "Scopri altri libri correlati con questo";

    let form = div.appendChild(document.createElement("form"));

    if (record.creator !== '') {
        createCheckbox('filter_autore_' + record.id, 'Solo libri di questo autore (' + record.creator.split(' <')[0] + ')', form);
    }

    if (record.biblio_name !== '') {
        createCheckbox('filter_biblio_' + record.id, 'Solo libri in questa biblioteca (' + record.biblio_name + ')', form);
    }

    if (record.publisher !== '') {
        createCheckbox('filter_casa_editrice_' + record.id, 'Solo libri con questo editore (' + record.publisher.split(' <')[0] + ')', form);
    }

    if (record.published_in !== '') {
        createCheckbox('filter_pub_' + record.id, 'Solo libri pubblicati a ' + record.published_in, form);
    }

    if (record.entities.length > 0) {
        createElenco('filter_args_' + record.id, record.entities, 'Tutti gli argomenti', 'Filtra per argomenti in comune:', form);
    }

    createDateInputs('filter_date1_' + record.id, 'filter_date2_' + record.id, 'Filtra per data di pubblicazione:', form);

    createSubmitButton('filter_submit_' + record.id, 'Cerca', form);

    let filter_results_title = div.appendChild(document.createElement("h4"));
    filter_results_title.id = "filter_results_title_" + record.id;

    let section = div.appendChild(document.createElement("section"));
    section.id = "filter_results_section_" + record.id;

    $(document).on('click', '#filter_submit_' + record.id, function (e) {
        e.preventDefault();

        let author = '';
        if (document.getElementById("filter_autore_" + record.id) && document.getElementById("filter_autore_" + record.id).checked) {
            author = record.creator;
        }

        let publisher = '';
        if (document.getElementById("filter_casa_editrice_" + record.id) && document.getElementById("filter_casa_editrice_" + record.id).checked) {
            publisher = record.publisher;
        }

        let biblio = '';
        if (document.getElementById("filter_biblio_" + record.id) && document.getElementById("filter_biblio_" + record.id).checked) {
            biblio = record.biblio_name;
        }

        let pub = '';
        if (document.getElementById("filter_pub_" + record.id) && document.getElementById("filter_pub_" + record.id).checked) {
            pub = record.published_in;
        }

        let arg_id = '';
        if (document.getElementById("filter_args_" + record.id)) {
            if (document.getElementById("filter_args_" + record.id).value !== 'Tutti gli argomenti') {
                arg_id = document.getElementById("filter_args_" + record.id).value;
            }
        }

        let date_1 = '';
        let date_2 = '';
        if (document.getElementById("filter_date1_" + record.id)) {
            date_1 = document.getElementById("filter_date1_" + record.id).value;
        }
        if (document.getElementById("filter_date2_" + record.id)) {
            date_2 = document.getElementById("filter_date2_" + record.id).value;
        }
        let rangeDate = '';
        if (date_1 === '') {
            if (date_2 === '') {
                rangeDate = '';
            } else {
                rangeDate = '1912,' + date_2;
            }
        } else {
            if (date_2 === '') {
                rangeDate = date_1 + ',2009'
            } else {
                rangeDate = date_1 + ',' + date_2
            }
        }

        axios.get(`/api/v1/related?author=${author}&publisher=${publisher}&biblio=${biblio}&pub=${pub}&arg_id=${arg_id}&dates=${rangeDate}`).then(function (response) {

            let section = document.getElementById("filter_results_section_" + record.id);
            section.innerHTML = '';

            let resCount = 0;

            response.data.forEach(function (r) {

                if (record.id !== r.id) {
                    let hoverable = section.appendChild(document.createElement("div"));
                    hoverable.className = "hoverable res";

                    let p = hoverable.appendChild(document.createElement("p"));
                    p.className = `record-title res`;

                    p.innerHTML = r.title + generateOtherTextWithBiblio(r);
                    p.onclick = function () {
                        let b = {
                            old_coords: record.biblio_coords,
                            new_coords: r.biblio_coords,
                            name: r.biblio_name,
                            id: r.biblio_id,
                            info: r.biblio_info
                        }

                        // todo
                        //fetchRecordAndPushPanel(r.id, record.biblio_coords !== r.biblio_coords, b);
                    };

                    let gap = section.appendChild(document.createElement("div"));
                    gap.className = "gap";

                    resCount++;
                }
            });

            if (section.childElementCount === 0) {
                document.getElementById("filter_results_title_" + record.id).textContent = "Nessun risultato trovato";
            } else {
                let ori = resCount === 1 ? ' risultato trovato:' : ' risultati trovati:';
                document.getElementById("filter_results_title_" + record.id).textContent = resCount.toString() + ori;
            }
        });
    });

    return div;
}

function appendLeftRightSidebarText(left, right, div) {
    let p = div.appendChild(document.createElement("p")),
        bold = div.appendChild(document.createElement('strong')),
        left_text = document.createTextNode(left),
        right_text = document.createTextNode(right);
    bold.appendChild(left_text);
    p.appendChild(bold);
    p.appendChild(right_text);
}

function appendLeftRightSidebarPublishedInText(left, right, div) {
    let p = div.appendChild(document.createElement("p")),
        bold = div.appendChild(document.createElement('strong')),
        left_text = document.createTextNode(left),
        right_text = document.createTextNode(right);

    let img = document.createElement("img");
    img.setAttribute("src", "../static/img/place-icon.png");
    img.setAttribute("height", "15px");
    img.style.marginLeft = '5px';
    img.style.marginBottom = '2px';

    bold.appendChild(left_text);
    p.appendChild(bold);
    p.appendChild(right_text);
    p.appendChild(img);
}

function appendLeftRightSidebarBiblioText(left, right, div) {
    let p = div.appendChild(document.createElement("p")),
        bold = div.appendChild(document.createElement('strong')),
        left_text = document.createTextNode(left),
        right_text = document.createTextNode(right + ' '),
        span = document.createElement('span');

    span.appendChild(left_text);
    span.style.color = "red";

    bold.appendChild(span);
    p.appendChild(bold);
    p.appendChild(right_text);
}

function appendLeftRightSidebarBiblioTextWithHref(left, biblio, div) {
    let p = div.appendChild(document.createElement("p")),
        bold = div.appendChild(document.createElement('strong')),
        left_text = document.createTextNode(left),
        right_text = document.createTextNode(biblio.name + ' '),
        span = document.createElement('span');

    let a2 = document.createElement("a");
    a2.href = '#';
    a2.id = 'show_biblio_' + biblio.id;
    a2.textContent = '(vedi su mappa)';
    a2.style.color = "#ad0000";

    a2.appendChild(document.createTextNode('\u00A0'));
    let img = a2.appendChild(document.createElement("img"));
    img.setAttribute("src", "../static/img/leaflet-biblio.png");
    img.setAttribute("height", "15px");
    img.style.marginLeft = '3px';
    img.style.marginBottom = '2px';

    $(document).on('click', '#' + 'show_biblio_' + biblio.id, function () {
        showBiblioOnMap(biblio);
    });

    span.appendChild(left_text);

    bold.appendChild(span);
    p.appendChild(bold);
    p.appendChild(right_text);
    p.appendChild(a2);
}

function appendLeftRightSidebarTextWithHref(left, right, div, uri) {
    let p = div.appendChild(document.createElement("p")),
        bold = div.appendChild(document.createElement('strong')),
        left_text = document.createTextNode(left);

    let a = document.createElement("a");
    a.href = uri;
    a.target = "_blank";
    a.textContent = right;

    bold.appendChild(left_text);
    p.appendChild(bold);
    p.appendChild(a);
}

function appendLeftRightSidebarArrayText(left, right, div) {
    let p = div.appendChild(document.createElement("p")),
        bold = div.appendChild(document.createElement('strong')),
        left_text = document.createTextNode(left);

    let ul = document.createElement("ul");
    right.forEach(function (value) {
        let li = document.createElement("li");
        li.textContent = value;
        ul.appendChild(li);
    });

    bold.appendChild(left_text);
    p.appendChild(bold);
    p.appendChild(ul);
}

function appendLeftRightSidebarEntitiesText(left, right, biblio_coords, div) {
    let p = div.appendChild(document.createElement("p")),
        bold = div.appendChild(document.createElement('strong')),
        left_text = document.createTextNode(left);

    let ul = document.createElement("ul");
    right.forEach(function (entity) {
        let li = document.createElement("li");

        let a = li.appendChild(document.createElement("a"));
        a.href = entity.uri;
        a.target = "_blank";
        a.textContent = entity.title;

        let img = a.appendChild(document.createElement("img"));
        img.setAttribute("src", "../static/img/wikipedia-icon.png");
        img.setAttribute("height", "15px");
        img.style.marginLeft = '5px';
        img.style.marginBottom = '2px';

        let p = li.appendChild(document.createElement("p"));
        p.textContent = entity.abstract;

        ul.appendChild(li);

        $(document).on('click', '#' + 'show_' + entity.id, function () {
            showEntityOnMap(biblio_coords, entity);
        });
    });

    bold.appendChild(left_text);
    p.appendChild(bold);
    p.appendChild(ul);
}


/* Filters */

function createCheckbox(id, labl, div) {
    let checkbox = document.createElement('input');
    checkbox.type = "checkbox";
    checkbox.name = id;
    checkbox.value = id;
    checkbox.id = id;
    checkbox.style.marginRight = '8px';
    checkbox.style.position = 'absolute';
    checkbox.style.marginTop = '4px';

    let label = document.createElement('label');
    label.htmlFor = id;
    label.style.fontSize = '14px';
    label.style.marginLeft = '20px';
    label.appendChild(document.createTextNode(labl));

    div.appendChild(checkbox);
    div.appendChild(label);
    div.appendChild(document.createElement('br'));
}

function createElenco(id, args, def, labl, div) {
    let select = document.createElement('select');
    select.name = "args";
    select.id = id;
    select.style.width = '150px';
    select.style.marginLeft = '7px';

    let option = document.createElement('option');
    option.appendChild(document.createTextNode(def));
    select.appendChild(option);

    args.forEach(function (arg) {
        let option = document.createElement('option');
        option.value = arg.id;
        option.appendChild(document.createTextNode(arg.title));
        select.appendChild(option);
    });

    let label = document.createElement('label');
    label.htmlFor = id;
    label.style.fontSize = '14px';
    label.appendChild(document.createTextNode(labl));

    div.appendChild(label);
    div.appendChild(select);
    div.appendChild(document.createElement('br'));
}

function createSubmitButton(id, label, div, func) {

    let submit = document.createElement('button');
    submit.type = "submit";
    submit.className = "btn btn-primary btn-sm";
    submit.id = id;
    submit.onclick = func;

    submit.appendChild(document.createTextNode("Cerca"));

    div.appendChild(submit);

    div.appendChild(document.createElement('br'));
    div.appendChild(document.createElement('br'));
}

function createDateInputs(id1, id2, label, div) {

    let label0 = document.createElement('label');
    label0.style.fontSize = '14px';
    label0.appendChild(document.createTextNode(label));

    let label1 = document.createElement('label');
    label1.style.fontSize = '14px';
    label1.style.marginLeft = '5px';
    label1.style.marginRight = '5px';
    label1.appendChild(document.createTextNode('da'));

    let input1 = document.createElement('input');
    input1.type = "text";
    input1.name = id1;
    input1.id = id1;
    input1.placeholder = "1912";
    input1.style.width = '40px';

    let label2 = document.createElement('label');
    label2.style.fontSize = '14px';
    label2.style.marginLeft = '5px';
    label2.style.marginRight = '5px';
    label2.appendChild(document.createTextNode(' a '));

    let input2 = document.createElement('input');
    input2.type = "text";
    input2.name = id2;
    input2.id = id2;
    input2.placeholder = "2009";
    input2.style.width = '40px';

    div.appendChild(label0);
    div.appendChild(label1);
    div.appendChild(input1);
    div.appendChild(label2);
    div.appendChild(input2);
    div.appendChild(document.createElement('br'));
}

function generateOtherTextWithBiblio(r) {
    let otherText0 = '';
    if (r.biblio_name !== '') {
        let n = r.biblio_name;
        if (n.includes('Consiglio Regione Toscana')) {
            n = n.split(' -')[0];
        }
        otherText0 = `Collocazione: ${n}`;
    }

    let otherText1 = '';
    if (r.creator !== '') {
        otherText1 = `Autore: ${r.creator.split(' <')[0]}`;
    } else {
        if (r.contributor !== '') {
            otherText1 = `Autore secondario: ${r.contributor}`;
        }
    }

    let otherText2 = '';
    if (r.place_name !== '') {
        otherText2 = `Pubblicato a: ${r.place_name}`;
        if (r.publisher !== '') {
            otherText2 += ` • Editore: ${r.publisher}`;
            if (r.date !== '') {
                otherText2 += ` • ${r.date}`;
            }
        } else {
            if (r.publisher !== '') {
                otherText2 = `Editore: ${r.publisher}`;
                if (r.date !== '') {
                    otherText2 += ` • ${r.date}`;
                }
            } else {
                if (r.date !== '') {
                    otherText2 = `Pubblicato nel ${r.date}`;
                }
            }
        }
    }

    if (otherText0 !== '') {
        if (otherText1 !== '') {
            if (otherText2 !== '') {
                return '<br>' + '<span class="record-smaller">' + otherText0 + '<br>' + otherText1 + '<br>' + otherText2 + '</span>';
            } else {
                return '<br>' + '<span class="record-smaller">' + otherText0 + '<br>' + otherText1 + '</span>';
            }
        } else {
            if (otherText2 !== '') {
                return '<br>' + '<span class="record-smaller">' + otherText0 + '<br>' + otherText2 + '</span>';
            } else {
                return '';
            }
        }
    } else {
        if (otherText1 !== '') {
            if (otherText2 !== '') {
                return '<br>' + '<span class="record-smaller">' + otherText1 + '<br>' + otherText2 + '</span>';
            } else {
                return '<br>' + '<span class="record-smaller">' + otherText1 + '</span>';
            }
        } else {
            if (otherText2 !== '') {
                return '<br>' + '<span class="record-smaller">' + otherText2 + '</span>';
            } else {
                return '';
            }
        }
    }
}

/* Coordinates */

L.Map.prototype.setViewOffset = function (latlng, offset) {
    let targetPoint = this.project(latlng, this.getZoom()).subtract(offset),
        targetLatLng = this.unproject(targetPoint, this.getZoom());
    return this.panTo(targetLatLng, this.getZoom());
};

function clickZoom(marker) {
    let offset = map.getZoom() <= 9 ? 120 : 105;
    let off2 = 0;
    let off = document.querySelector('.leaflet-sidebar-content').getBoundingClientRect().width;
    if (off > 0) {
        off2 = -off / 2;
    }
    map.setViewOffset(marker.getLatLng(), [off2, offset]);
}


/* Utils */

function latLngFromString(string) {
    return [Number(string.split(',')[0]), Number(string.split(',')[1])];
}

function stringFromLatLng(coord) {
    return coord[0].toString() + ',' + coord[1].toString();
}

function generateRecordInnerHTML(record, query) {

    query = query.toLowerCase();

    let base = record.title;
    if (record.creator !== '')
        base += '<br>' + '<span class="record-smaller">Autore: ' + record.creator + '</span>';
    else if (record.contributor !== '')
        base += '<br>' + '<span class="record-smaller">Autore secondario: ' + record.contributor + '</span>';

    if (record.title.toLowerCase().includes(query) || record.creator.toLowerCase().includes(query) || record.contributor.toLowerCase().includes(query)) {
        return boldString(base, query);
    } else if (record.description.toLowerCase().includes(query)) {
        base += '<br>' + generateTextQueryBounds(record.description, query, 'Descrizione');
        return boldString(base, query);
    } else if (record.subject.toLowerCase().includes(query)) {
        base += '<br>' + generateTextQueryBounds(record.subject, query, 'Soggetti');
        return boldString(base, query);
    } else if (record.publisher.toLowerCase().includes(query)) {
        base += '<br>' + generateTextQueryBounds(record.publisher, query, 'Editore');
        return boldString(base, query);
    }
    return base;
}

function generateTextQueryBounds(text, query, section) {
    let splits = text.toLowerCase().split(query);
    let first = splits[0].split(" ").slice(-4).join(" ");
    let second = splits[1].split(" ").slice(0, 4).join(" ");
    return '<span class="record-smaller">' + section + ': [...] ' + first + query + second + ' [...]' + '</span>';
}

function isDuplicate(marker, type) {
    let dupe = false;
    additionalLayers.forEach(function (layer) {
        if (layer instanceof L.Marker && !dupe) {
            if (layer.data.name === marker.data.name) {
                dupe = (layer.type === type);
            }
        }
    });
    return dupe;
}

function markerExists(marker) {
    let dupe = false;
    additionalLayers.forEach(function (layer) {
        if (layer instanceof L.Marker && !dupe) {
            if (layer.data.name === marker.data.name) {
                dupe = (layer.type !== marker.type);
            }
        }
    });
    return dupe;
}

function clearAllLayers() {
    try {
        layers.map(function (c) {
            c.remove();
        });
        layers = [];
        additionalLayers.map(function (c) {
            c.remove();
        });
        additionalLayers = [];

        sidebar.close();
        hideSidebar();
        oms.clearMarkers();
    } catch (e) {
        console.log(e.message);
    }
}

function showSidebar() {
    let sidebar = document.getElementById('sidebar');
    sidebar.classList.remove('hidden');
}

function hideSidebar() {
    let sidebar = document.getElementById('sidebar');
    sidebar.classList.add('hidden');
}

function boldString(str, find) {
    let re = new RegExp(find, 'i');
    return str.replace(re, '<b>$&</b>');
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// mid point from https://gist.github.com/ryancatalani/6091e50bf756088bf9bf5de2017b32e6

function bezierCurve(from, to, color, dash, text, needsArrow) {
    let offsetX = to[1] - from[1],
        offsetY = to[0] - from[0];
    let r = Math.sqrt(Math.pow(offsetX, 2) + Math.pow(offsetY, 2)),
        theta = Math.atan2(offsetY, offsetX);
    let thetaOffset = (3.14 / 10);
    let r2 = (r / 2) / (Math.cos(thetaOffset)),
        theta2 = theta + thetaOffset;
    let midpointX = (r2 * Math.cos(theta2)) + from[1],
        midpointY = (r2 * Math.sin(theta2)) + from[0];
    let midpointLatLng = [midpointY, midpointX];
    let pathOptions = {color: color, animate: 600, weight: needsArrow ? 0 : 1, dashArray: dash ? 5 : 0};

    let curve = L.curve(['M', from, 'Q', midpointLatLng, to], pathOptions);

    let i,
        points = [];
    let precision = 100;
    for (i = 0; i < precision + 1; i++) {
        points.push(getBezierPoint(i / precision, from[0], from[1], midpointLatLng[0], midpointLatLng[1], to[0], to[1]));
    }
    let dummyPolyline = L.polyline(points, {opacity: 0, weight: 0, color: color});
    dummyPolyline.setText(text, {center: true, offset: -8, orientation: 'auto', allowCrop: false});

    let dummyPolyline2 = L.polyline(points, {weight: needsArrow ? 1 : 0, color: color, opacity: 1});
    dummyPolyline2.setText('  ►  ', {center: true, offset: 7, allowCrop: false, edgeArrow: true, clickable: true, attributes: { 'font-size': '20' } }).on('click', function () {

        dummyPolyline2.setText(null);

        let group = L.featureGroup([L.marker(from), L.marker(to)]);
        map.fitBounds(group.getBounds(), {paddingTopLeft: [50, 230], paddingBottomRight: [50, 50]});
        setTimeout(function () {
            let found = false;
            additionalLayers.forEach(function (marker) {
                if (!found && marker.type === 'entity' && marker.getLatLng().lat === to[0] && marker.getLatLng().lng === to[1]) {
                    marker.openPopup();
                    found = true;
                }
            });
        }, 500);
    });

    curve.on('add', function () {
        setTimeout(function () {
            dummyPolyline.addTo(map);
            if (needsArrow) {
                dummyPolyline2.addTo(map);
                L.path.touchHelper(dummyPolyline2).addTo(map);
            }
        }, 100);
    });

    curve.on('remove', function () {
        dummyPolyline.remove();
        dummyPolyline.setText(null);
        if (needsArrow) {
            dummyPolyline2.setText(null);
            dummyPolyline2.remove();
        }
    });

    return curve;
}

function getBezierPoint(t, sx, sy, cpx, cpy, ex, ey) {
    return [
        Math.pow(1 - t, 2) * sx + 2 * t * (1 - t) * cpx + t * t * ex,
        Math.pow(1 - t, 2) * sy + 2 * t * (1 - t) * cpy + t * t * ey
    ]
}