import { controller } from '../controller'
import { to } from '../utils/apply'
import { pubSubBuilder } from '../utils/pubSub'
import { Matrix, hasFloat32Array } from './Matrix'
import { Mesh } from './Mesh'
import { Shader } from './Shader'
import { Vector } from './Vector'

/**
 * A value to `bitwise-or` with new enums to make them
 * distinguishable from standard WebGL enums
 */
const ENUM = 0x12340000

export function GL(options: WebGLContextAttributes = {}) {
  return (
    to(() => glCore(options))
      .apply(matrixStack)
      // UNCOMMENT to enter debug mode
      // .apply(({ ctx }) => immediateMode(ctx))
      .apply(gl => addEventListeners(gl.ctx))
      .apply(gl => animationStack(gl.onKeyEvent))
      .get()
  )
}
export type GL = ReturnType<typeof GL>

/**
 * Instantiates a canvas and web-gl 2 context
 *
 * @param options Additional options to pass to the web-gl context
 */
function glCore(options: WebGLContextAttributes) {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 600

  const context = canvas.getContext('webgl2', {
    ...options,
    alpha: 'alpha' in options ? options.alpha : false,
  })
  if (!context) throw new Error('WebGL context could not be created')

  const HALF_FLOAT_OES = 0x8d61

  return {
    canvas,
    ctx: context,
    HALF_FLOAT_OES,
  }
}

/**
 * Implement the OpenGL modelview and projection matrix stacks, along with some
 * other useful GLU matrix functions.
 */
