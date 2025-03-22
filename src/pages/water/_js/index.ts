import { Cubemap } from './cubemap'
import { GL } from './gl'
import { getElementById } from './utils/dom'

const loadingEl = getElementById('loading')
const imageXNeg = getElementById<HTMLImageElement>('xneg')
const imageXPos = getElementById<HTMLImageElement>('xpos')
const imageYNeg = getElementById<HTMLImageElement>('yneg')
const imageYPos = getElementById<HTMLImageElement>('ypos')
const imageZNeg = getElementById<HTMLImageElement>('zneg')
const imageZPos = getElementById<HTMLImageElement>('zpos')

window.onerror = handleError
const gl = GL()
let cubeMap: Cubemap

function main() {
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
