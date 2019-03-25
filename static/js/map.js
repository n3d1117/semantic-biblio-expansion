
let osmUrl = 'http://{s}.tile.osm.org/{z}/{x}/{y}.png',
    osmAttrib = '&copy; <a href="http://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    osm = L.tileLayer.grayscale(osmUrl, {  attribution: osmAttrib }),
    toscana = [43.4148394, 11.2210621],
    layers = [],
    additionalLayers = [],
    bibliosLayers = [];

let map = L.map('map', { attributionControl: false, fadeAnimation: false }).setView(toscana, 9).addLayer(osm);

let oms = new OverlappingMarkerSpiderfier(map, { keepSpiderfied: true, legWeight: 2 });

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
function handleForm(event) {
    event.preventDefault();
}
form.addEventListener('submit', handleForm);

let sidebar = L.control.sidebar({ autopan: true, closeButton: true, container: 'sidebar', position: 'right'}).addTo(map);

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

let legend = L.control({ position: "bottomleft" });
legend.onAdd = function() {
    let div = L.DomUtil.create("div", "legend");
    div.innerHTML += "<h4>Legenda</h4>";
    div.innerHTML += '<i class="icon" style="background-image: url(https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png);background-repeat: no-repeat;"></i><span>Luogo di pubblicazione</span><br>';
    div.innerHTML += '<i class="icon" style="background-image: url(https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png);background-repeat: no-repeat;"></i><span>Approfondimento</span>';
    return div;
};
legend.addTo(map);

/* Search */

async function searchPlaces() {

    clearAllLayers();
    let query = document.getElementById("search").value;
    if (query === '') { return false }

    try {
        const response = await axios.get(`/api/v1/search?q=${query}&expansions=${expansionsEnabled}`);
        response.data.map(function(value) {

            let lat = Number(value.coords.split(',')[0]);
            let long = Number(value.coords.split(',')[1]);

            if (value.type === 'place' || value.type === 'place_exact_match') {
                let marker = generateMarkerForPlace(lat, long, value, value.type === 'place_exact_match');
                marker.on('click', function() {
                    document.getElementById('sidebar').scrollTop = 0;
                });
                layers.push(marker);
                oms.addMarker(marker);
            }

            // Show markers for entities too
            if (value.type === 'entity') {
                let marker = generateMarkerForEntity(lat, long, value);
                layers.push(marker);
                oms.addMarker(marker);
            }
        });

        let group = L.featureGroup(layers);

        setTimeout(function () {
            map.fitBounds(group.getBounds(), {padding: L.point(40, 40)});
            setTimeout(function () {
                group.addTo(map);
            }, 800);
        }, 500);

    } catch (error) {
        console.error(error);
    }
}

/* Autocomplete */

$('#search').autocomplete({
    groupBy: 'category',
    triggerSelectOnValidInput: false,
    lookup: function (query, done) {
        axios.get(`/api/v1/autocomplete?q=${query}`).then(function(response) {
            done(response.data);
        });
    },
    onSelect: function() {
        searchPlaces();
    }
});

/* Markers */

function generateMarkerForPlace(lat, long, place, exact) {

    let rDuration = getRandomInt(400, 700);
    let rHeight = getRandomInt(50, 70);
    let rLoop = getRandomInt(2, 4);

    let marker = L.marker([lat, long], { icon: blueIcon, bounceOnAdd: true, bounceOnAddOptions: { duration: rDuration, height: rHeight, loop: rLoop } });
    marker.data = { name: place.name, lat: lat, long: long, geo_entities: {}, full_records: {} };
    marker.bindPopup();
    marker.bindTooltip(place.name, { className: "marker-label", direction: "right", offset: [15, -20] });

    let div = document.createElement("div");
    div.className = "landmark";
    div.style.width = '300px';

    let title = div.appendChild(document.createElement("h1"));
    title.textContent = 'Libri pubblicati a ' + place.name;

    let scrollable = div.appendChild(document.createElement("div"));
    scrollable.className = "scrollable";

    let section = scrollable.appendChild(document.createElement("section"));

    let promises = [];

    place.records.sort((a, b) => a.title.localeCompare(b.title)).forEach(function(record) {
        promises.push(axios.get(`/api/v1/geo_entities_for_record?record_id=${record.record_id}`));

        axios.get(`/api/v1/get_full_record?record_id=${record.record_id}`).then(function (response) {
            marker.data.full_records[record.record_id] = response.data;
            marker.id = record.record_id.toString();
            marker.type = 'place';

            let hoverable = section.appendChild(document.createElement("div"));
            hoverable.className = "hoverable";

            let p = hoverable.appendChild(document.createElement("p"));
            p.className = `record-title`;
            p.innerHTML = generateRecordInnerHTML(response.data, document.getElementById("search").value);
            p.onclick = function() {

                // resetta background record attivo
                map.eachLayer(function (layer) {
                    if (layer instanceof L.Marker && layer.type === 'place') {
                        for (let item of layer._popup._content.children[1].children[0].children) {
                            item.classList.remove('is-active');
                        }
                    }
                });

                document.getElementById('sidebar').scrollTop = 0;
                hoverable.classList.toggle('is-active');
                setSidebarContent(marker.data.full_records[record.record_id]);
                if (expansionsEnabled) {
                    recordClicked(lat, long, marker.data.geo_entities[record.record_id]);
                }

                bibliosLayers.map(function (c) {
                    c.remove();
                });
                bibliosLayers = [];
                document.getElementById("biblio_coords_a").addEventListener("click", function() {
                    let coords = marker.data.full_records[record.record_id].biblio_coords;
                    let name = marker.data.full_records[record.record_id].biblio_name;
                    showBiblio(coords, lat, long, name);
                });
            };

            let i = p.appendChild(document.createElement("i"));
            i.className = "right-arrow";

            let gap = section.appendChild(document.createElement("div"));
            gap.className = "gap";

        }).catch(function (error) {
            console.log(error);
        });
    });

    axios.all(promises).then(function(results) {
        results.forEach(function(response) {
            let id = response.request.responseURL.split('record_id=')[1];
            let geo_entities = response.data.filter(function removeRedundantEntity(entity) {
                return entity.title !== marker.data.name && entity.title !== 'Provincia di ' + marker.data.name;
            });
            marker.data.geo_entities[id] = (geo_entities.length > 0) ? geo_entities : [];
        })
    });

    marker.setPopupContent(div);
    return marker;
}

