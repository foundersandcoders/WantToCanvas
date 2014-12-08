var canvas = document.getElementById('gameCanvas')
var context = canvas.getContext('2d')
var terrainHeight = 40
var characters = []
// Setup HammerJS, the mouse/touch gesture library we'll use for the controls
var hammer = new Hammer(canvas)
// HammerJS only listens for horizontal drags by default, here we tell it listen for all directions
hammer.get('pan').set({ direction: Hammer.DIRECTION_ALL })

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

  /*
   * Draw everything on the screen
   * We wrap all this in its own function so we can redraw everything whenever we update something
   */

  drawBackground()
  drawFlatTerrain(terrainHeight)
  drawCharacters()
  // The current player should always be at the top of the characters array until we call nextTurn()
  drawPlayerMarker(characters[0])
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
  // Loop through characters and draw them; remember that the top-left corner is 0,0 in canvas!
  characters.forEach(function (char) {
    context.beginPath()
    context.moveTo(char.xPosition - (char.width / 2), canvas.height - terrainHeight)
    context.lineTo(char.xPosition - (char.width / 2), canvas.height - terrainHeight - char.height)
    context.lineTo(char.xPosition + (char.width / 2), canvas.height - terrainHeight - char.height)
    context.lineTo(char.xPosition + (char.width / 2), canvas.height - terrainHeight)
    context.closePath()
    context.fillStyle = char.colour
    context.fill()
  })
}

function genTerrain (width, height, displace, roughness) {
  // We're not using this at the moment until we work out how to get our characters to navigate bumpy terrain

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

function drawTerrain () {
  // We're not using this at the moment until we work out how to get our characters to navigate bumpy terrain

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

function drawFlatTerrain (height) {
  // Draw a flat line across the screen at
  context.beginPath()
  context.moveTo(0, canvas.height - height)
  context.lineTo(canvas.width, canvas.height - height)
  context.lineTo(canvas.width, canvas.height)
  context.lineTo(0, canvas.height)
  context.closePath
  context.fillStyle = 'darkgreen'
  context.fill()
}

function makeCharacter (colour, position) {
  // Return an object that describes our new character
  var character = {
    health: 100,
    colour: colour,
    width: 50,
    height: 20,
    xPosition: position
  }
  return character
}

function placeCharacters () {
  // Make 2 players and place them at either end of the screen
  var blueCharacter = makeCharacter('red', 40)
  var yellowCharacter = makeCharacter('yellow', canvas.width - 40)
  // Put our characters into the characters array
  characters.push(blueCharacter)
  characters.push(yellowCharacter)
}

function nextTurn () {
  // We take the last character from our array of characters and 'pop' it off - this is our current player
  var player = characters.pop()
  // We then put that character back at the start of the array, using the bizarrely-named 'unshift'
  characters.unshift(player)
  console.log('Starting turn for '+ player.colour +' player')
  // Redraw the screen, to update the marker position
  render()

  // Start listening for the start of a mouse/finger drag
  /*
  * We're calling hammer.on twice here, to listen for two different types of events; 'pan' will fire
  * every time the user drags their pointer on the canvas while their mouse or finger is pressed down,
  * and 'panend' will fire once when they release. The second parameter passed to hammer.on parameter 
  * is the callback function that the input event is passed to. Hammer will continue to listen and run
  * these functions until we call hammer.off('pan') and hammer.off('panend') to tell it to stop.
  */
  hammer.on('pan', function (event) {
    var angle = event.angle
    // The distance of the drag is measured in pixels, so we have to standardise it before
    // translating it into the 'power' of our shot
    var power = translateDistanceToPower(event.distance)
    drawAimArrow(angle, power)
  })
  hammer.on('panend', function (event) {
    // The player has stopped dragging, let loose!
    console.log('angle', event.angle)
    console.log('distance', event.distance)
    console.log('Fire!')
  })
}

function translateDistanceToPower (distance) {
  // Divide the height of the canvas by the distance of our drag - we'll set a 'power limit' of 50% screen height
  var power = canvas.height / distance
  if (power > 0.5) power = 0.5
  // The maths are easier if our 'max power' is 100
  power = power * 200
  return power
}

function drawPlayerMarker (player) {
  // Get the position of the player and draw a lil white triangle above it
  var markerHeight = canvas.height - terrainHeight - player.height - 20
  context.beginPath()
  context.moveTo(player.xPosition, markerHeight)
  context.lineTo(player.xPosition - 20, markerHeight - 50)
  context.lineTo(player.xPosition + 20, markerHeight - 50)
  context.closePath()
  context.fillStyle = 'white'
  context.fill()
}

function drawAimArrow (angle, power) {
  // Once we've detected player input, we draw an arrow to show the power & direction of their planned shot
  console.log(angle, power)
}

/*
 * Main screen turn on...
 */

// If the window size changes, adjust the canvas to match
window.onresize = function () {
  setCanvas()
  render()
}
setCanvas()
placeCharacters()
nextTurn()
render()
