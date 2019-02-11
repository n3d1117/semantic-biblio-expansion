mapkit.init({
    authorizationCallback: function(done) {
        done('***');
    }, language: "it-IT"
});


var firenze = new mapkit.CoordinateRegion(
    new mapkit.Coordinate(43.7792500, 11.2462600),
    new mapkit.CoordinateSpan(1.8, 0.005)
);

var map = new mapkit.Map("map");
//map.colorScheme = mapkit.Map.ColorSchemes.Dark;
map.showsPointsOfInterest = false;
map.region = firenze;

map.addEventListener("zoom-end", function () {
    map.annotations.forEach(function(a) {
        a.titleVisibility = map.region.span.latitudeDelta < 1 ? mapkit.FeatureVisibility.Visible : mapkit.FeatureVisibility.Hidden;
    })
});

var CALLOUT_OFFSET_1 = new DOMPoint(-148, -32);
var landmarkAnnotationCallout = {
    calloutElementForAnnotation: function (annotation) {
        return calloutForLandmarkAnnotation(annotation);
    },

    calloutAnchorOffsetForAnnotation: function (annotation, element) {
        return CALLOUT_OFFSET_1;
    },

    calloutAppearanceAnimationForAnnotation: function (annotation) {
        return "scale-and-fadein .4s 0 1 normal cubic-bezier(0.4, 0, 0, 1.5)";
    }
};


axios.get('/api/v1/places').then((response) => {

    annotations = response.data.map(function(value) {
        lat = Number(value.coords.split(',')[0]);
        long = Number(value.coords.split(',')[1]);
        a = new mapkit.MarkerAnnotation(new mapkit.Coordinate(lat, long), { color: "blue", callout: landmarkAnnotationCallout, title: value.name, data: { id: value.id, lat: lat, long: long } });
        a.titleVisibility = mapkit.FeatureVisibility.Hidden;
        return a;
    });
    map.addAnnotations(annotations);
}).catch(error => {
    console.log(error);
});

// Landmark annotation custom callout
function calloutForLandmarkAnnotation(annotation) {
    var div = document.createElement("div");
    div.className = "landmark";

    var title = div.appendChild(document.createElement("h1"));
    title.textContent = annotation.title;

    axios.get(`/api/v1/records_for_place?place_id=${annotation.data.id}`).then((response) => {

        var section = div.appendChild(document.createElement("section"));

        response.data.sort((a, b) => a.title.localeCompare(b.title)).forEach(function(value) {
            var phone = section.appendChild(document.createElement("p"));
            phone.className = "phone";
            phone.textContent = value.title;
            phone.onclick = function () {
                axios.get(`/api/v1/geo_entities_for_record?record_id=${value.id}`).then((response) => {
                    var geo_entities = response.data.filter(function removeRedundantPlace(entity) {
                        return entity.title !== annotation.title && entity.title !== 'Toscana' && entity.title !== 'Provincia di ' + annotation.title; // todo better
                    });

                    console.log(geo_entities);

                    var polylines = [];

                    var annotations = geo_entities.map(function (value) {
                        lat = Number(value.coords.split(',')[0]);
                        long = Number(value.coords.split(',')[1]);
                        a = new mapkit.MarkerAnnotation(new mapkit.Coordinate(lat, long), {
                            color: "red",
                            callout: entityAnnotationCallout,
                            title: value.title,
                            data: { id: value.entity_id }
                        });

                        var c1 = new mapkit.Coordinate(annotation.data.lat, annotation.data.long);
                        var c2 = new mapkit.Coordinate(lat, long);
                        polylines.push(bezierPolyline(c1, c2));

                        return a;
                    });

                    map.removeOverlays(map.overlays);

                    var old_annotations = map.annotations.filter(function (value) {
                        return value.color === "red";
                    });

                    map.removeAnnotations(old_annotations);

                    map.showItems(annotations.concat(polylines), {
                        animate: true,
                        padding: new mapkit.Padding(150, 250, 150, 250)
                    });

                }).catch(error => {
                    console.log(error);
                });
            };
        });

    }).catch(error => {
        console.log(error);
    });

    return div;
}

var CALLOUT_OFFSET_2 = new DOMPoint(-148, -32);
var entityAnnotationCallout = {
    calloutElementForAnnotation: function (annotation) {
        return calloutForEntityAnnotation(annotation);
    },

    calloutAnchorOffsetForAnnotation: function (annotation, element) {
        return CALLOUT_OFFSET_2;
    },

    calloutAppearanceAnimationForAnnotation: function (annotation) {
        return "scale-and-fadein .4s 0 1 normal cubic-bezier(0.4, 0, 0, 1.5)";
    }
};

function calloutForEntityAnnotation(annotation) {
    var div = document.createElement("div");
    div.className = "landmark";

    var title = div.appendChild(document.createElement("h1"));
    title.textContent = annotation.title;

    axios.get(`/api/v1/entity?entity_id=${annotation.data.id}`).then((response) => {
        value = response.data[0];

        if (value.image_url != '') {
            var img = div.appendChild(document.createElement("img"));
            img.setAttribute("src", value.image_url);
            img.setAttribute("width", "250");
            img.setAttribute("height", "100");
        }

        var section = div.appendChild(document.createElement("section"));

        var coords = section.appendChild(document.createElement("p"));
        coords.textContent = value.coords;

        var abstract = section.appendChild(document.createElement("p"));
        abstract.textContent = value.abstract;

        var uri = section.appendChild(document.createElement("p"));
        var a = uri.appendChild(document.createElement("a"));
        a.href = value.uri;
        a.target = "_blank";
        a.textContent = value.uri;
    });

    return div;
}

function getBezierXY(t, sx, sy, cpx, cpy, ex, ey) {
    return {
        x: Math.pow(1 - t, 2) * sx + 2 * t * (1 - t) * cpx + t * t * ex,
        y: Math.pow(1 - t, 2) * sy + 2 * t * (1 - t) * cpy + t * t * ey
    };
}

let style = new mapkit.Style({
    lineWidth: 1,
    lineJoin: "round",
    strokeColor: "#000000"
});

function bezierPolyline(from, to) {
    var middle = {
        x: (from.latitude + to.latitude) / 2,
        y: (from.longitude + to.longitude) / 2,
    };
    var cp = new mapkit.Coordinate(middle.x - 0.06, middle.y - 0.06); // control point todo better

    var i;
    var points = [];
    let precision = 100;
    for (i = 0; i < precision + 1; i++) {
        let p = getBezierXY(i / precision, from.latitude, from.longitude, cp.latitude, cp.longitude, to.latitude, to.longitude);
        points.push([p.x, p.y]);
    }
    var coords = points.map(function (point) {
        return new mapkit.Coordinate(point[0], point[1]);
    });
    return new mapkit.PolylineOverlay(coords, { style: style });
}
