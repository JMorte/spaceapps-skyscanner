"use strict";

const debrisLayer = new WorldWind.RenderableLayer("Debris");

const tleArray_g = [
    {
        tleLine1: '1 25544U 98067A   19156.50900463  .00003075  00000-0  59442-4 0  9992',
        tleLine2: '2 25544  51.6433  59.2583 0008217  16.4489 347.6017 15.51174618173442',
        id: '1',
    },
    // {
    //     tleLine1: '1 49266U 19063AS  21271.30822274  .00006367  00000-0  22572-2 0  9999',
    //     tleLine2: '2 49266  98.5377 296.5207 0011437  91.5160 268.7335 14.34790113 15101',
    //     id: '2',
    // }
];

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

    wwd.addLayer(debrisLayer);

    addDebrisToLayer();
}

function getPosition(satrec) {
    /*
        Compute the location of the TLE lines at a specific time    
    */
    let positionAndVelocity = satellite.propagate(satrec, new Date());
    let positionEci = positionAndVelocity.position;

    let gmst = satellite.gstime(new Date());

    let positionGd = satellite.eciToGeodetic(positionEci, gmst);
    let longitude = positionGd.longitude,
        latitude = positionGd.latitude,
        height = positionGd.height * 1000;

    return new WorldWind.Position(latitude, longitude, height);
}


function parseDebris(tleArray) {
    let resultArray = [];

    tleArray.forEach(element => {
        let position = getPosition(satellite.twoline2satrec(element.tleLine1, element.tleLine2));
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
        // try {
        getPosition(satellite.twoline2satrec(element.tleLine1, element.tleLine2));
        resultArray.push(element);
        // } catch (err) {
        //     faultyItems += 1;
        // }
    });
    console.log('Number of faulty TLEs: ' + faultyItems);
    return resultArray;
}

function addDebrisToLayer() {
    sanitizedTleArray_g = sanitizeTleArray(tleArray_g);
    positionsArray_g = parseDebris(sanitizedTleArray_g);

    positionsArray_g.forEach(body => {
        debrisLayer.addRenderable(genPlaceMark(body));
    });

    wwd.redraw();
}

function updateDebrisInLayer() {

}

function genPlaceMark(body) {
    var placemarkPosition = new WorldWind.Position(body.latitude, body.longitude, body.altitude);
    var placemark = new WorldWind.Placemark(placemarkPosition);
    var placemarkAttributes = new WorldWind.PlacemarkAttributes(null);

    // placemarkAttributes.color = WorldWind.Color.CYAN;
    // placemarkAttributes.depthTest = false;

    var highlightAttributes = new WorldWind.PlacemarkAttributes(placemarkAttributes);
    highlightAttributes.imageScale = 0.90;
    highlightAttributes.imageSource = "assets/icons/dot-green.png";
    placemark.altitudeMode = WorldWind.RELATIVE_TO_GROUND;

    placemark.attributes = placemarkAttributes;
    placemark.highlightAttributes = highlightAttributes;

    return placemark;
}