function matrixStack() {
  const MODEL_VIEW = ENUM | 1
  const PROJECTION = ENUM | 2
  const tempMatrix = new Matrix()
  /**
   * A matrix to cache any results
   */
  const resultMatrix = new Matrix()
  const modelViewStack: Matrix[] = []
  const projectionStack: Matrix[] = []
  const modelViewMatrix = new Matrix()
  const projectionMatrix = new Matrix()

  let matrix = modelViewMatrix,
    stack = modelViewStack

  return {
    MODEL_VIEW,
    modelViewMatrix,
    PROJECTION,
    projectionMatrix,
    /**
     *
     * @param left The left-most X coordinate at the near clipping plane
     * @param right The right-most X coordinate at the near clipping plane
     * @param bottom  The bottom-most Y coordinate at the near clipping plane
     * @param top  The top-most Y coordinate at the near clipping plane
     * @param near The distance from the camera to the near clipping plane
     * @param far The distance from the camera to the far clipping plane
     */
    frustum(
      left: number,
      right: number,
      top: number,
      bottom: number,
      near: number,
      far: number
    ) {
      this.multMatrix(
        Matrix.frustum(left, right, top, bottom, near, far, tempMatrix)
      )
    },
    /**
     * Load an identity matrix into the active matrix
     */
    loadIdentity() {
      Matrix.identity(matrix)
    },
    /**
     * Load a matrix into the active matrix
     * @param m The matrix to load
     */
    loadMatrix(m: Matrix) {
      const from = m.m,
        to = matrix.m

      for (let i = 0; i < from.length; i++) from[i] = to[i]
    },
    /**
     *
     * @param ex - The eye position x coordinate.
     * @param ey - The eye position y coordinate.
     * @param ez - The eye position z coordinate.
     * @param cx - The center point x coordinate.
     * @param cy - The center point y coordinate.
     * @param cz - The center point z coordinate.
     * @param ux - The up vector x component.
     * @param uy - The up vector y component.
     * @param uz - The up vector z component.
     */
    lookAt(
      ...args: [
        ex: number,
        ey: number,
        ez: number,
        cx: number,
        cy: number,
        cz: number,
        ux: number,
        uy: number,
        uz: number,
      ]
    ) {
      this.multMatrix(Matrix.lookAt(...args, tempMatrix))
    },
    /**
     * Set the mode the matrixes should use
     *
     * @param mode either gl.MODEL_VIEW or gl.PROJECTION
     */
    matrixMode(mode: number) {
      if (mode === MODEL_VIEW) {
        console.log('model view')
        matrix = modelViewMatrix
        stack = modelViewStack
      } else if (mode === PROJECTION) {
        console.log('projection')
        matrix = projectionMatrix
        stack = projectionStack
      } else {
        throw new Error(`invalid matrix mode: ${mode}`)
      }
    },
    /**
     * Multiply the provided matrix by the active matrix
     *
     * @param m The matrix to multiply
     */
    multMatrix(m: Matrix) {
      this.loadMatrix(Matrix.multiply(matrix, m, resultMatrix))
    },
    /**
     * @param left The left-most X coordinate at the near clipping plane
     * @param right The right-most X coordinate at the near clipping plane
     * @param bottom  The bottom-most Y coordinate at the near clipping plane
     * @param top  The top-most Y coordinate at the near clipping plane
     * @param near The distance from the camera to the near clipping plane
     * @param far The distance from the camera to the far clipping plane
     */
    ortho(
      ...args: [
        left: number,
        right: number,
        top: number,
        bottom: number,
        near: number,
        far: number,
      ]
    ) {
      this.multMatrix(Matrix.ortho(...args, tempMatrix))
    },
    /**
     * Set a perspective on the active matrix
     *
     * @param fov The angle (in degrees) of the plane that intersects the near and far planes
     * @param aspect The aspect ratio of the near plane, as a floating point number. This should be the width divided by the height of the viewport.
     * @param near The distance from the camera to the near clipping plane
     * @param far The distance from the camera to the far clipping plane
     */
    perspective(
      ...args: [fov: number, aspect: number, near: number, far: number]
    ) {
      this.multMatrix(Matrix.perspective(...args, tempMatrix))
    },
    /**
     *
     * @param objX The x coordinate of the object
     * @param objY The y coordinate of the object
     * @param objZ The z coordinate of the object
     * @param viewport The viewport array, as gathered from `context.getParameter(context.VIEWPORT)`
     * @param modelView A model matrix, defaults to the current model matrix
     * @param projection A projection matrix, defaults to the current projection matrix
     * @returns A vector describing the location of the projected object
     */
    project(
      objX: number,
      objY: number,
      objZ: number,
      viewport: Int32Array,
      modelView = modelViewMatrix,
      projection = projectionMatrix
    ) {
      const point = projection.transformPoint(
        modelView.transformPoint(new Vector(objX, objY, objZ))
      )

      return new Vector(
        viewport[0] + viewport[2] * (point.x * 0.5 + 0.5),
        viewport[1] + viewport[3] * (point.y * 0.5 + 0.5),
        point.z * 0.5 + 0.5
      )
    },
    /**
     * Add a matrix to the stack
     */
    pushMatrix() {
      stack.push(matrix)
    },
    /**
     * Push a matrix on the stack into the active matrix
     */
    popMatrix() {
      const m = stack.pop()?.m
      if (!m) return
      matrix.m = hasFloat32Array ? new Float32Array(m) : m
    },
    /**
     * Must provide any combination of the the following:
     *  1. The angle to rotate the matrix by
     *  2. The vector (x, y, z) to rotate the coordinate by
     *  3. Both of the above
     *
     * @param angle The angle to rotate the matrix by
     * @param x The x-coordinate of the vector
     * @param y The y-coordinate of the vector
     * @param z The z-coordinate of the vector
     */
    rotate(
      ...args:
        | [a: number]
        | [x: number, y: number, z: number]
        | [a: number, x: number, y: number, z: number]
    ) {
      this.multMatrix(Matrix.rotate(tempMatrix, ...args))
    },
    /**
     *
     * @param x The scaling factor along the x-axis
     * @param y The scaling factor along the y-axis
     * @param z The scaling factor along the z-axis
     */
    scale(...args: [x: number, y: number, z: number]) {
      this.multMatrix(Matrix.scale(...args, tempMatrix))
    },
    /**
     *
     * @param x The scaling factor along the x-axis
     * @param y The scaling factor along the y-axis
     * @param z The scaling factor along the z-axis
     */
    translate(...args: [x: number, y: number, z: number]) {
      this.multMatrix(Matrix.translate(...args, tempMatrix))
    },
    /**
     * Convert window coordinates into object space coordinates. It does this by
     * first adjusting the window coordinates to a normalized device space. Then,
     * it applies the inverse transformation of the combined modelview and
     * projection matrices to retrieve the original object space coordinates.
     *
     * @param winX The x coordinate in window-space
     * @param winY The y coordinate in window-space
     * @param winZ The y coordinate in window-space
     * @param viewport The viewport array, as gathered from `context.getParameter(context.VIEWPORT)`
     * @param modelView A model matrix, defaults to the current model matrix
     * @param projection A projection matrix, defaults to the current projection matrix
     */
    unproject(
      winX: number,
      winY: number,
      winZ: number,
      viewport: Int32Array,
      modelView = modelViewMatrix,
      projection = projectionMatrix
    ) {
      const point = new Vector(
        ((winX - viewport[0]) / viewport[2]) * 2 - 1,
        ((winY - viewport[1]) / viewport[3]) * 2 - 1,
        winZ * 2 - 1
      )

      return Matrix.inverse(
        Matrix.multiply(projection, modelView, tempMatrix),
        resultMatrix
      ).transformPoint(point)
    },
  }
}

