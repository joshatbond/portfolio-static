import { Cubemap } from './cubemap'
import { GL } from './gl'

const loadingEl = document.getElementById('loading')
const imageXNeg = document.getElementById('xneg') as HTMLImageElement | null
const imageXPos = document.getElementById('xpos') as HTMLImageElement | null
const imageYNeg = document.getElementById('yneg') as HTMLImageElement | null
const imageYPos = document.getElementById('ypos') as HTMLImageElement | null
const imageZNeg = document.getElementById('zneg') as HTMLImageElement | null
const imageZPos = document.getElementById('zpos') as HTMLImageElement | null

window.onerror = handleError
const gl = GL()
let cubeMap: Cubemap

function main() {
  if (
    !imageXNeg ||
    !imageXPos ||
    !imageYNeg ||
    !imageYPos ||
    !imageZNeg ||
    !imageZPos
  ) {
    throw new Error('Missing cubemap images')
  }
  const ratio = window.devicePixelRatio ?? 1
  const helpEL = document.getElementById('help')

  function onresize() {
    const width = innerWidth - (helpEL?.clientWidth ?? 0) - 20
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
  document.body.appendChild(gl.canvas)
  gl.ctx.clearColor(0, 0, 0, 1)
  cubeMap = new Cubemap(gl.ctx, {
    xneg: imageXNeg,
    xpos: imageXPos,
    yneg: imageYNeg,
    ypos: imageYPos,
    zneg: imageZNeg,
    zpos: imageZPos,
  })
}

function draw() {}

function handleError(error: string | Event) {
  if (error instanceof Event) {
    console.error(error)
    return
  }
  if (!loadingEl) return
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
