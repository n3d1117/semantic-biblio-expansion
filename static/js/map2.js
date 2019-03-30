let osmUrl = 'http://{s}.tile.osm.org/{z}/{x}/{y}.png',
    osmAttrib = '&copy; <a href="http://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    osm = L.tileLayer.grayscale(osmUrl, {attribution: osmAttrib}),
    toscana = [43.4148394, 11.2210621],
    layers = [],
    additionalLayers = [],
    openedInfoPanes = [],
    infoCount = {};

let map = L.map('map', {
    maxZoom: 15,
    attributionControl: false,
    fadeAnimation: false
}).setView(toscana, 9).addLayer(osm);

let oms = new OverlappingMarkerSpiderfier(map, {keepSpiderfied: true, legWeight: 2});

oms.addListener('click', function (marker) {
    clickZoom(marker);
});

let greenIcon = new L.Icon({
    iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
let blueIcon = new L.Icon({
    iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
let biblioIcon = L.icon({
    iconUrl: '../static/img/leaflet-biblio.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [30, 30], shadowSize: [30, 35], iconAnchor: [18, 28], shadowAnchor: [4, 35], popupAnchor: [-3, -30]
});

let form = document.getElementById("search-form");
form.addEventListener('submit', function(e) {
    e.preventDefault();
});

let sidebar = L.control.sidebar({autopan: true, closeButton: true, container: 'sidebar', position: 'right'}).addTo(map);

/* Toggle expansions */

let expansionsEnabled = false;
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
    div.innerHTML += '<i class="icon" style="background-image: url(https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png);background-repeat: no-repeat;"></i><span>Approfondimento</span><br>';
    div.innerHTML += '<i class="icon" style="background-image: url(https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png);background-repeat: no-repeat;"></i><span>Luogo di pubblicazione</span>';
    return div;
};
legend.addTo(map);

/* Search */

let isSearching = false;
async function searchPlaces() {

    clearAllLayers();
    let query = document.getElementById("search").value;
    if (isSearching || query === '') {
        return false
    }

    isSearching = true;

    try {
        const response = await axios.get(`/api/v2/search?q=${query}&expansions=${expansionsEnabled}`);

        response.data.map(function (value) {
            if (value.type.includes('biblio')) {
                let markers = generateNumberedBiblioMarker(value);
                layers.push(markers[0]);
                layers.push(markers[1]);
                oms.addMarker(markers[0]);
            }
            if (value.type.includes('entity')) {
                let lat = Number(value.coords.split(',')[0]);
                let long = Number(value.coords.split(',')[1]);
                let marker = generateMarkerForEntity(lat, long, value, value.type === 'entity_exact_match');
                layers.push(marker);
                oms.addMarker(marker);
            }
        });

        let group = L.featureGroup(layers);

        setTimeout(function () {
            map.fitBounds(group.getBounds(), {paddingTopLeft: [150, 200], paddingBottomRight: [150, 200]});

            setTimeout(function () {
                group.addTo(map);

                isSearching = false;

                // Attiva automaticamente popup per marker esatti o se il risultato è uno solo
                setTimeout(function () {
                    let opened = false;
                    layers.forEach(function (layer) {
                        if (!opened && layer instanceof L.Marker && ((layer.data !== undefined && layer.data.exact) || response.data.length === 1)) {
                            opened = true;
                            layer.openPopup();
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

    icon1.data = { name: biblio.biblio_name };
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

    let div = document.createElement("div");
    div.className = "landmark";
    div.style.width = '300px';

    let title = div.appendChild(document.createElement("h1"));
    title.textContent = biblio.biblio_name;
    title.style.fontSize = '15px';

    let scrollable = div.appendChild(document.createElement("div"));
    scrollable.className = "scrollable";

    let section = scrollable.appendChild(document.createElement("section"));

    let content = section.appendChild(document.createElement("p"));
    content.style.wordBreak = 'break-word';
    content.style.marginTop = '5px';
    content.style.marginBottom = '7px';
    content.innerHTML = biblio.biblio_info.split(' - ').slice(0, 2).join('<br>');
    let link = biblio.biblio_info.split(' - ')[2];
    let isMail = link.includes('@');
    let href = isMail ? 'mailto:' + link : link;
    content.innerHTML += `<br><a href='${href}'>${link}`;

    icon1.bindPopup();
    icon1.setPopupContent(div);

    icon1.on('popupopen', function () {

        sidebar.removePanel(biblio.biblio_id);
        sidebar.addPanel({
            id: biblio.biblio_id,
            tab: '<i class="fa fa-bars" style="color: white"></i>',
            title: 'Risultati <span class="leaflet-sidebar-close"></span>',
            pane: generateSidebarBiblioContent(biblio),
        });

        sidebar.open(biblio.biblio_id);

        // Reset all panels except current one
        for (i = 0; i < sidebar._tabitems.length; i++) {
            if (sidebar._tabitems[i]._id !== biblio.biblio_id)
                sidebar.removePanel(sidebar._tabitems[i]._id);
        }
        openedInfoPanes.forEach(function(id) {
            sidebar.removePanel(id);
        });

        openedInfoPanes = [];
    });

    return [icon1, icon2];
}

function showPlaceOnMap(from_coords, to_coords, place_name) {

    let lat1 = Number(from_coords.split(',')[0]);
    let long1 = Number(from_coords.split(',')[1]);

    let lat2 = Number(to_coords.split(',')[0]);
    let long2 = Number(to_coords.split(',')[1]);

    let marker = generateMarkerForPlace(lat2, long2, place_name);

    layers = [];

    if (!isDuplicate(marker, 'place')) {
        oms.addMarker(marker);
        additionalLayers.push(marker);
        layers.push(marker);

        let curve = bezierCurve([lat1, long1], [lat2, long2], 'black');
        additionalLayers.push(curve);
        layers.push(curve);

        let group = L.featureGroup(layers);

        map.fitBounds(group.getBounds(), {paddingTopLeft: [150, 200], paddingBottomRight: [470, 200]});
        setTimeout(function () {
            group.addTo(map);
        }, 600);
    }
}

function showEntityOnMap(biblio_coords, entity) {

    let lat1 = Number(biblio_coords.split(',')[0]);
    let long1 = Number(biblio_coords.split(',')[1]);

    let lat2 = Number(entity.coords.split(',')[0]);
    let long2 = Number(entity.coords.split(',')[1]);

    let marker = generateMarkerForEntity(lat2, long2, entity);

    layers = [];

    if (!isDuplicate(marker, 'entity')) {
        oms.addMarker(marker);
        additionalLayers.push(marker);
        layers.push(marker);

        let curve = bezierCurve([lat1, long1], [lat2, long2], 'black');
        additionalLayers.push(curve);
        layers.push(curve);

        let group = L.featureGroup(layers);

        map.fitBounds(group.getBounds(), {paddingTopLeft: [150, 200], paddingBottomRight: [450, 180]});
        setTimeout(function () {
            group.addTo(map);
        }, 600);
    }
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
    div.style.width = '280px';

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

function generateMarkerForEntity(lat, long, entity, exact) {
    let marker = L.marker([lat, long], {
        icon: greenIcon,
        bounceOnAdd: true,
        bounceOnAddOptions: {duration: 1000, height: 70, loop: 3}
    });
    marker.data = {name: entity.title, exact: exact};
    marker.bindPopup();
    marker.bindTooltip(entity.title, {direction: "right", className: "marker-label", offset: [15, -20]});

    marker.type = 'entity';

    let div = document.createElement("div");
    div.className = "landmark";

    let title = div.appendChild(document.createElement("h1"));
    title.textContent = entity.title;

    let scrollable = div.appendChild(document.createElement("div"));
    scrollable.className = "scrollable";

    if (entity.image_url !== '') {
        let img = scrollable.appendChild(document.createElement("img"));
        img.setAttribute("src", entity.image_url);
        img.setAttribute("width", "250");
        img.setAttribute("height", "100");
    }

    let section = scrollable.appendChild(document.createElement("section"));

    let coords = section.appendChild(document.createElement("div"));
    coords.className = "coords";
    let split_coords = entity.coords.split(',');
    coords.textContent = split_coords[0].substr(0, 15) + ', ' + split_coords[1].substr(0, 15);

    let abstract = section.appendChild(document.createElement("p"));
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

function generateMarkerForPlace(lat, long, name) {
    let marker = L.marker([lat, long], {
        icon: blueIcon,
        bounceOnAdd: true,
        bounceOnAddOptions: {duration: 1000, height: 70, loop: 3}
    });
    marker.bindTooltip(name, {direction: "right", className: "marker-label", offset: [15, -20]});
    marker.type = 'place';
    marker.data = {name: name};
    return marker;
}

/* Sidebar */

function generateSidebarBiblioContent(biblio) {

    let query = document.getElementById("search").value;

    let div = document.createElement("div");

    let h4 = div.appendChild(document.createElement("h4"));

    let section = div.appendChild(document.createElement("section"));
    let resCount = 0;

    infoCount = {};

    biblio.records.forEach(function (r) {
        let hoverable = section.appendChild(document.createElement("div"));
        hoverable.className = "hoverable";

        let p = hoverable.appendChild(document.createElement("p"));
        p.className = `record-title`;
        p.id = r.record_id;

        p.innerHTML = boldString(r.title + generateOtherText(r), query);

        $(document).on('click', '#' + r.record_id, function() {
            fetchRecordAndPushPanel(r.record_id, false, {});
        });

        let i = p.appendChild(document.createElement("i"));
        i.className = "right-arrow";

        let gap = section.appendChild(document.createElement("div"));
        gap.className = "gap";

        resCount++;
    });

    let displayQuery = ' per "' + query + '" in questo archivio';
    if (section.childElementCount === 0) {
        h4.textContent = "Nessun risultato trovato" + displayQuery;
    } else {
        let ori = resCount === 1 ? ' risultato trovato' + displayQuery + ':' : ' risultati trovati' + displayQuery + ':';
        h4.textContent = resCount.toString() + ori;
    }

    return div.innerHTML;
}

function generateSidebarRecordContent(record, is_new_biblio, new_biblio) {

    let div = document.createElement("div");
    div.id = `res-pane-${record.id}`;

    let h1 = div.appendChild(document.createElement("h4"));
    h1.textContent = record.title;

    if (record.biblio_name !== '') {
        if (is_new_biblio) {
            appendLeftRightSidebarBiblioTextWithHref('Collocazione: ', new_biblio, div);
        } else {
            appendLeftRightSidebarBiblioText('Collocazione: ', record.biblio_name, div);
        }
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
        if (record.published_in !== 'Firenze') {
            appendLeftRightSidebarTextWithMapLink('Luogo di pubblicazione: ', record.published_in, record.id, record.biblio_coords, record.published_in_coords, div);
        } else {
            appendLeftRightSidebarText('Luogo di pubblicazione: ', record.published_in, div);
        }
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

    div.append(generateFiltersPane(record));

    return div.innerHTML;
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

function appendLeftRightSidebarTextWithMapLink(left, right, record_id, from_coords, to_coords, div) {
    let p = div.appendChild(document.createElement("p")),
        bold = div.appendChild(document.createElement('strong')),
        left_text = document.createTextNode(left),
        right_text = document.createTextNode(right + ' ');

    let a2 = document.createElement("a");
    a2.href = '#';
    a2.id = 'show_place_' + record_id;
    a2.textContent = '(vedi su mappa)';
    a2.style.color = "#ad0000";

    a2.appendChild(document.createTextNode('\u00A0'));
    let img = a2.appendChild(document.createElement("img"));
    img.setAttribute("src", "https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png");
    img.setAttribute("height", "15px");
    img.style.marginLeft = '3px';
    img.style.marginBottom = '2px';

    $(document).on('click', '#' + 'show_place_' + record_id, function () {
        showPlaceOnMap(from_coords, to_coords, right);
    });

    bold.appendChild(left_text);
    p.appendChild(bold);
    p.appendChild(right_text);
    p.appendChild(a2);
}

function appendLeftRightSidebarBiblioText(left, right, div) {
    let p = div.appendChild(document.createElement("p")),
        bold = div.appendChild(document.createElement('strong')),
        left_text = document.createTextNode(left),
        right_text = document.createTextNode(right + ' '),
        span = document.createElement('span');

    span.appendChild(left_text);

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

        let a2 = document.createElement("a");
        a2.href = '#';
        a2.id = 'show_' + entity.id;
        a2.textContent = '(vedi su mappa)';
        a2.style.color = "#ad0000";

        a2.appendChild(document.createTextNode('\u00A0'));
        let img = a2.appendChild(document.createElement("img"));
        img.setAttribute("src", "https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png");
        img.setAttribute("height", "15px");
        img.style.marginLeft = '3px';
        img.style.marginBottom = '2px';

        a.appendChild(document.createTextNode('\u00A0'));
        a.appendChild(a2);

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

function generateFiltersPane(record) {
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
                        let b = { old_coords: record.biblio_coords, new_coords: r.biblio_coords, name: r.biblio_name, id: r.biblio_id, info: r.biblio_info }
                        fetchRecordAndPushPanel(r.id, record.biblio_coords !== r.biblio_coords, b);
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

function fetchRecordAndPushPanel(record_id, is_new_biblio, new_biblio) {
    axios.get(`/api/v1/get_full_record?record_id=${record_id}`).then(function (newRecord) {
        let id = 'info-' + record_id;

        if (!openedInfoPanes.includes(id)) {
            openedInfoPanes.push(id);
        }

        if (infoCount[record_id] === undefined) {
            infoCount[record_id] = openedInfoPanes.length;
        }

        sidebar.removePanel(id);
        sidebar.addPanel({
            id: id,
            tab: `<i class="fa fa-info" style="color: white"><span class="fa-tab-icon-number-small">${infoCount[record_id]}</span></i>`,
            title: 'Informazioni <span class="leaflet-sidebar-close"></span>',
            pane: generateSidebarRecordContent(newRecord.data, is_new_biblio, new_biblio),
        });
        sidebar.open(id);

        resetSidebarScroll();

        additionalLayers.map(function (c) {
            c.remove();
        });
        additionalLayers = [];

    });
}

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

/* Coordinates */

L.Map.prototype.setViewOffset = function (latlng, offset) {
    let targetPoint = this.project(latlng, this.getZoom()).subtract(offset),
        targetLatLng = this.unproject(targetPoint, this.getZoom());
    return this.panTo(targetLatLng, this.getZoom());
};

function clickZoom(marker) {
    let offset = map.getZoom() <= 9 ? 80 : 60;
    map.setViewOffset(marker.getLatLng(), [-210, offset]);
}


/* Utils */

function generateOtherText(r) {

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
        otherText2 = `Pubblicato a ${r.place_name}`;
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

function isDuplicate(marker, type) {
    let dupe = false;
    additionalLayers.forEach(function(layer) {
        if (layer instanceof L.Marker && !dupe) {
            if (layer.data.name === marker.data.name) {
                dupe = (layer.type === type);
            }
        }
    });
    if (!dupe) {
        layers.forEach(function (layer) {
            if (layer instanceof L.Marker && !dupe) {
                if (layer.data !== undefined && layer.data.name === marker.data.name) {
                    dupe = (layer.type === type);
                }
            }
        });
    }
    return dupe;
}

function clearAllLayers() {
    try {
        sidebar.close();
        oms.clearMarkers();
        layers.map(function (c) {
            c.remove();
        });
        layers = [];
        additionalLayers.map(function (c) {
            c.remove();
        });
        additionalLayers = [];
    } catch (e) {
        console.log(e.message);
    }
}

function resetSidebarScroll() {
    document.getElementsByClassName('leaflet-sidebar-pane active')[0].scrollIntoView();
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

// https://gist.github.com/ryancatalani/6091e50bf756088bf9bf5de2017b32e6
function bezierCurve(from, to, color, dash = false) {
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
    let pathOptions = {color: color, animate: 600, weight: 1, dashArray: dash ? 5 : 0};
    let curve = L.curve(['M', from, 'Q', midpointLatLng, to], pathOptions);
    return curve;
}