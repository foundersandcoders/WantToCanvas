var canvasNode = document.getElementById('gameCanvas');
var context = canvasNode.getContext('2d');

function setCanvas() {

    /*
     * Place the game canvas in the middle of the screen
     */

    // Get the width and height of the window
    var pw = canvasNode.parentNode.clientWidth;
    var ph = canvasNode.parentNode.clientHeight;

    // Make the canvas size 80% of the window size and
    // constrain the canvas aspect ratio to that of the screen
    canvasNode.height = pw * 0.8 * (canvasNode.height / canvasNode.width);
    canvasNode.width = pw * 0.8;

    // Centre the canvas in the window
    canvasNode.style.top = (ph - canvasNode.height) / 2 + "px";
    canvasNode.style.left = (pw - canvasNode.width) / 2 + "px";

}

function genTerrain(width, height, displace, roughness) {

    /* Stolen from http://www.somethinghitme.com/2013/11/11/simple-2d-terrain-with-midpoint-displacement/
     *
     * width and height are the overall width and height we have to work with, displace is
     * the maximum deviation value. This stops the terrain from going out of bounds if we choose
     */

    var points = [],
    // Gives us a power of 2 based on our width
    power = Math.pow(2, Math.ceil(Math.log(width) / (Math.log(2))));

    // Set the initial left point
    points[0] = height/2 + (Math.random()*displace*2) - displace;
    // set the initial right point
    points[power] = height/2 + (Math.random()*displace*2) - displace;
    displace *= roughness;

    // Increase the number of segments
    for(var i = 1; i < power; i *=2){
        // Iterate through each segment calculating the center point
        for(var j = (power/i)/2; j < power; j+= power/i){
            points[j] = ((points[j - (power / i) / 2] + points[j + (power / i) / 2]) / 2);
            points[j] += (Math.random()*displace*2) - displace
        }
        // reduce our random range
        displace *= roughness;
    }    
    return points;
}

function drawTerrain() {

// Generate the terrain points
var terrainPoints = genTerrain(canvasNode.width, canvasNode.height, canvasNode.height / 4, 0.6);

// draw the points
context.beginPath();
context.moveTo(0, terrainPoints[0]);
for (var t = 1; t < terrainPoints.length; t++) {
    context.lineTo(t, terrainPoints[t]);
}

// finish creating the rect so we can fill it
context.lineTo(canvasNode.width, canvasNode.height);
context.lineTo(0, canvasNode.height);
context.closePath();
context.fillStyle = "darkblue";
context.fill();
}

window.onresize = setCanvas;
setCanvas();
drawTerrain();
