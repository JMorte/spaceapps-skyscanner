"use strict";

const debrisLayer = new WorldWind.RenderableLayer("Debris");

// const tleArray_g = [
//     {
//         tleLine1: '1 25544U 98067A   19156.50900463  .00003075  00000-0  59442-4 0  9992',
//         tleLine2: '2 25544  51.6433  59.2583 0008217  16.4489 347.6017 15.51174618173442',
//         id: '1',
//     },
//     {
//         tleLine1: '1 49266U 19063AS  21271.30822274  .00006367  00000-0  22572-2 0  9999',
//         tleLine2: '2 49266  98.5377 296.5207 0011437  91.5160 268.7335 14.34790113 15101',
//         id: '2',
//     }
// ];

// Create the custom image for the placemark with a 2D canvas.
const canvas = document.createElement("canvas");
const ctx2d = canvas.getContext("2d");
const size = 8;
const c = size / 2 - 0.5;

canvas.width = size;
canvas.height = size;

ctx2d.fillStyle = '#4BA85A';
ctx2d.arc(c, c, c, 0, 2 * Math.PI, false);
ctx2d.fill();

let sanitizedTleArray_g;
let positionsArray_g;

// Register an event listener to be called when the page is loaded.
window.addEventListener("load", eventWindowLoaded, false);

let wwd;

// Define the event listener to initialize Web World Wind.
function eventWindowLoaded() {
    // Tell WorldWind to log only warnings and errors.
    WorldWind.Logger.setLoggingLevel(WorldWind.Logger.LEVEL_WARNING);

    // Create a World Window for the canvas.
    wwd = new WorldWind.WorldWindow("canvasOne");

    // Create and add layers to the WorldWindow.
    var layers = [
        // Imagery layers.
        { layer: new WorldWind.BMNGLayer(), enabled: true },
        { layer: new WorldWind.BMNGLandsatLayer(), enabled: false },
        { layer: new WorldWind.BingAerialLayer(null), enabled: false },
        { layer: new WorldWind.BingAerialWithLabelsLayer(null), enabled: false },
        { layer: new WorldWind.BingRoadsLayer(null), enabled: false },
        // Add atmosphere layer on top of all base layers.
        { layer: new WorldWind.AtmosphereLayer(), enabled: false },
        // WorldWindow UI layers.
        { layer: new WorldWind.CompassLayer(), enabled: false },
        { layer: new WorldWind.CoordinatesDisplayLayer(wwd), enabled: true },
        { layer: new WorldWind.ViewControlsLayer(wwd), enabled: false },
    ];

    for (var l = 0; l < layers.length; l++) {
        layers[l].layer.enabled = layers[l].enabled;
        wwd.addLayer(layers[l].layer);
    }
    addDebrisToLayer();
}

function genPlaceMarker(latitude, longitude, altitude) {
    // Set placemark attributes.
    var placemarkAttributes = new WorldWind.PlacemarkAttributes(null);
    // Wrap the canvas created above in an ImageSource object to specify it as the placemarkAttributes image source.
    placemarkAttributes.imageSource = new WorldWind.ImageSource(canvas);
    // Define the pivot point for the placemark at the center of its image source.
    placemarkAttributes.imageOffset = new WorldWind.Offset(WorldWind.OFFSET_FRACTION, 0.5, WorldWind.OFFSET_FRACTION, 0.5);
    placemarkAttributes.imageScale = 1;
    placemarkAttributes.imageColor = WorldWind.Color.WHITE;

    // Set placemark highlight attributes.
    // Note that the normal attributes are specified as the default highlight attributes so that all properties
    // are identical except the image scale. You could instead vary the color, image, or other property
    // to control the highlight representation.
    var highlightAttributes = new WorldWind.PlacemarkAttributes(placemarkAttributes);
    highlightAttributes.imageScale = 1.2;

    // Create the placemark with the attributes defined above.
    var placemarkPosition = new WorldWind.Position(latitude, longitude, altitude);
    var placemark = new WorldWind.Placemark(placemarkPosition, false, placemarkAttributes);
    // Draw placemark at altitude defined above, relative to the terrain.
    placemark.altitudeMode = WorldWind.RELATIVE_TO_GROUND;
    // Assign highlight attributes for the placemark.
    placemark.highlightAttributes = highlightAttributes;
    return placemark;
}

function getPosition(satrec) {
    /*
        Compute the location of the TLE lines at a specific time    
    */
    let positionAndVelocity = satellite.propagate(satrec, new Date());
    let positionEci = positionAndVelocity.position;

    let gmst = satellite.gstime(new Date());

    let positionGd = satellite.eciToGeodetic(positionEci, gmst);
    let longitude = satellite.radiansToDegrees(positionGd.longitude),
        latitude = satellite.radiansToDegrees(positionGd.latitude),
        height = positionGd.height * 1000;

    return { latitude: latitude, longitude: longitude, altitude: height };
}

function parseDebris(tleArray) {
    let resultArray = [];

    tleArray.forEach(element => {
        let position = getPosition(satellite.twoline2satrec(element.Line1, element.Line2));
        resultArray.push({
            id: element.id,
            position: position,
        });
    });
    return resultArray;
}

function sanitizeTleArray(tleArray) {
    let faultyItems = 0;
    let resultArray = [];

    tleArray.forEach(element => {
        try {
            getPosition(satellite.twoline2satrec(element.Line1, element.Line2));
            resultArray.push(element);
        } catch (err) {
            console.log(err)
            faultyItems += 1;
        }
    });
    console.log('Number of faulty TLEs: ' + faultyItems);
    return resultArray;
}

function addDebrisToLayer() {
    sanitizedTleArray_g = sanitizeTleArray(tleArray_g);
    positionsArray_g = parseDebris(sanitizedTleArray_g);

    positionsArray_g.forEach(body => {
        debrisLayer.addRenderable(genPlaceMarker(body.position.latitude, body.position.longitude, body.position.altitude));
    });

    wwd.addLayer(debrisLayer);

    setInterval(updateDebrisInLayer, 2000);
}

function updateDebrisInLayer() {
    positionsArray_g = parseDebris(sanitizedTleArray_g);
    for (let i = 0; i < positionsArray_g.length; i++) {
        debrisLayer.renderables[i].position.latitude = positionsArray_g[i].position.latitude;
        debrisLayer.renderables[i].position.longitude = positionsArray_g[i].position.longitude;
        debrisLayer.renderables[i].position.altitude = positionsArray_g[i].position.altitude;
    }
    wwd.redraw();
}
