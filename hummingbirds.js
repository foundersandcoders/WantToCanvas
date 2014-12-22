/* Global parameters */

// Short names for strings we display to the user as messages
var messages = {
    'aiming-jump': 'Aim a jump by dragging in the opposite direction',
    'aiming-shot': 'Shots bounce once before exploding'
}

// Readable names for colours
var styles = {
    colours: {
        sky: '#58A2C4',
        ground: '#FFFFFF',
        player1: '#CB461D',
        player2: '#10326F',
        ball1: '#AE1E3B',
        ball2: '#AE1E3B',
        explosion: '#F1D432',
        jumpArrow: '#FFFFFF',
        shotArrow: '#AE1E3B'
    }
}


/* Game initialisation */

// Set up the initial game state
var game = {
    characters: [],
    currentTurn: {
        state: null,
        actionsRemaining: 0
    },
    explosions: [],
    aimArrow: null,
    activeObjects: []
}

// Set up a canvas in which we will draw the UI elements that are not part of the
// PhysicsJS model, and from which we will receive UI events from HammerJS.
var uiCanvas = document.getElementById('ui')
uiCanvas.width = window.innerWidth
uiCanvas.height = window.innerHeight
var uiContext = uiCanvas.getContext('2d')

// A second canvas in which we will render the PhysicsJS model elements.
// We'll set this once we've started PhysicsJS and got a renderer
var canvas

// Global variable in which to store the ID of the edge detection behaviour for use in the fireProjectile function
var edgeUid

// Set up HammerJS, the mouse/touch gesture library we'll use for the controls
var hammer = new Hammer(uiCanvas)
// HammerJS only listens for horizontal drags by default. Here we tell it listen for all directions
hammer.get('pan').set({
    direction: Hammer.DIRECTION_ALL
})


/* Physics model configuration and main game-engine loop */

/* 1. Start PhysicsJS
 * 2. Create a world and initialise its physics model
 * 3. Add game elements to the physics model
 * 4. Set up and start the main game loop
 */

Physics({
    // Configuration options for the physics model go here
    sleepVarianceLimit: 1
},
// Create a world object to contain the physics model.
// Doing it this way avoids polluting the global scope - so we could add more
// "worlds" if we wanted to in future.
function (world) {

    // create a renderer (the user's viewport into the physics simulation)
    var renderer = Physics.renderer('canvas', {
        el: 'viewport', // ID of HTML canvas element to which to bind the renderer
        width: window.innerWidth,
        height: window.innerHeight
    })

    // Variable to hold the canvas to which we will render the physics-model output
    // (declared in the global scope in the initialisation section above)
    canvas = renderer.el

    // Add 10000 to the ceiling of the world, so that shots can arc off the top of the screen
    viewportBounds = Physics.aabb(0, -10000, window.innerWidth, window.innerHeight + 10000)

    // Add the renderer to the physics model
    world.add(renderer)

    // Add gravity and collision-detection to the physics model
    var edgeBehaviour = Physics.behavior('edge-collision-detection', {
        aabb: viewportBounds,
        restitution: 0.99,
        cof: 0.8
    })
    // We need to remember the ID of the edge detection behaviour for use in the fireProjectile function
    edgeUid = edgeBehaviour.body.uid
    world.add([
        Physics.behavior('constant-acceleration'),
        Physics.behavior('body-impulse-response'),
        Physics.behavior('body-collision-detection'),
        Physics.behavior('sweep-prune'),
        edgeBehaviour
    ])

    // Make our terrain and add it to the world
    var terrain = genTerrain(canvas.height * 0.9, canvas.height * 0.23, world)
    world.add(terrain)

    // Add our characters to the world
    game.characters = getCharacters(world)
    game.characters.forEach(function (character) {
        game.activeObjects.push(character)
        world.add(character)
    })

    // Resize both the UI and the physics canvases when the browser is resized
    // TODO: Factor out into named function to reduce code repetition?
    window.addEventListener('resize', function () {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
        uiCanvas.width = window.innerWidth
        uiCanvas.height = window.innerHeight
        viewportBounds = Physics.aabb(0, 0, window.innerWidth, window.innerHeight)
    }, true)

    // Render the physics model on each step, and check if all objects have to come to rest
    world.on('step', function () {
        world.render()
    })

    // Draw the UI and advance the physics simulation on each step
    Physics.util.ticker.on(function (time) {
        drawUI()
        var sleeping = game.activeObjects.every(function (object) {
            return object.asleep
        })
        if (sleeping && game.currentTurn.actionsRemaining == 0) nextTurn(world)
            world.step(time)
        })

    // Start the ticker
    Physics.util.ticker.start()
})


