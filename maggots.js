// Set up the state of our game first
var terrainHeight = 100
var characters = []
var deadCharacters = []
var sleepVelocityThreshold = 0.005
var canSleep = false
var shouldSleep = false

/*
 * Start PhysicsJS, which will also handle rendering for us. We run the game from inside this function
 */

Physics(function (world) {
  // create a renderer
  var renderer = Physics.renderer('canvas', {
    el: 'viewport',
    width: window.innerWidth,
    height: window.innerHeight
  })

  viewportBounds = Physics.aabb(0, 0, window.innerWidth, window.innerHeight)

  // Setup HammerJS, the mouse/touch gesture library we'll use for the controls
  var hammer = new Hammer(renderer.el)
  // HammerJS only listens for horizontal drags by default, here we tell it listen for all directions
  hammer.get('pan').set({ direction: Hammer.DIRECTION_ALL })

  // add the renderer to the world
  world.add(renderer)
  // render on each step
  world.on('step', function () {
    if (canSleep) {
      shouldSleep = characters.every(function (char) {
        return char.state.vel.x < sleepVelocityThreshold && char.state.vel.y < sleepVelocityThreshold
      })
      if (shouldSleep) {
        console.log('Going to sleep')
        world.pause()
      }
    }
    world.render()
  })

  // resize canvas when the browser is resized
  window.addEventListener('resize', function () {
    renderer.el.width = window.innerWidth
    renderer.el.height = window.innerHeight
    viewportBounds = Physics.aabb(0, 0, viewWidth, viewHeight)
  }, true)

  Physics.util.ticker.on(function (time) {
    world.step(time)
  })

  // Make our terrain and add it to the world
  world.add(makeTerrain(world))
  // Add each of our characters to the world
  characters = getCharacters(world)
  characters.forEach(function (character) {
    world.add(character)
  })
  // Add gravity and collision detection
  world.add([
    Physics.behavior('constant-acceleration'),
    Physics.behavior('body-impulse-response'),
    Physics.behavior('body-collision-detection'),
    Physics.behavior('sweep-prune')
  ])

  Physics.util.ticker.start()
  setTimeout(function () {
    canSleep = true
  }, 500)

  genTerrain()
})

function genTerrain (height, floor, world) {
  var renderer = world.renderer()
  var xPoints = []
  var yPoints = []
  // Get a number between 5 and 15. This will be the number of angles along our line
  var numberOfPoints = Math.round(5 + (Math.random() * 10))
  // Loop through this number of times, generating a number at least as high as 'floor' and as large as 'floor + height'
  // These will represent the height of the peaks and valleys of our terrain
  for (var i = 0; i < numberOfPoints; i++) {
    var point = floor + (Math.random() * height)
    yPoints.push(point)
  }
  // We do something similar again, to decide how far apart these points are on the X axis, adding each the previous value to
  // each new random number
  for (var i = 0; i < numberOfPoints; i++) {
    if (i > 0) var point = xPoints[i - 1] + 10 + (Math.random() * 100)
    else var point = 10 + (Math.random() * 100)
    xPoints.push(point)
  }
  // However, we now have a range of points on the X axis that may be larger than the width of our screen, so we squash them down
  // Get the last point and divide it by the screen width, then multiply all points by this number
  var squashFactor = renderer.el.width / xPoints[xPoints.length - 1]
  console.log('exes:', xPoints, 'squash:', squashFactor)
  var terrainVertices = xPoints.map(function (xPoint, i) {
    return {
      x: Math.round(xPoint * squashFactor),
      y: Math.round(renderer.el.height - yPoints[i])
    }
  })
  terrainVertices[terrainVertices.length - 1].x = renderer.el.width
  terrainVertices[0].x = 0
  terrainVertices.push({ x: renderer.el.width, y: renderer.el.height })
  terrainVertices.push({ x: 0, y: renderer.el.height })
  console.log(terrainVertices)
}

function makeTerrain (world) {
  var renderer = world.renderer()
  /*
  * Make a polygon as wide as the screen with a bumpy top and a flat bottom, to be the floor
  */

  // genTerrain makes a list of random numbers to represent the height of the floor going across the screen
  var terrainVertices = genTerrain(renderer.el.height / 2, renderer.el.height / 6, world)
  //console.log(heightMap)
  /*
  * Array.map() is a neato functional way of turning an array into another array - here we're looping through our
  * heightmap, treating each value as our y value and the current index as our x value, to return a list of vertices
  */
  // Add a bottom-right and bottom-left corner to our polygon - PhysicsJS will close it off for us

  //console.log(terrainVertices)
  var terrain = Physics.body('convex-polygon', {
    x: renderer.el.width / 2,
    y: renderer.el.height - (terrainHeight / 6),
    vertices: terrainVertices,
    styles: {
      fillStyle: '#EB816A'
    }
    //vertices: terrainVertices
  })
  // Tell PhysicsJS that this shouldn't move
  terrain.treatment = 'static'

  return terrain
}

function makeCharacter (colour, position) {
  console.log(colour, position)
  var body = Physics.body('rectangle', {
    x: position.x,
    y: position.y,
    width: 50,
    height: 50,
    styles: {
      fillStyle: colour
    }
  })
  body.treatment = 'dynamic'
  body.cof = 1
  body.restitution = 0.00001
  body.mass = 1
  // Return an object that describes our new character
  body.gameData = {
    health: 100,
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
  return body
}

function getCharacters (world) {
  var renderer = world.renderer()
  var characters = []
  characters.push(makeCharacter('#E9FA8F', { x: renderer.el.width * 0.1, y: renderer.el.height - terrainHeight - 200 }))
  characters.push(makeCharacter('#FFA6C0', { x: renderer.el.width * 0.9, y: renderer.el.height - terrainHeight - 200 }))
  return characters
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

//setCanvas()
// placeCharacters()
// nextTurn()
//render()
