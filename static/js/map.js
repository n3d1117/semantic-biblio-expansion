
let osmUrl = 'http://{s}.tile.osm.org/{z}/{x}/{y}.png',
    osmAttrib = '&copy; <a href="http://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    osm = L.tileLayer.grayscale(osmUrl, {  attribution: osmAttrib }),
    toscana = [43.4148394, 11.2210621],
    layers = [],
    additionalLayers = [];

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

let form = document.getElementById("search-form");
function handleForm(event) {
    event.preventDefault();
}
form.addEventListener('submit', handleForm);

let sidebar = L.control.sidebar('sidebar', { closeButton: true, position: 'right', autoPan: false });
map.addControl(sidebar);

document.getElementById('sidebar').addEventListener('mousedown', sidebarMouseDown, false);
window.addEventListener('mouseup', sidebarMouseUp, false);

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
    div.innerHTML += '<i class="icon" style="background-image: url(https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png);background-repeat: no-repeat;"></i><span>Luogo di edizione</span><br>';
    div.innerHTML += '<i class="icon" style="background-image: url(https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png);background-repeat: no-repeat;"></i><span>Entità</span>';
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

            if (value.type === 'place') {
                let marker = generateMarkerForPlace(lat, long, value);
                marker.on('click', function() {
                    sidebar.hide();
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

        setTimeout(function() {
            layers = layers.filter(function (marker) {
                return marker.type === 'entity' || !isEmpty(marker.data.geo_entities);
            });
            let group = L.featureGroup(layers);
            map.fitBounds(group.getBounds(), { padding: L.point(30, 30) });
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

function generateMarkerForPlace(lat, long, place) {

    let rDuration = getRandomInt(400, 700);
    let rHeight = getRandomInt(50, 70);
    let rLoop = getRandomInt(2, 4);

    let marker = L.marker([lat, long], { bounceOnAdd: true, bounceOnAddOptions: { duration: rDuration, height: rHeight, loop: rLoop } });
    marker.data = { name: place.name, lat: lat, long: long, geo_entities: {}, full_records: {} };
    marker.bindPopup();
    marker.bindTooltip(place.name, { className: "marker-label" });

    let div = document.createElement("div");
    div.className = "landmark";
    div.style.width = '300px';

    let title = div.appendChild(document.createElement("h1"));
    title.textContent = place.name;

    let scrollable = div.appendChild(document.createElement("div"));
    scrollable.className = "scrollable";

    let section = scrollable.appendChild(document.createElement("section"));

    let promises = [];

    place.records.sort((a, b) => a.title.localeCompare(b.title)).forEach(function(record) {
        promises.push(axios.get(`/api/v1/geo_entities_for_record?record_id=${record.record_id}`));

        axios.get(`/api/v1/get_full_record?record_id=${record.record_id}`).then(function (response) {
            marker.data.full_records[record.record_id] = response.data;
            marker.type = 'place';

            let hoverable = section.appendChild(document.createElement("div"));
            hoverable.className = "hoverable";

            let p = hoverable.appendChild(document.createElement("p"));
            p.className = `record-title`;
            p.innerHTML = generateRecordInnerHTML(response.data, document.getElementById("search").value);
            p.onclick = function() {
                document.getElementById('sidebar').scrollTop = 0;
                setSidebarContent(marker.data.full_records[record.record_id]);
                if (expansionsEnabled) {
                    recordClicked(lat, long, marker.data.geo_entities[record.record_id]);
                }
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
    let split_coords = entity.coords.split(',')
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

function recordClicked(place_lat, place_long, geo_entities) {

    // Rimuovi sognaposto entità e curve dalla mappa
    additionalLayers.map(function (c) {
        c.remove();
    });
    additionalLayers = [];

    let shouldPulsateArrow = false,
        arrowPosition = '';

    geo_entities.map(function (entity) {
        let lat1 = Number(entity.coords.split(',')[0]);
        let long1 = Number(entity.coords.split(',')[1]);

        let marker = generateMarkerForEntity(lat1, long1, entity);

        if (!isDuplicate(marker)) {
            oms.addMarker(marker);
            additionalLayers.push(marker);
        }

        let curve = bezierCurve([place_lat, place_long], [lat1, long1]);
        additionalLayers.push(curve);

        if (!shouldPulsateArrow) {
            shouldPulsateArrow = !map.getBounds().contains(marker.getLatLng());
            if (shouldPulsateArrow) {
                arrowPosition = relativePosition(place_lat, place_long, lat1, long1);
            }
        }
    });

    let group = L.featureGroup(additionalLayers);
    group.addTo(map);

    let element = document.getElementById('pulsating-arrow');
    if (element !== null) {
        element.parentNode.removeChild(element);
    }

    if (shouldPulsateArrow) {
        let arrow = document.createElement('div');
        let className = 'arrow ';

        switch (arrowPosition) {
            case 'N':
                className += 'top-bouncing-arrow bounce';
                break;
            case 'S':
                className += 'bottom-bouncing-arrow bounce';
                break;
            case 'W':
                className += 'left-bouncing-arrow bounce-left';
                break;
            case 'E':
                className += 'right-bouncing-arrow bounce-right';
                break;
        }

        arrow.className = className;
        arrow.id = 'pulsating-arrow';

        document.body.appendChild(arrow);
        arrow.onclick = function () {
            let element = document.getElementById('pulsating-arrow');
            element.parentNode.removeChild(element);
            map.fitBounds(group.getBounds(), {padding: L.point(30, 30)});
        };
    }
}

function generateRecordInnerHTML(record, query) {
    if (record.title.toLowerCase().includes(query)) {
        return boldString(record.title, query);
    } else if (record.description.toLowerCase().includes(query)) {
        let newText = record.title + '<br>' + generateTextQueryBounds(record.description, query);
        return boldString(newText, query);
    } else if (record.subject.toLowerCase().includes(query)) {
        let newText = record.title + '<br>' + generateTextQueryBounds(record.subject, query);
        return boldString(newText, query);
    } else if (record.creator.toLowerCase().includes(query)) {
        let newText = record.title + '<br>' + generateTextQueryBounds(record.creator, query);
        return boldString(newText, query);
    } else if (record.contributor.toLowerCase().includes(query)) {
        let newText = record.title + '<br>' + generateTextQueryBounds(record.contributor, query);
        return boldString(newText, query);
    } else if (record.publisher.toLowerCase().includes(query)) {
        let newText = record.title + '<br>' + generateTextQueryBounds(record.publisher, query);
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
                    console.log('duplicate ' + marker.data.name);
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
        sidebar.hide();
        oms.clearMarkers();
    } catch (e) {
        console.log(e.message);
    }
}

function generateTextQueryBounds(text, query) {
    let splits = text.toLowerCase().split(query);
    let first = splits[0].split(" ").slice(-4).join(" ");
    let second = splits[1].split(" ").slice(0, 4).join(" ");
    return '<span class="record-smaller">' + '... ' + first + query + second + ' ...' + '</span>';
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
        appendLeftRightSidebarText('Link Wikipedia Autore: ', record.author_wiki_page, div);
    }
    if (record.entities.length > 0) {
        appendLeftRightSidebarEntitiesText('Entità trovate nel campo descrizione/autore/soggetti: ', record.entities, div);
    }

    sidebar.setContent(div);
    sidebar.show();
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

function handleSidebarMouseMove(event) {

    let sidebar = document.getElementById("sidebar");
    sidebar.style.cursor = "move";
    sidebar.style.position = 'relative';

    let top = (event.clientY - 590);
    if (top < -495) {
        top = -495;
    }
    if (top > -5) {
        top = -5;
    }
    sidebar.style.top = top + 'px';

    let close = document.getElementById("closeButton");
    close.style.position = 'relative';
    close.style.top = top - 210 + 'px';
    close.style.left = '-10px';
}

function sidebarMouseUp() {
    window.removeEventListener('mousemove', handleSidebarMouseMove, true);
}

function sidebarMouseDown(e) {
    window.addEventListener('mousemove', handleSidebarMouseMove, true);
}

/* Coordinates */

L.Map.prototype.setViewOffset = function (latlng, offset) {
    let targetPoint = this.project(latlng, this.getZoom()).subtract(offset),
        targetLatLng = this.unproject(targetPoint, this.getZoom());
    return this.panTo(targetLatLng, this.getZoom());
};

function clickZoom(marker) {
    let offset = map.getZoom() <= 9 ? 120 : 105;
    map.setViewOffset(marker.getLatLng(), [0, offset]);
}

function relativePosition(lat1, long1, lat2, long2) {
    let temp1 = (lat2 > lat1) ? 'N' : 'S';
    let temp2 = (long2 > long1) ? 'E' : 'W';
    let diff1 = (lat2 > lat1) ? lat2 - lat1 : lat1 - lat2;
    let diff2 = (long2 > long1) ? long2 - long1 : long1 - long2;
    return (diff1 > diff2) ? temp1 : temp2;
}

function isEmpty(obj) {
    for (let prop in obj) {
        if (obj.hasOwnProperty(prop))
            return false;
    }

    return true;
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// https://gist.github.com/ryancatalani/6091e50bf756088bf9bf5de2017b32e6
function bezierCurve(from, to) {
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
    let pathOptions = { color: 'black', animate: 600, weight: 1 };
    return L.curve(['M', from, 'Q', midpointLatLng, to], pathOptions);
}