function drawUI () {
    // We draw anything not governed by the physics engine in this function

    // Erase the uiContext and make the area transparent
    uiContext.clearRect(0, 0, uiCanvas.width, uiCanvas.height)

    // Draw any ongoing explosions
    game.explosions.forEach(function (explosion, i) {
        // Remove explosions that have reached the maximum size
        // so that they do not render on subsequent ticks
        if (explosion.size >= explosion.maxSize) {
            game.explosions.splice(i, 1)
        }
        uiContext.beginPath()
        uiContext.arc(explosion.position.x, explosion.position.y, explosion.size, 0, Math.PI * 2, false)
        uiContext.lineWidth = explosion.size * 0.1
        uiContext.strokeStyle = styles.colours.ball1
        uiContext.fillStyle = styles.colours.explosion
        uiContext.stroke()
        uiContext.fill()
        explosion.size += explosion.size * 0.4
    })

    // Draw any aim-arrow line
    if (game.aimArrow && game.aimArrow.power > 10) {
        // Calculate line end-point from start point and vector
        var radians = game.aimArrow.angle * Math.PI / 180
        var arrowToX = game.aimArrow.start.x - (game.aimArrow.power * Math.cos(radians) * 2)
        var arrowToY = game.aimArrow.start.y - (game.aimArrow.power * Math.sin(radians) * 2)
        // Draw the line
        uiContext.moveTo(game.aimArrow.start.x, game.aimArrow.start.y)
        uiContext.lineTo(arrowToX, arrowToY)
        if (game.currentTurn.state == 'aiming-jump') {
            uiContext.strokeStyle = styles.colours.jumpArrow
        }
        if (game.currentTurn.state == 'aiming-shot') {
            uiContext.strokeStyle = styles.colours.shotArrow
        }
        uiContext.lineWidth = 2
        uiContext.stroke()
        uiContext.beginPath()
        uiContext.arc(game.aimArrow.start.x, game.aimArrow.start.y, 200, radians - 0.02 + Math.PI, radians + 0.02 + Math.PI)
        uiContext.stroke()
    }

    // Draw on-screen messages
    uiContext.fillStyle = 'white'
    var messageText = messages[game.currentTurn.state]

    if (messageText && game.state != 'gameover') {
        // The game is in progress - draw the appropriate instruction-message for the current game state
        uiContext.fillText(messageText, canvas.width - 30 - (uiContext.measureText(messageText).width), 40)
    }

    if (game.state == 'gameover') {
        // The game is over - draw the game over message
        uiContext.fillStyle = 'white'
        uiContext.fillText('Game over!', canvas.width / 2 - (uiContext.measureText('Game over').width / 2), canvas.height / 2 - 20)
    }
    else {
        // The game is in progress - draw the player names and health-counters
        var i = 0
        game.characters.forEach(function (char) {
            uiContext.fillStyle = styles.colours[game.characters[i].gameData.name]
            uiContext.font = '20px courier'
            var text = char.gameData.name + ': ' + char.gameData.health
            uiContext.fillText(text, 30, (i + 1) * 40)
            i++
        })
        // Draw a marker over the current player's character
        drawPlayerMarker(game.characters[0])
    }
}


function drawPlayerMarker (player) {
    // Get the position of the player and draw a lil white triangle above it
    uiContext.beginPath()
    uiContext.moveTo(player.state.pos.x, player.state.pos.y - 70)
    uiContext.lineTo(player.state.pos.x - 10, player.state.pos.y - 90)
    uiContext.lineTo(player.state.pos.x + 10, player.state.pos.y - 90)
    uiContext.closePath()
    uiContext.strokeStyle = 'white'
    uiContext.lineWidth = 3
    uiContext.stroke()
}


