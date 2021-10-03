"use strict";

const debrisLayer = new WorldWind.RenderableLayer("Debris");

const systemTimeIncrease_g = 1000;
let systemTimeOffset_g = 0;
let intervalId_g;

let highlightedItems_g = [];

const leoThreshold = 2000000; // kilometers
const meoThreshold = 35786000; // kilometers

$(document).ready(function () {
    $("#dateTimeBar").html((new Date()).toString());
    $("#dateSlider").slider({
        value: 0,
        min: -432000,
        max: 432000,
        animate: "slow",
        orientation: "horizontal",
        slide: function (event, ui) {
            let date = new Date(Date.now() + ui.value * 1000);
            $("#dateTimeBar").html(date.toString());
        }
    });
    $("#dateSlider").on("slidestop", function (event, ui) {
        systemTimeOffset_g = ui.value * 1000;
        updateDebrisInLayer();
        intervalId_g = setInterval(updateDebrisInLayer, systemTimeIncrease_g);
    });
    $("#dateSlider").on("slidestart", function (event, ui) {
        clearInterval(intervalId_g);
    });

    $("#timeReset").on('click', function () {
        systemTimeOffset_g = 0;
        $("#dateTimeBar").html((new Date()).toString());
        $("#dateSlider").slider('value', 0);
    });
});

function generateCanvas(color, size) {
    // Create the custom image for the placemark with a 2D canvas.
    const canvas = document.createElement("canvas");
    const ctx2d = canvas.getContext("2d");
    const c = size / 2 - 0.5;

    canvas.width = size;
    canvas.height = size;

    ctx2d.fillStyle = color;
    ctx2d.arc(c, c, c, 0, 2 * Math.PI, false);
    ctx2d.fill();
    return canvas;
}

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

    var clickRecognizer = new WorldWind.ClickRecognizer(wwd, handleClick);

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
        { layer: new WorldWind.CoordinatesDisplayLayer(wwd), enabled: false },
        { layer: new WorldWind.ViewControlsLayer(wwd), enabled: false },
    ];

    for (var l = 0; l < layers.length; l++) {
        layers[l].layer.enabled = layers[l].enabled;
        wwd.addLayer(layers[l].layer);
    }
    addDebrisToLayer();
}

function genPlaceMarker(latitude, longitude, altitude) {
    let colour;
    if (altitude < leoThreshold) {
        colour = '#96413A';
    } else if (altitude < meoThreshold) {
        colour = '#BECB3C';
    } else {
        colour = '#4BA85A';
    }

    // Set placemark attributes.
    var placemarkAttributes = new WorldWind.PlacemarkAttributes(null);
    // Wrap the canvas created above in an ImageSource object to specify it as the placemarkAttributes image source.
    placemarkAttributes.imageSource = new WorldWind.ImageSource(generateCanvas(colour, 8));
    // Define the pivot point for the placemark at the center of its image source.
    placemarkAttributes.imageOffset = new WorldWind.Offset(WorldWind.OFFSET_FRACTION, 0.5, WorldWind.OFFSET_FRACTION, 0.5);
    placemarkAttributes.imageScale = 1;
    placemarkAttributes.imageColor = WorldWind.Color.WHITE;

    // Set placemark highlight attributes.
    // Note that the normal attributes are specified as the default highlight attributes so that all properties
    // are identical except the image scale. You could instead vary the color, image, or other property
    // to control the highlight representation.
    var highlightAttributes = new WorldWind.PlacemarkAttributes(placemarkAttributes);
    highlightAttributes.imageScale = 1;
    highlightAttributes.imageSource = new WorldWind.ImageSource(generateCanvas(colour, 16));

    // Create the placemark with the attributes defined above.
    var placemarkPosition = new WorldWind.Position(latitude, longitude, altitude);
    var placemark = new WorldWind.Placemark(placemarkPosition, false, placemarkAttributes);
    // Draw placemark at altitude defined above, relative to the terrain.
    placemark.altitudeMode = WorldWind.RELATIVE_TO_GROUND;
    // Assign highlight attributes for the placemark.
    placemark.highlightAttributes = highlightAttributes;
    return placemark;
}

