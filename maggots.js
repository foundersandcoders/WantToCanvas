var canvas = document.getElementById('gameCanvas')
var context = canvas.getContext('2d')
var terrainHeight = 40
var gravity = 0.1
var characters = []
var deadCharacters = []
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
  drawUI()
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
    context.moveTo(char.positionX - (char.width / 2), canvas.height - terrainHeight)
    context.lineTo(char.positionX - (char.width / 2), canvas.height - terrainHeight - char.height)
    context.lineTo(char.positionX + (char.width / 2), canvas.height - terrainHeight - char.height)
    context.lineTo(char.positionX + (char.width / 2), canvas.height - terrainHeight)
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
    width: 15,
    height: 40,
    positionX: position,
    takeDamage: function (damage) {
      this.health = Math.round(this.health - damage)
      if (this.health <= 0) this.die()
    },
    die: function () {
      var self = this
      characters.forEach(function (char, index) {
        if (char == self) characters.pop(index)
      })
      deadCharacters.push(self)
      if (characters.length < 2) {
        console.log('game over man')
        endGame()
      }
    }
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
  * We're calling hammer.on three times here, to listen for three different types of events; 'panstart'
  * fires when the user starts to drag, 'pan' will fire every time the user drags their pointer on the 
  * canvas while their mouse or finger is pressed down, and 'panend' will fire once when they release. The 
  * second parameter passed to hammer.on parameter is the callback function that the input event is passed
  * to. Hammer will continue to listen and run these functions until we call hammer.off('pan') for each event 
  * to tell it to stop.
  */
  hammer.on('panstart', function (event) {
    // HammerJS tells us where the user started dragging relative to the page, not the canvas - translate here
    // We grab the position at the start of the drag and remember it to draw a nice arrow from
    var center = {
      x: event.center.x - canvas.getBoundingClientRect().left,
      y: event.center.y - canvas.getBoundingClientRect().top
    }
    hammer.on('pan', function (event) {
      // The distance of the drag is measured in pixels, so we have to standardise it before
      // translating it into the 'power' of our shot. You might want to console.log out event.angle
      // here to see how HammerJS gives us angles.
      var power = translateDistanceToPower(event.distance)
      drawAimArrow(center, event.angle, power)
    })
  })
  
  hammer.on('panend', function (event) {
    var angle = event.angle
    if (angle < 0) angle = 360 + event.angle
    //console.log(angle)
    // The player has stopped dragging, let loose!
    var power = translateDistanceToPower(event.distance)
    fireProjectile(characters[0], event.angle, power)
    // Stop listening to input until the next turn
    hammer.off('panstart pan panend')
  })
}

function translateDistanceToPower (distance) {
  // Divide the height of the canvas by the distance of our drag - we'll set a 'power limit' of 50% screen height
  var power = distance / canvas.height
  if (power > 0.5) power = 0.5
  // The maths are easier if our 'max power' is 100
  power = power * 200
  return power
}

function drawPlayerMarker (player) {
  // Get the position of the player and draw a lil white triangle above it
  var markerHeight = canvas.height - terrainHeight - player.height - 20
  context.beginPath()
  context.moveTo(player.positionX, markerHeight)
  context.lineTo(player.positionX - 20, markerHeight - 50)
  context.lineTo(player.positionX + 20, markerHeight - 50)
  context.closePath()
  context.fillStyle = 'white'
  context.fill()
}

function drawUI () {
  if (characters.length == 1) {
    var winner = characters[0]
    context.fillStyle = 'white'
    var text = '> '+ winner.colour +' player == "champion"'
    context.fillText(text, canvas.width / 2 - (context.measureText(text).width / 2), canvas.height / 2 - 20)
    context.fillText('true', canvas.width / 2 - (context.measureText(text).width / 2), canvas.height / 2 + 20)
  } else {
    var i = 1
    characters.forEach(function (char) {
      if (i == 1) context.fillStyle = 'green'
      else context.fillStyle = 'white'
      context.font = '20px courier'
      var text = char.colour + ': ' + char.health
      context.fillText(text, 30, i * 40)
      i++
    })
  }
}

function drawAimArrow (start, angle, power) {
  // Once we've detected player input, we draw an arrow to show the power & direction of their planned shot
  // Refresh the screen first
  render()
  // Do some maths I copied from the internet
  var radians = angle * Math.PI / 180
  var arrowToX = start.x - power * Math.cos(radians)
  var arrowToY = start.y - power * Math.sin(radians)
  // Draw the line
  context.moveTo(start.x, start.y)
  context.lineTo(arrowToX, arrowToY)
  context.strokeStyle = 'white'
  context.stroke()
}

function fireProjectile (player, angle, power) {
  render()
  // We use the angle to work out how many pixels we should move the projectile each frame
  var radians = angle * Math.PI / 180
  var stepX = (power * Math.cos(radians)) / 10
  var stepY = (power * Math.sin(radians)) / 10
  var projectile = {
    x: player.positionX,
    y: canvas.height - terrainHeight - player.height
  }

  // setInterval runs a function repeatedly until we tell it to stop. It returns an ID, which we store
  // here as projectileIntervalID, and tell it stop by calling clearInterval(projectileInterval) later on
  var projectileIntervalID = setInterval(function () {
    render()
    // Apply gravity to our vertical speed (remember negative Y = up in canvas!)
    stepY -= gravity
    // Move the projectile and draw it
    projectile.x -= stepX
    projectile.y -= stepY
    if (projectile.y >= canvas.height - terrainHeight) {
      // If the projectile has hit the floor, explode it and go to next turn
      impactProjectile(projectile, 75)
      clearInterval(projectileIntervalID)
      nextTurn()
    } else {
      drawProjectile(projectile)
    }
  }, 10)
}

function drawProjectile (projectile) {
  context.beginPath()
  context.arc(projectile.x, projectile.y, 10, 0, 2 * Math.PI, false)
  context.fillStyle = 'white'
  context.fill()
}

function impactProjectile (projectile, explosionSize) {
  // Start an interval to draw an expanding circle until it's bigger than our explosionSize
  var radius = 1
  var explosionIntervalID = setInterval(function () {
    render()
    if (radius > explosionSize) {
      clearInterval(explosionIntervalID)
      return
    }
    context.beginPath()
    context.arc(projectile.x, projectile.y, radius, 0, 2 * Math.PI, false)
    context.fillStyle = 'gray'
    context.fill()
    radius += 5
  }, 100)
  characters.forEach(function (char) {
    var distance = projectile.x - char.positionX
    if (distance < 0) distance = 0 - distance
    console.log('distance:', distance)
    console.log('damage:', explosionSize - distance)
    if (distance < explosionSize) {
      char.takeDamage(explosionSize - distance)
    }
  })
}

function endGame () {
  // drawUI checks the length of the characters array and displays game over, so we just render
  render()
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