function makeCharacter (name, position, world) {
    // Return an object that describes our new character

    // TODO: remove debug code
    console.log(name, position)

    var body = Physics.body('compound', {
        x: position.x,
        y: position.y,
        styles: {
            fillStyle: styles.colours[name],
            lineWidth: 0
        },
        children: [
            Physics.body('circle', {
                x: 0,
                y: 0,
                radius: 5
            }),
            Physics.body('convex-polygon', {
                x: 0,
                y: -25,
                vertices: [
                    { x: 0, y: -10 },
                    { x: -10, y: -55 },
                    { x: 10, y: -55 }
                ]
            })
        ]
    })
    body.treatment = 'dynamic'
    body.cof = 0.95
    //body.offset = { x: 0, y: 50 }
    body.restitution = 0
    body.mass = 0.00001
    //body.view = new Image(20, 120)
    //body.view.src = 'img/' + name + '.png'
    body.gameData = {
        name: name,
        health: 100,
        takeDamage: function (damage) {
            // Reduces the health of the character by 'damage' points when it is hit
            this.health = Math.round(this.health - damage)
            if (this.health <= 0) {
                this.die()
            }
        },
        die: function () {
            // Ends the game when the character dies
            console.log('game over man')
            game.state = 'gameover'
        }
    }
    return body
}


function getCharacters (world) {
    // Creates two characters and adds them to the physics model on opposite sides of the canvas
    var renderer = world.renderer()
    var chars = []
    chars.push(makeCharacter('player1', {
        x: canvas.width * 0.1,
        y: canvas.height * 0.3
    }, world))
    chars.push(makeCharacter('player2', {
        x: canvas.width * 0.9,
        y: canvas.height * 0.3
    }, world))
    return chars
}


function aim (world, callback) {
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
            x: event.center.x - uiCanvas.getBoundingClientRect().left,
            y: event.center.y - uiCanvas.getBoundingClientRect().top
        }
        hammer.on('pan', function (event) {
            // The distance of the drag is measured in pixels, so we have to standardise it before
            // translating it into the 'power' of our shot. You might want to console.log out event.angle
            // here to see how HammerJS gives us angles.
            var power = translateDistanceToPower(event.distance)
            game.aimArrow = {
                start: center,
                angle: event.angle,
                power: power
            }
        })
    })

    hammer.on('panend', function (event) {
        var power = translateDistanceToPower(event.distance)
        if (power <= 10) return
        hammer.off('panstart pan panend')
        // The user has stopped dragging, let loose!
        callback(event.angle, power, world)
        game.aimArrow = null
        // Stop listening to input until the next turn
    })
}


function nextTurn (world) {
    // We take the last character from our array of characters and 'pop' it off - this is our current player
    var player = game.characters.pop()
    // We then put that character back at the start of the array, using the bizarrely-named 'unshift'
    game.characters.unshift(player)
    game.characters.forEach(function (char) {
        char.cof = 0.95
        char.restitution = 0
    })

    // Set the sequence of actions for each turn:
    // 1. Aim jump
    // 2. Jump / aim shot
    // 3. Fire
    game.currentTurn.actionsRemaining = 3
    game.currentTurn.state = 'aiming-jump'
    aim(world, function (angle, power, world) {
        jump(angle, power, world, function (world) {
            game.currentTurn.state = 'aiming-shot'
            aim(world, function (angle, power, world) {
                fireProjectile(angle, power, world)
            })
        })
    })
}


function jump (angle, power, world, callback) {
    // Applies a force to the current character according to the arrow drawn by the user.
    // The character then jumps across the world, governed by the physics model.
    world.wakeUpAll()
    var player = game.characters[0]
    game.currentTurn.actionsRemaining--
    game.currentTurn.state = 'jumping'
    var radians = angle * Math.PI / 180
    var stepX = (power * Math.cos(radians)) / 130000000
    var stepY = (power * Math.sin(radians)) / 130000000
    player.treatment = 'dynamic'
    player.cof = 0.95
    player.applyForce({
        x: -stepX,
        y: -stepY
    })
    game.activeObjects.push(player)
    callback(world)
}