/**
 * Provide an implementation of OpenGL's deprecated immediate mode. This is
 * deprecated for a reason: constantly re-specifying the geometry is a BAD
 * idea for performance. You should use a `Mesh` instead (which specifies)
 * the geometry once and caches it on the graphics card.
 *
 * Still, nothing beats a quick `gl.begin(gl.POINTS); gl.vertex(1,2,3); gl.end();`
 * for debugging. This intentionally doesn't implement fixed-function lighting
 * because its only meant for quick debugging tasks.
 */
// function immediateMode(context: WebGL2RenderingContext) {
//   const immediateMode = {
//     mesh: new Mesh(context, { coords: true, colors: true, triangles: false }),
//     mode: -1,
//     coord: [0, 0, 0, 0],
//     color: [1, 1, 1, 1],
//     pointSize: 1,
//     shader: new Shader(
//       context,
//       '\
//       uniform float pointSize;\
//       varying vec4 color;\
//       varying vec4 coord;\
//       void main() {\
//         color = gl_Color;\
//         coord = gl_TexCoord;\
//         gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
//         gl_PointSize = pointSize;\
//       }\
//     ',
//       '\
//       uniform sampler2D texture;\
//       uniform float pointSize;\
//       uniform bool useTexture;\
//       varying vec4 color;\
//       varying vec4 coord;\
//       void main() {\
//         gl_FragColor = color;\
//         if (useTexture) gl_FragColor *= texture2D(texture, coord.xy);\
//       }\
//     '
//     ),
//   }
//   return {
//     pointSize() {},
//   }
// }

/**
 * Improved mouse events
 *
 * This adds event listeners on the `gl.canvas` element that call
 * `gl.onmousedown`, `gl.onmousemove()`, and `gl.onmouseup()` with
 * an augmented event object. The event object also has the properties `x`, `y`,
 * `deltaX`, `deltaY`, and `dragging`.
 */
