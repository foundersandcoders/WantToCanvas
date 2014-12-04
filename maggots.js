var canvas = document.getElementById('gameCanvas')
var context = canvas.getContext('2d')
var terrainHeight = 40
var characters = []
// Setup HammerJS, the mouse/touch gesture library we'll use for the controls
var hammertime = new Hammer(canvas)

function setCanvas() {

  /*
   * Place the game canvas in the middle of the screen
   */

  // Get the width and height of the window
  var pw = canvas.parentNode.clientWidth
  var ph = canvas.parentNode.clientHeight

  // Make the canvas size 80% of the window size and
  // constrain the canvas aspect ratio to that of the screen
  canvas.height = pw * 0.8 * (canvas.height / canvas.width)
  canvas.width = pw * 0.8

  // Centre the canvas in the window
  canvas.style.top = (ph - canvas.height) / 2 + 'px'
  canvas.style.left = (pw - canvas.width) / 2 + 'px'

}

function render () {
  drawBackground()
  drawFlatTerrain()
  drawCharacters()
}

function drawBackground() {

  /*
   * Style the background
   */

  // Draw a rectangle to cover the entire canvas
  context.rect(0, 0, canvas.width, canvas.height)

  // Fill the rectangle with a linear gradient
  var grd = context.createLinearGradient(0, 0, 0, canvas.height)
  grd.addColorStop(0, 'lightblue')
  grd.addColorStop(1, 'blue')
  context.fillStyle = grd
  context.fill()

}

function drawCharacters () {
  characters.forEach(function (char) {
    context.beginPath()
    // Bottom left corner: character's X position minus half its width, height of ground
    context.moveTo(char.xPosition - (char.width / 2), canvas.height - terrainHeight)
    // Top left corner: character's X position minus half its width, height of ground + height of character
    context.lineTo(char.xPosition - (char.width / 2), canvas.height - terrainHeight - char.height)
    // Top right corner: character's X position plus half its width, height of ground + height of character
    context.lineTo(char.xPosition + (char.width / 2), canvas.height - terrainHeight - char.height)
    // Bottom right corner: character's X position + plus half its width, height of ground
    context.lineTo(char.xPosition + (char.width / 2), canvas.height - terrainHeight)
    context.closePath()
    context.fillStyle = char.colour
    context.fill()
  })
}


function genTerrain(width, height, displace, roughness) {

  /*
   * Stolen from http://www.somethinghitme.com/2013/11/11/simple-2d-terrain-with-midpoint-displacement/
   *
   * width and height are the overall width and height we have to work with, displace is
   * the maximum deviation value. This stops the terrain from going out of bounds if we choose
   */

   var points = [],
  // Gives us a power of 2 based on our width
  power = Math.pow(2, Math.ceil(Math.log(width) / (Math.log(2))))

  // Set the initial left point
  points[0] = height/2 + (Math.random()*displace*2) - displace
  // set the initial right point
  points[power] = height/2 + (Math.random()*displace*2) - displace
  displace *= roughness

  // Increase the number of segments
  for(var i = 1; i < power; i *=2){
      // Iterate through each segment calculating the center point
      for(var j = (power/i)/2; j < power; j+= power/i){
        points[j] = ((points[j - (power / i) / 2] + points[j + (power / i) / 2]) / 2)
        points[j] += (Math.random()*displace*2) - displace
      }
      // reduce our random range
      displace *= roughness
    }
    return points

  }

  function drawFlatTerrain () {
    context.beginPath()
    context.moveTo(0, canvas.height - terrainHeight)
    context.lineTo(canvas.width, canvas.height - terrainHeight)
    context.lineTo(canvas.width, canvas.height)
    context.lineTo(0, canvas.height)
    context.closePath
    context.fillStyle = 'darkgreen'
    context.fill()
  }

  function drawTerrain() {

  /*
   * Draw a random-looking terrain on the screen
   */

  // Generate the terrain points
  var terrainPoints = genTerrain(canvas.width, canvas.height, canvas.height / 4, 0.6)

  // Draw the points
  context.beginPath()
  context.moveTo(0, terrainPoints[0])
  for (var t = 1; t < terrainPoints.length; t++) {
    context.lineTo(t, terrainPoints[t])
  }

  // Finish creating the rectangle so we can fill it
  context.lineTo(canvas.width, canvas.height)
  context.lineTo(0, canvas.height)
  context.closePath()

  // Terrain styling
  context.fillStyle = 'darkgreen'
  context.fill()
}

// Return an object that describes our new character
function makeCharacter (colour, position) {
  var character = {
    health: 100,
    colour: colour,
    width: 50,
    height: 20,
    xPosition: position
  }
  return character
}

// Make 2 players and place them at either end of the screen
function placeCharacters () {
  var blueCharacter = makeCharacter('red', 40)
  var yellowCharacter = makeCharacter('yellow', canvas.width - 40)
  // Put our characters into the characters array
  characters.push(blueCharacter)
  characters.push(yellowCharacter)
}

function nextTurn () {
  // Redraw the screen to remove the previous player marker
  render()
  // We take the last character from our list of characters and 'pop' it off - this is our current player
  var player = characters.pop()
  // We then put that character back at the top of the list, using the bizarrely-named 'unshift'
  characters.unshift(player)
  // Add a marker above the current player
  drawPlayerMarker(player)
  // Start listening for input
  hammertime.on('pan', function (event) {
    console.log(event)
  })
}

function drawPlayerMarker (player) {
  var markerHeight = canvas.height - terrainHeight - player.height - 20
  context.beginPath()
  context.moveTo(player.xPosition, markerHeight)
  context.lineTo(player.xPosition - 20, markerHeight - 50)
  context.lineTo(player.xPosition + 20, markerHeight - 50)
  context.closePath()
  context.fillStyle = 'white'
  context.fill()
}

/*
 * Main screen turn on...
 */

// If the window size changes, adjust the canvas to match
window.onresize = setCanvas

setCanvas()
drawBackground()
drawFlatTerrain()
placeCharacters()
drawCharacters()
nextTurn()