function getPositionAndVelocity(satrec) {
    /*
        Compute the location of the TLE lines at a specific time    
    */
    let time = new Date(Date.now() + systemTimeOffset_g);
    let positionAndVelocity = satellite.propagate(satrec, time);
    let positionEci = positionAndVelocity.position;

    let vX = positionAndVelocity.velocity.x,
        vY = positionAndVelocity.velocity.y,
        vZ = positionAndVelocity.velocity.z;

    let velocity = Math.sqrt(
        vX * vX +
        vY * vY +
        vZ * vZ
    );

    let gmst = satellite.gstime(time);

    let positionGd = satellite.eciToGeodetic(positionEci, gmst);
    let longitude = satellite.radiansToDegrees(positionGd.longitude),
        latitude = satellite.radiansToDegrees(positionGd.latitude),
        height = positionGd.height * 1000;

    return { latitude: latitude, longitude: longitude, altitude: height, velocity: velocity };
}

function parseDebris(tleArray) {
    let resultArray = [];

    tleArray.forEach(element => {
        try {
            let position = getPositionAndVelocity(satellite.twoline2satrec(element.Line1, element.Line2));
            resultArray.push({
                id: element.id,
                position: position,
            });
        } catch (err) {
        }
    });
    return resultArray;
}

function sanitizeTleArray(tleArray) {
    let faultyItems = 0;
    let resultArray = [];

    tleArray.forEach(element => {
        try {
            getPositionAndVelocity(satellite.twoline2satrec(element.Line1, element.Line2));
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

    intervalId_g = setInterval(updateDebrisInLayer, systemTimeIncrease_g);
}

function updateDebrisInLayer() {
    let time = new Date(Date.now() + systemTimeOffset_g);
    $("#dateTimeBar").html(time.toString());
    positionsArray_g = parseDebris(sanitizedTleArray_g);
    for (let i = 0; i < positionsArray_g.length; i++) {
        debrisLayer.renderables[i].position.latitude = positionsArray_g[i].position.latitude;
        debrisLayer.renderables[i].position.longitude = positionsArray_g[i].position.longitude;
        debrisLayer.renderables[i].position.altitude = positionsArray_g[i].position.altitude;
        debrisLayer.renderables[i].userProperties.velocity = positionsArray_g[i].position.velocity;
    }
    wwd.redraw();
    updateInfoTab();
}

var handleClick = function (recognizer) {
    var x = recognizer.clientX,
        y = recognizer.clientY;
    // Perform the pick. Must first convert from window coordinates to canvas coordinates, which are
    // relative to the upper left corner of the canvas rather than the upper left corner of the page.
    var rectRadius = 2,
        pickPoint = wwd.canvasCoordinates(x, y),
        pickRectangle = new WorldWind.Rectangle(pickPoint[0] - rectRadius, pickPoint[1] + rectRadius,
            2 * rectRadius, 2 * rectRadius);

    var pickList = wwd.pickShapesInRegion(pickRectangle);

    // De-highlight any highlighted placemarks.
    for (var h = 0; h < highlightedItems_g.length; h++) {
        highlightedItems_g[h].highlighted = false;
    }

    highlightedItems_g = [];

    if (pickList.objects.length > 0) {
        for (var p = 0; p < pickList.objects.length; p++) {
            if (pickList.objects[p].isOnTop) {
                // Highlight the items picked.
                pickList.objects[p].userObject.highlighted = true;
                highlightedItems_g.push(pickList.objects[p].userObject);
            }
        }
    }

    wwd.redraw();

    updateInfoTab();
};

function updateInfoTab() {
    if (highlightedItems_g.length > 0) {
        console.log(highlightedItems_g)
        $("#velocity").html(highlightedItems_g[0].userProperties.velocity.toFixed(2));
        $("#altitude").html(highlightedItems_g[0].position.altitude.toFixed(2));
        $("#latitude").html(highlightedItems_g[0].position.latitude.toFixed(4));
        $("#longitude").html(highlightedItems_g[0].position.longitude.toFixed(4));
        $("#debriInfo").show();
    } else {
        $("#debriInfo").hide();
    }
}