function fireProjectile (angle, power, world) {
    var player = game.characters[0]
    game.currentTurn.actionsRemaining--
    game.currentTurn.state = 'firing'
    game.characters.forEach(function (char) {
        char.treatment = 'static'
    })
    // We use the angle to work out how many pixels we should move the projectile each frame
    var radians = angle * Math.PI / 180
    var stepX = (power * Math.cos(radians)) / 8000
    var stepY = (power * Math.sin(radians)) / 8000
    var startX = Math.cos(radians) * 40
    var startY = Math.sin(radians) * 40
    console.log(startX, startY)

    // Instantiate a new projectile and add it to the physics model
    var projectile = Physics.body('circle', {
        x: player.state.pos.x - startX,
        y: player.state.pos.y - startY,
        radius: 8,
        styles: {
            fillStyle: styles.colours.ball1
        }
    })
    projectile.restitution = 0.5
    projectile.cof = 0.1
    projectile.mass = 0.1
    projectile.applyForce({
        x: -stepX,
        y: -stepY
    })
    projectile.gameData = {
        bounced: 0
    }

    world.add(projectile)
    game.activeObjects.push(projectile)

    // Detect and handle collisions between projectiles and other objects
    world.on('collisions:detected', function (data) {
        data.collisions.forEach(function (collision) {
            var impactedProjectile
            // Get the object that has collided and check whether it is a projectile
            if (collision.bodyA.uid == projectile.uid) {
                impactedProjectile = collision.bodyA
            }
            if (collision.bodyB.uid == projectile.uid) {
                impactedProjectile = collision.bodyB
            }
            if (impactedProjectile) {
                // A projectile has hit something. Figure out what and take appropriate action
                if (collision.bodyA.uid == edgeUid || collision.bodyB.uid == edgeUid) {
                    // The projectile hit the edge of the viewport.
                    // It does not bounce...
                    projectile.gameData.bounced++
                    // ...and explodes with no effect.
                    impactProjectile(impactedProjectile, 0, 0, world)
                }
                else if ((collision.bodyA.gameData && collision.bodyA.gameData.name) || (collision.bodyB.gameData && collision.bodyB.gameData.name)) {
                    // The projectile hit a player.
                    // Prevent further bouncing...
                    projectile.gameData.bounced++
                    // ... and make the projectile explode with maximum effect
                    impactProjectile(impactedProjectile, 100, 0.5, world)
                }
                else {
                    // The projectile hit the terrain.
                    // Make it bounce if it hasn't already. Otherwise explode with maximum effect.
                    impactProjectile(impactedProjectile, 100, 0.5, world)
                }
            }
        })
    })
}


function impactProjectile (projectile, explosionSize, damageFactor, world) {

    // Increase the projectile's bounce count after a delay of 25ms
    setTimeout(function () {
        projectile.gameData.bounced++
    }, 25)

    // If the projectile has not yet bounced, channge its colour, but don't do anything else
    // as it has not yet reached its final position
    if (projectile.gameData.bounced == 0) {
        projectile.styles.fillStyle = styles.colours.ball2
        return
    }

    // If we did not return above, it means the projectile has reached its destination, and
    // must now explode.
    game.explosions.push({
        position: projectile.state.pos,
        maxSize: explosionSize,
        size: 1
    })

    // Process the effects of the explosion on all characters
    // TODO: Use some other local variable-name than 'char' (which is reserved)?
    game.characters.forEach(function (char) {
        var relativePosition = {
            x: char.state.pos.x - projectile.state.pos.x,
            y: char.state.pos.y - projectile.state.pos.y
        }
        var distance = Math.sqrt(Math.pow((relativePosition.x), 2) + Math.pow((relativePosition.y), 2))
        var radians = Math.atan2(relativePosition.y, relativePosition.x)

        if (distance < explosionSize) {
            // The character is inside the blast radius and will take damage
            world.wakeUpAll()
            // Damage falls off linearly with relative distance between explosion and character
            char.gameData.takeDamage((explosionSize - distance) * damageFactor)

            // The explosion applies a force to the character that is inversely proportional
            // to the the distance between them
            var stepX = (explosionSize * Math.cos(radians)) / distance / 4000000
            var stepY = (explosionSize * Math.sin(radians)) / distance / 4000000
            char.treatment = 'dynamic'
            char.restitution = 1
            char.cof = 0
            char.applyForce({
                x: stepX,
                y: stepY
            })
        }
    })

    // The projectile has exploded so we remove it from the physics model
    world.removeBody(projectile)
    game.activeObjects.forEach(function (object, i) {
        if (object.uid == projectile.uid) {
            game.activeObjects.splice(i, 1)
        }
    })

    game.currentTurn.actionsRemaining--
    nextTurn(world)
}


