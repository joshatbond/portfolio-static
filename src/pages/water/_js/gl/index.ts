import { to } from '../utils/apply'
import { Matrix, hasFloat32Array } from './Matrix'
import { Vector } from './Vector'

/**
 * A value to `bitwise-or` with new enums to make them
 * distinguishable from standard WebGL enums
 */
const ENUM = 0x12340000

export function GL(options: WebGLContextAttributes = {}) {
  return to(() => glCore(options))
    .apply(matrixStack)
    .get()
}
export type GL = ReturnType<typeof GL>

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
    PROJECTION,

    /**
     *
     * @param left The left-most X coordinate at the near clipping plane
     * @param right The right-most X coordinate at the near clipping plane
     * @param bottom  The bottom-most Y coordinate at the near clipping plane
     * @param top  The top-most Y coordinate at the near clipping plane
     * @param near The distance from the camera to the near clipping plane
     * @param far The distance from the camera to the far clipping plane
     */
    frustrum(
      left: number,
      right: number,
      top: number,
      bottom: number,
      near: number,
      far: number
    ) {
      this.multMatrix(
        Matrix.frustrum(left, right, top, bottom, near, far, tempMatrix)
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
      if (mode !== MODEL_VIEW || mode !== PROJECTION) {
        throw new Error(`invalid matrix mode: ${mode}`)
      } else if (mode === MODEL_VIEW) {
        matrix = modelViewMatrix
        stack = modelViewStack
      } else {
        matrix = projectionMatrix
        stack = projectionStack
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