function generateMarkerForEntity(lat, long, entity) {
    let marker = L.marker([lat, long], { icon: greenIcon, bounceOnAdd: true, bounceOnAddOptions: { duration: 1000, height: 70, loop: 3 } });
    marker.data = { name: entity.title };
    marker.bindPopup();
    marker.bindTooltip(entity.title, { direction: "right", className: "marker-label", offset: [15, -20] });

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

function generateMarkerForBiblio(lat, long, name) {

    let rDuration = getRandomInt(400, 700);
    let rHeight = getRandomInt(50, 70);

    let marker = L.marker([lat, long], {
        icon: biblioIcon,
        bounceOnAdd: true,
        bounceOnAddOptions: {duration: rDuration, height: rHeight, loop: 2}
    });
    marker.data = { name: name };
    marker.bindPopup();
    marker.bindTooltip(name, {className: name.split(' ').length > 6 ? "marker-label-longer" : "marker-label", direction: "left", offset: [-20, -15]});

    let div = document.createElement("div");
    div.className = "landmark";
    div.style.width = '230px';

    let title = div.appendChild(document.createElement("h1"));
    title.textContent = name;

    marker.setPopupContent(div);
    return marker;
}

function recordClicked(place_lat, place_long, geo_entities) {

    // Rimuovi sognaposto entità e curve dalla mappa
    additionalLayers.map(function (c) {
        c.remove();
    });
    additionalLayers = [];

    geo_entities.map(function (entity) {
        let lat1 = Number(entity.coords.split(',')[0]);
        let long1 = Number(entity.coords.split(',')[1]);

        let marker = generateMarkerForEntity(lat1, long1, entity);

        if (!isDuplicate(marker)) {
            oms.addMarker(marker);
            additionalLayers.push(marker);
        }

        let curve = bezierCurve([place_lat, place_long], [lat1, long1], 'black');
        additionalLayers.push(curve);
    });

    let group = L.featureGroup(additionalLayers);

    let offset = document.querySelector('.leaflet-sidebar-content').getBoundingClientRect().width + 50;
    if (offset === 50) { offset = 450; }
    map.fitBounds(group.getBounds(), {paddingTopLeft: [0, 170], paddingBottomRight: [offset, 100]});

    setTimeout(function () {
        group.addTo(map);
    }, 600);
}

function generateRecordInnerHTML(record, query) {

    query = query.toLowerCase();

    if (record.title.toLowerCase().includes(query)) {
        return boldString(record.title, query);
    } else if (record.description.toLowerCase().includes(query)) {
        let newText = record.title + '<br>' + generateTextQueryBounds(record.description, query, 'Descrizione');
        return boldString(newText, query);
    } else if (record.subject.toLowerCase().includes(query)) {
        let newText = record.title + '<br>' + generateTextQueryBounds(record.subject, query, 'Soggetti');
        return boldString(newText, query);
    } else if (record.creator.toLowerCase().includes(query)) {
        let newText = record.title + '<br>' + generateTextQueryBounds(record.creator, query, 'Autore');
        return boldString(newText, query);
    } else if (record.contributor.toLowerCase().includes(query)) {
        let newText = record.title + '<br>' + generateTextQueryBounds(record.contributor, query, 'Autore secondario');
        return boldString(newText, query);
    } else if (record.publisher.toLowerCase().includes(query)) {
        let newText = record.title + '<br>' + generateTextQueryBounds(record.publisher, query, 'Editore');
        return boldString(newText, query);
    }
    return record.title;
}

/* Utils */

function isDuplicate(marker) {
    let dupe = false;
    map.eachLayer(function (layer) {
        if (layer instanceof L.Marker && !dupe) {
            if (layer.getLatLng().lat === marker.getLatLng().lat && layer.getLatLng().lng === marker.getLatLng().lng) {
                if (layer.type === 'entity' && layer.data.name === marker.data.name) {
                    dupe = true;
                }
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
        bibliosLayers.map(function (c) {
            c.remove();
        });
        bibliosLayers = [];
        sidebar.close();
        oms.clearMarkers();
    } catch (e) {
        console.log(e.message);
    }
}

function generateTextQueryBounds(text, query, section) {
    let splits = text.toLowerCase().split(query);
    let first = splits[0].split(" ").slice(-4).join(" ");
    let second = splits[1].split(" ").slice(0, 4).join(" ");
    return '<span class="record-smaller">' + section + ': ... ' + first + query + second + ' ...' + '</span>';
}

function boldString(str, find) {
    let re = new RegExp(find, 'i');
    return str.replace(re, '<b>$&</b>');
}

/* Sidebar */

function setSidebarContent(record) {
    let div = document.createElement("div");

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
        appendLeftRightSidebarText('Luogo di pubblicazione: ', record.published_in, div);
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
        appendLeftRightSidebarArrayText('Altre opere: ', record.author_other_works.split('~~'), div);
    }
    if (record.author_wiki_info !== '') {
        appendLeftRightSidebarText('Biografia Wikipedia Autore: ', record.author_wiki_info, div);
    }
    if (record.author_wiki_page !== '') {
        appendLeftRightSidebarTextWithHref('Link Wikipedia Autore: ', record.author_wiki_page, div, record.author_wiki_page);
    }
    if (record.entities.length > 0) {
        appendLeftRightSidebarEntitiesText('Entità trovate nel campo descrizione/autore/soggetti: ', record.entities, div);
    }

    sidebar.removePanel('record-info');
    sidebar.addPanel({
        id: 'record-info',
        tab: '<i class="fa fa-bars"></i>',
        title: 'Informazioni <span class="leaflet-sidebar-close"></span>',
        pane: div.innerHTML,
    });
    sidebar.open('record-info');
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

function appendLeftRightSidebarBiblioText(left, right, div) {
    let p = div.appendChild(document.createElement("p")),
        bold = div.appendChild(document.createElement('strong')),
        left_text = document.createTextNode(left),
        right_text = document.createTextNode(right + ' '),
        a = document.createElement("a");
    a.href = '#';
    a.id = 'biblio_coords_a';
    a.textContent = '(vedi su mappa)';

    bold.appendChild(left_text);
    p.appendChild(bold);
    p.appendChild(right_text);
    p.appendChild(a);
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
    right.forEach(function(value) {
        let li = document.createElement("li");
        li.textContent = value;
        ul.appendChild(li);
    });

    bold.appendChild(left_text);
    p.appendChild(bold);
    p.appendChild(ul);
}

function appendLeftRightSidebarEntitiesText(left, right, div) {
    let p = div.appendChild(document.createElement("p")),
        bold = div.appendChild(document.createElement('strong')),
        left_text = document.createTextNode(left);

    let ul = document.createElement("ul");
    right.forEach(function(entity) {
        let li = document.createElement("li");

        let a = li.appendChild(document.createElement("a"));
        a.href = entity.uri;
        a.target = "_blank";
        a.textContent = entity.title;

        let p = li.appendChild(document.createElement("p"));
        p.textContent = entity.abstract;

        ul.appendChild(li);
    });

    bold.appendChild(left_text);
    p.appendChild(bold);
    p.appendChild(ul);
}

function showBiblio(coords, lat, long, name) {

    bibliosLayers.map(function (c) {
        c.remove();
    });
    bibliosLayers = [];

    let lat1 = Number(coords.split(',')[0]);
    let long1 = Number(coords.split(',')[1]);

    let marker = generateMarkerForBiblio(lat1, long1, name);
    oms.addMarker(marker);
    bibliosLayers.push(marker);

    let curve = bezierCurve([lat, long], [lat1, long1], 'red', true);
    bibliosLayers.push(curve);

    let group = L.featureGroup(bibliosLayers);

    let offset = document.querySelector('.leaflet-sidebar-content').getBoundingClientRect().width + 50;
    if (offset === 50) {
        offset = 450;
    }
    map.fitBounds(group.getBounds(), {paddingTopLeft: [0, 150], paddingBottomRight: [offset, 80]});

    setTimeout(function () {
        group.addTo(map);
    }, 600);
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
        off2 = -off/2;
    }
    map.setViewOffset(marker.getLatLng(), [off2, offset]);
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// https://gist.github.com/ryancatalani/6091e50bf756088bf9bf5de2017b32e6
function bezierCurve(from, to, color, dash=false) {
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
    let pathOptions = { color: color, animate: 600, weight: 1, dashArray: dash ? 5 : 0 };
    let curve = L.curve(['M', from, 'Q', midpointLatLng, to], pathOptions);
    return curve;
}