function translateDistanceToPower (distance) {
    // Divide the height of the canvas by the distance of our drag - we'll set a 'power limit' of 50% screen height
    var power = distance / canvas.height
    if (power > 0.5) {
        power = 0.5
    }
    // The maths are easier if our 'max power' is 100
    power = power * 200
    return power
}


function genTerrain (floor, height, world) {
    var renderer = world.renderer()
    var xPoints = []
    var yPoints = []
    // Get a number between 5 and 15. This will be the number of angles along our line
    var numberOfPoints = Math.round(10 + (Math.random() * 20))
    // Loop over this number, generating a number at least as high as 'floor' and as large as 'floor + height'
    // These will represent the height of the peaks and valleys of our terrain
    for (var i = 0; i < numberOfPoints; i++) {
        var point = floor + (Math.random() * height)
        yPoints.push(point)
    }
    // We do something similar again to decide how far apart these points are on the X axis, adding the previous value to
    // each new random number so we get an increasing list of numbers with random gaps between them
    for (var i = 0; i < numberOfPoints; i++) {
        if (i > 0) {
            var point = xPoints[i - 1] + 10 + (Math.random() * 100)
        }
        else {
            var point = 10 + (Math.random() * 100)
        }
        xPoints.push(point)
    }
    // However, we now have a range of points on the X axis that may be larger than the width of our screen, so we squash them down
    // Get the last point and divide it by the screen width, then multiply all points by this number
    var squashFactor = canvas.width / (xPoints[xPoints.length - 1] / 2)

    var compoundShape = Physics.body('compound', {
        x: 0,
        y: 0,
        treatment: 'static',
        styles: {
            fillStyle: styles.colours.ground,
            strokeStyle: styles.colours.ground,
            lineWidth: 3
        }
    })
    // Array.map() is a neato functional way of turning an array into another array
    // We're looping through our array and making a new array of vector objects
    var terrainVertices = xPoints.map(function (xPoint, i) {
        var globalCoords = {
            x: Math.round(xPoint * squashFactor),
            y: Math.round(canvas.height - yPoints[i])
        }
        return compoundShape.toBodyCoords(new Physics.vector(globalCoords))
    })
    // We'll stretch the shape out way beyond the edges of the screen to be safe
    var topRightCorner = compoundShape.toBodyCoords(new Physics.vector({
        x: canvas.width + 10000,
        y: terrainVertices[terrainVertices.length - 1].y
    }))
    var bottomRightCorner = compoundShape.toBodyCoords(new Physics.vector({
        x: canvas.width + 10000,
        y: canvas.height
    }))
    var bottomLeftCorner = compoundShape.toBodyCoords(new Physics.vector({
        x: -10000,
        y: canvas.height
    }))
    var topLeftCorner = compoundShape.toBodyCoords(new Physics.vector({
        x: -10000,
        y: terrainVertices[0].y
    }))
    terrainVertices.push(topRightCorner)
    terrainVertices.push(bottomRightCorner)
    terrainVertices.push(bottomLeftCorner)
    terrainVertices.push(topLeftCorner)
    // If you console.log(terrainVertices) here, you'll see that we have a list of coordinates describing our terrain
    // Now, because PhysicsJS doesn't support concave polygons, we have to turn this into a bunch of connected rectangles
    terrainVertices.forEach(function (vertex, i) {
        var nextVertex = terrainVertices[i+1]
        if (nextVertex == undefined) {
            nextVertex = terrainVertices[0]
        }
        // Bunch of maths I copied off stackoverflow to get the distance and angle (in radians) between this point and the next
        var distance = Math.sqrt(Math.pow((nextVertex.x - vertex.x), 2) + Math.pow((nextVertex.y - vertex.y), 2))
        var angle = Math.atan2(nextVertex.y - vertex.y, nextVertex.x - vertex.x)
        // We're making a rectangle as wide as 'distance', positioned and rotated to bridge the two points
        var rectangle = Physics.body('rectangle', {
            x: (vertex.x + nextVertex.x) / 2,
            y: (vertex.y + nextVertex.y) / 2,
            width: distance,
            height: 1,
            angle: angle
        })

        // var relativeCoords = compoundShape.toBodyCoords(new Physics.vector({ x: rectangle.state.pos.x, y: rectangle.state.pos.y }))
        compoundShape.addChild(rectangle)
    })
    compoundShape.state.pos.x = canvas.width * 2
    compoundShape.state.pos.y = canvas.height * 0.75
    return compoundShape
}
