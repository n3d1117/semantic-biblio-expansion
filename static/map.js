
let osmUrl = 'http://{s}.tile.osm.org/{z}/{x}/{y}.png',
    osmAttrib = '&copy; <a href="http://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    osm = L.tileLayer.grayscale(osmUrl, {  attribution: osmAttrib }),
    toscana = [43.4148394, 11.2210621],
    layers = [],
    additionalLayers = [];

let map = L.map('map', { fadeAnimation: false }).setView(toscana, 9).addLayer(osm);

let form = document.getElementById("search-form");
function handleForm(event) {
    event.preventDefault();
}
form.addEventListener('submit', handleForm);

L.Map.prototype.setViewOffset = function (latlng, offset) {
    let targetPoint = this.project(latlng, this.getZoom()).subtract(offset),
        targetLatLng = this.unproject(targetPoint, this.getZoom());
    return this.panTo(targetLatLng, this.getZoom());
};

async function searchPlaces() {

    clearAllLayers();
    let query = document.getElementById("search").value;
    if (query === '') { return false }

    try {
        const response = await axios.get(`/api/v1/search?q=${query}`);
        response.data.map(function(value) {

            let lat = Number(value.coords.split(',')[0]);
            let long = Number(value.coords.split(',')[1]);

            if (value.type === 'place') {
                let marker = generateMarkerForPlace(lat, long, value);
                layers.push(marker);
            }

            // Show markers for entities too
            if (value.type === 'entity') {
                let marker = generateMarkerForEntity(lat, long, value);
                layers.push(marker);
            }
        });

        let group = L.featureGroup(layers);
        map.fitBounds(group.getBounds(), {padding: L.point(30, 30)});

        setTimeout(function () { group.addTo(map) }, 500);

    } catch (error) {
        console.error(error);
    }
}

function generateMarkerForPlace(lat, long, place) {
    let marker = L.marker([lat, long], { bounceOnAdd: true, bounceOnAddOptions: { duration: 500, height: 50, loop: 2} });
    marker.data = {id: place.id, name: place.name, lat: lat, long: long};
    marker.bindPopup();
    marker.bindTooltip(place.name, {className: "marker-label", offset: [0, 0]});
    marker.on('click', clickZoom);

    let div = document.createElement("div");
    div.className = "landmark";
    let title = div.appendChild(document.createElement("h1"));
    title.textContent = place.name;
    let scrollable = div.appendChild(document.createElement("div"));
    scrollable.className = "scrollable";
    let section = scrollable.appendChild(document.createElement("section"));

    place.records.sort((a, b) => a.title.localeCompare(b.title)).forEach(async function(record) {
        try {
            const response = await axios.get(`/api/v1/geo_entities_for_record?record_id=${record.record_id}`);
            let geo_entities = response.data.filter(function removeRedundantEntity(entity) {
                // todo better
                return entity.title !== marker.data.name && entity.title !== 'Toscana' && entity.title !== 'Provincia di ' + marker.data.name;
            });
            if (geo_entities.length > 0) {
                let p = section.appendChild(document.createElement("p"));
                p.className = "hoverable";
                p.textContent = record.title;
                p.onclick = function () {
                    recordClicked(lat, long, geo_entities);
                }
            }
        } catch (error) {
            console.error(error);
        }
    });

    marker.setPopupContent(div);
    return marker;
}

function generateMarkerForEntity(lat, long, entity) {
    let marker = L.marker([lat, long], { icon: greenIcon, bounceOnAdd: true, bounceOnAddOptions: {duration: 1000, height: 70, loop: 3} });
    marker.bindPopup();
    marker.bindTooltip(entity.title, { direction: "right", className: "marker-label", offset: [15, -20] });
    marker.on('click', clickZoom);
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

    let geo_entities_markers = [[place_lat, place_long]];
    geo_entities.map(function (entity) {
        let lat1 = Number(entity.coords.split(',')[0]);
        let long1 = Number(entity.coords.split(',')[1]);

        let marker = generateMarkerForEntity(lat1, long1, entity);
        if (!map.hasLayer(marker)) {
            marker.addTo(map);
            geo_entities_markers.push([lat1, long1]);
        }
        additionalLayers.push(marker);

        let curve = bezierCurve([place_lat, place_long], [lat1, long1]);
        if (!map.hasLayer(curve)) {
            curve.addTo(map);
        }
        additionalLayers.push(curve);
    });

    //map.fitBounds(new L.LatLngBounds(geo_entities_markers));
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
    } catch (e) {
        console.log(e.message);
    }
}

let greenIcon = new L.Icon({
    iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

function clickZoom(e) {
    let offset = map.getZoom() <= 9 ? 120 : 90;
    map.setViewOffset(e.target.getLatLng(), [0, offset]);
}

/*
map.on('popupopen', function(marker) {
    try {
        marker.closeTooltip();
        console.log(marker.popup._source.data);
    } catch(e) { }
});
*/

// quadratic bezier curve
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
    let pathOptions = { color: 'black', animate: 400, weight: 1 };
    return L.curve(['M', from, 'Q', midpointLatLng, to], pathOptions);
}