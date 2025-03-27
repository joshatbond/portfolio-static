import { Cubemap } from './cubemap'
import { GL } from './gl'
import { Vector } from './gl/Vector'
import { Renderer } from './renderer'
import { getElementById } from './utils/dom'
import { Water } from './water'

const loadingEl = getElementById('loading')

window.onerror = handleError
const gl = GL()
const DegToRad = Math.PI / 180

let cubeMap: Cubemap
let renderer: Renderer
let water: Water

let angleX = -25
let angleY = -200.5

// sphere physics info
let useSpherePhysics = false
let center: Vector
let oldCenter: Vector
let velocity: Vector
let gravity: Vector
let radius: number
let paused = false

// movement
let prevHit
let planeNormal
let mode = -1
const MODE_MOVE_SPHERE = 1
const MODE_ADD_DROPS = 0
const MODE_ORBIT_CAMERA = 2
let oldX, oldY

main()

function main() {
  const helpEl = getElementById('help')
  const ratio = window.devicePixelRatio ?? 1

  loadingEl.innerHTML = ''
  loadingEl.appendChild(gl.canvas)
  gl.ctx.clearColor(0, 0, 0, 1)

  water = new Water(gl)
  if (!water.textureA.canDrawTo() || !water.textureB.canDrawTo()) {
    throw new Error(
      'Rendering to floating-point textures is required but not supported'
    )
  }

  renderer = new Renderer(gl)
  cubeMap = new Cubemap(gl.ctx, {
    xneg: getElementById<HTMLImageElement>('xneg'),
    xpos: getElementById<HTMLImageElement>('xpos'),
    yneg: getElementById<HTMLImageElement>('ypos'),
    ypos: getElementById<HTMLImageElement>('ypos'),
    zneg: getElementById<HTMLImageElement>('zneg'),
    zpos: getElementById<HTMLImageElement>('zpos'),
  })

  center = oldCenter = new Vector(-0.4, -0.75, 0.2)
  velocity = new Vector(0, 0, 0)
  gravity = new Vector(0, -4, 0)
  radius = 0.25

  for (let i = 0; i < 20; i++) {
    water.addDrop(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      0.03,
      i & 1 ? 0.01 : -0.01
    )
  }

  onresize()
  gl.onFrame('frame', dt => {
    update(dt / 1000)
    draw()
  })
  gl.onKeyEvent('onDown', key => {
    if (key === 'l') {
      renderer.lightDir = Vector.fromAngles(
        90 * angleY * DegToRad,
        90 * angleX * DegToRad
      )
      if (gl.isPaused()) renderer.updateCaustics(water)
    }
  })
  gl.animate()

  function onresize() {
    const width = innerWidth - (helpEl.clientWidth ?? 0) - 20
    const height = innerHeight
    gl.canvas.width = width * ratio
    gl.canvas.height = height * ratio
    gl.canvas.style.width = `${width}px`
    gl.canvas.style.height = `${height}px`
    gl.ctx.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    gl.matrixMode(gl.PROJECTION)
    gl.loadIdentity()
    gl.perspective(45, gl.canvas.width / gl.canvas.height, 0.1, 1000)
    gl.matrixMode(gl.MODEL_VIEW)

    draw()
  }
}

function draw() {
  gl.ctx.clear(gl.ctx.COLOR_BUFFER_BIT | gl.ctx.DEPTH_BUFFER_BIT)

  gl.loadIdentity()
  gl.translate(0, 0, -4)
  gl.rotate(-angleX, 1, 0, 0)
  gl.rotate(-angleY, 0, 1, 0)
  gl.translate(0, 0.5, 0)

  gl.ctx.enable(gl.ctx.DEPTH_TEST)

  renderer.sphereCenter = center
  renderer.sphereRadius = radius
  renderer.renderCube(water)
  renderer.renderWater(water, cubeMap)
  renderer.renderSphere(water)

  gl.ctx.disable(gl.ctx.DEPTH_TEST)
}
/**
 *
 * @param dt The amount of time that has passed since the last frame in seconds.
 */
function update(dt: number) {
  if (dt > 1) return

  if (mode === MODE_MOVE_SPHERE) {
    velocity = new Vector()
  } else if (useSpherePhysics) {
    // Fall down with viscosity underwater
    const percentUnderwater = Math.max(
      0,
      Math.min(1, (radius - center.y) / (2 * radius))
    )

    velocity = velocity.add(gravity.multiply(dt - 1.1 * dt * percentUnderwater))
    velocity = velocity.subtract(
      velocity.unit().multiply(percentUnderwater * dt * velocity.dot(velocity))
    )
    center = center.add(velocity.multiply(dt))

    // Bounce off the bottom
    if (center.y < radius - 1) {
      center.y = radius - 1
      velocity.y = Math.abs(velocity.y) * 0.7
    }
  }

  water.moveSphere(oldCenter, center, radius)
  oldCenter = center

  water.stepSimulation()
  water.stepSimulation()
  water.updateNormals()
  renderer.updateCaustics(water)
}

function handleError(error: string | Event) {
  if (error instanceof Event) {
    console.error(error)
    return
  }
  var html = text2html(error)
  if (html == 'WebGL not supported') {
    html =
      'Your browser does not support WebGL.<br>Please see\
    <a href="http://www.khronos.org/webgl/wiki/Getting_a_WebGL_Implementation">\
    Getting a WebGL Implementation</a>.'
  }
  loadingEl.innerHTML = html
  loadingEl.style.zIndex = '1'
}
function text2html(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}