function addEventListeners(context: WebGL2RenderingContext) {
  const mouseBroker = pubSubBuilder<
    'mouseUp' | 'mouseDown' | 'mouseMove',
    ReturnType<typeof augment>
  >()
  const keyBroker = controller(
    { onDown: [' ', 'L', 'G'] },
    { caseSensitive: false }
  )
  let oldX = 0,
    oldY = 0,
    buttons: Record<string, boolean | undefined> = {},
    hasOld = false

  /**
   * Augment the default MouseEvent to include writeable `x`, `y`, `deltaX`,
   * `deltaY`, and `dragging` properties.
   */
  function augment(original: MouseEvent) {
    const e = {} as MouseEvent & {
      original: MouseEvent
      x: number
      y: number
      deltaX: number
      deltaY: number
      dragging: boolean | undefined
    }
    for (const name in original) {
      //@ts-expect-error
      if (typeof original[name] === 'function') {
        //@ts-expect-error
        e[name] = (function (callback) {
          return function () {
            callback.apply(original, arguments)
          }
          //@ts-expect-error
        })(original[name])
      } else {
        //@ts-expect-error
        e[name] = original[name]
      }
    }
    e.original = original
    e.x = e.pageX
    e.y = e.pageY

    for (
      let obj: HTMLElement | null = context.canvas as HTMLElement;
      obj;
      obj = obj.offsetParent as HTMLElement | null
    ) {
      e.x -= obj.offsetLeft
      e.y -= obj.offsetTop
    }
    if (hasOld) {
      e.deltaX = e.x - oldX
      e.deltaY = e.y - oldY
    } else {
      e.deltaX = 0
      e.deltaY = 0
      hasOld = true
    }
    oldX = e.x
    oldY = e.y
    e.dragging = isDragging()
    e.preventDefault = function () {
      e.original.preventDefault()
    }
    e.stopPropagation = function () {
      e.original.stopPropagation()
    }

    return e
  }
  /**
   * Checks whether any mouse buttons are currently pressed
   */
  function isDragging() {
    for (const b in buttons) {
      if (b in buttons && buttons[b]) return true
    }
    return false
  }

  function mousedown(e: MouseEvent | Event) {
    if (!(e instanceof MouseEvent)) return

    if (!isDragging()) {
      document.addEventListener('mousemove', mousemove)
      document.addEventListener('mouseup', mouseup)
      context.canvas.removeEventListener('mousemove', mousemove)
      context.canvas.removeEventListener('mouseup', mouseup)
    }
    buttons[e.button] = true
    mouseBroker.publish('mouseDown', augment(e))
    e.preventDefault()
  }
  function mousemove(e: MouseEvent | Event) {
    if (!(e instanceof MouseEvent)) return

    mouseBroker.publish('mouseMove', augment(e))
    e.preventDefault()
  }
  function mouseup(e: MouseEvent | Event) {
    if (!(e instanceof MouseEvent)) return

    buttons[e.button] = false
    if (!isDragging()) {
      document.removeEventListener('mousemove', mousemove)
      document.removeEventListener('mouseup', mouseup)
      context.canvas.addEventListener('mousemove', mousemove)
      context.canvas.addEventListener('mouseup', mouseup)
    }

    mouseBroker.publish('mouseUp', augment(e))
    e.preventDefault()
  }
  function reset() {
    hasOld = false
  }
  function resetAll() {
    buttons = {}
    hasOld = false
  }

  context.canvas.addEventListener('mousedown', mousedown)
  context.canvas.addEventListener('mousemove', mousemove)
  context.canvas.addEventListener('mouseup', mouseup)
  context.canvas.addEventListener('mouseover', reset)
  context.canvas.addEventListener('mouseout', reset)
  document.addEventListener('contextmenu', resetAll)

  return {
    onMouseEvent: mouseBroker.subscribe,
    onKeyEvent: keyBroker.subscribe,
  }
}

function animationStack(subscribe: ReturnType<typeof controller>['subscribe']) {
  const updateBroker = pubSubBuilder<'frame', number>()
  let paused: boolean = false
  let prevTime: number | undefined = undefined
  subscribe(' ', () => {
    paused = !paused
  })

  return {
    /**
     * Call `gl.animate()` to provide an animation loop that will repeatedly
     * publish update events that can be listened to with the `gl.onUpdate`
     * method.
     */
    animate() {
      requestAnimationFrame(update)
      update(0)

      function update(currentTime: number) {
        if (!prevTime) prevTime = currentTime
        prevTime = currentTime

        if (!paused) updateBroker.publish('frame', currentTime - prevTime)
        requestAnimationFrame(update)
      }
    },
  }
}
