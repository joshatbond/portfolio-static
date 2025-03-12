import { Vector } from './Vector'

export const hasFloat32Array = typeof Float32Array != 'undefined'

/**
 * Represents a 4x4 matrix stored in row-major order that uses Float32Arrays
 * when available. Matrix operations can either be done using convenient methods
 * that return a new matrix for the result or optimized methods that store the result
 * in an existing matrix to avoid generating garbage.
 */
export class Matrix {
  public m: Float32Array | number[]

  /**
   * Constructs a new Matrix.
   *
   * This constructor takes 16 arguments in row-major order, which can be passed
   * individually, as a list, or even as four lists (one for each row). If the
   * arguments are omitted then the identity matrix is constructed instead.
   *
   * @param elements - The matrix elements.
   */
  constructor(...elements: (number | number[])[]) {
    let m = ([] as number[]).concat(...elements)
    if (m.length === 0) {
      m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    }
    this.m = hasFloat32Array ? new Float32Array(m) : m
  }

  // Instance Methods

  /**
   * Returns the matrix that when multiplied with this matrix results in the identity matrix.
   *
   * @returns The inverse matrix.
   */
  public inverse(): Matrix {
    return Matrix.inverse(this, new Matrix())
  }

  /**
   * Returns the concatenation of the transforms for this matrix and the given matrix.
   * This emulates the OpenGL function glMultMatrix().
   *
   * @param matrix - The matrix to multiply.
   * @returns The product matrix.
   */
  public multiply(matrix: Matrix): Matrix {
    return Matrix.multiply(this, matrix, new Matrix())
  }

  /**
   * Transforms the vector as a point with a w coordinate of 1.
   * This means translations will have an effect.
   *
   * @param v - The point to transform.
   * @returns The transformed point.
   */
  public transformPoint(v: Vector): Vector {
    const m = this.m
    return new Vector(
      m[0] * v.x + m[1] * v.y + m[2] * v.z + m[3],
      m[4] * v.x + m[5] * v.y + m[6] * v.z + m[7],
      m[8] * v.x + m[9] * v.y + m[10] * v.z + m[11]
    ).divide(m[12] * v.x + m[13] * v.y + m[14] * v.z + m[15])
  }

  /**
   * Transforms the vector as a vector with a w coordinate of 0.
   * This means translations will have no effect.
   *
   * @param v - The vector to transform.
   * @returns The transformed vector.
   */
  public transformVector(v: Vector): Vector {
    const m = this.m
    return new Vector(
      m[0] * v.x + m[1] * v.y + m[2] * v.z,
      m[4] * v.x + m[5] * v.y + m[6] * v.z,
      m[8] * v.x + m[9] * v.y + m[10] * v.z
    )
  }

  /**
   * Returns this matrix with its columns and rows exchanged.
   *
   * @returns The transposed matrix.
   */
  public transpose(): Matrix {
    return Matrix.transpose(this, new Matrix())
  }

  // Static Methods

  /**
   * Sets up a viewing frustrum that is shaped like a truncated
   * pyramid with the camera placed where the point of the would pyramid. This
   * emulates the openGL function `glFrustrum()`
   *
   * @param left The left-most X coordinate at the near clipping plane
   * @param right The right-most X coordinate at the near clipping plane
   * @param bottom  The bottom-most Y coordinate at the near clipping plane
   * @param top  The top-most Y coordinate at the near clipping plane
   * @param near The distance from the camera to the near clipping plane
   * @param far The distance from the camera to the far clipping plane
   * @param result A matrix to store the inverted matrix in. Defaults to creating a new matrix instance
   */
  public static frustrum(
    left: number,
    right: number,
    bottom: number,
    top: number,
    near: number,
    far: number,
    result = new Matrix()
  ) {
    const m = result.m

    m[0] = (2 * near) / (right - left)
    m[1] = 0
    m[2] = (right + left) / (right - left)
    m[3] = 0

    m[4] = 0
    m[5] = (2 * near) / (top - bottom)
    m[6] = (top + bottom) / (top - bottom)
    m[7] = 0

    m[8] = 0
    m[9] = 0
    m[10] = -(far + near) / (far - near)
    m[11] = (-2 * far * near) / (far - near)

    m[12] = 0
    m[13] = 0
    m[14] = -1
    m[15] = 0

    return result
  }

  /**
   * Returns an identity matrix.
   * This emulates the OpenGL function glLoadIdentity().
   *
   * @param result - Optional matrix to store the result.
   * @returns The identity matrix.
   */
  public static identity(result = new Matrix()) {
    const m = result.m

    m[0] = m[5] = m[10] = m[15] = 1
    m[1] =
      m[2] =
      m[3] =
      m[4] =
      m[6] =
      m[7] =
      m[8] =
      m[9] =
      m[11] =
      m[12] =
      m[13] =
      m[14] =
        0
    return result
  }

  /**
   * Returns the matrix that when multiplied with the given matrix results in the identity matrix.
   * You can optionally pass an existing matrix in result to avoid allocating a new matrix.
   * This implementation is from the Mesa OpenGL function __gluInvertMatrixd() found in project.c.
   *
   * @param matrix - The matrix to invert.
   * @param result - Optional matrix to store the result.
   * @returns The inverse matrix.
   */
  public static inverse(matrix: Matrix, result = new Matrix()) {
    const m = matrix.m,
      r = result.m

    r[0] =
      m[5] * m[10] * m[15] -
      m[5] * m[14] * m[11] -
      m[6] * m[9] * m[15] +
      m[6] * m[13] * m[11] +
      m[7] * m[9] * m[14] -
      m[7] * m[13] * m[10]
    r[1] =
      -m[1] * m[10] * m[15] +
      m[1] * m[14] * m[11] +
      m[2] * m[9] * m[15] -
      m[2] * m[13] * m[11] -
      m[3] * m[9] * m[14] +
      m[3] * m[13] * m[10]
    r[2] =
      m[1] * m[6] * m[15] -
      m[1] * m[14] * m[7] -
      m[2] * m[5] * m[15] +
      m[2] * m[13] * m[7] +
      m[3] * m[5] * m[14] -
      m[3] * m[13] * m[6]
    r[3] =
      -m[1] * m[6] * m[11] +
      m[1] * m[10] * m[7] +
      m[2] * m[5] * m[11] -
      m[2] * m[9] * m[7] -
      m[3] * m[5] * m[10] +
      m[3] * m[9] * m[6]

    r[4] =
      -m[4] * m[10] * m[15] +
      m[4] * m[14] * m[11] +
      m[6] * m[8] * m[15] -
      m[6] * m[12] * m[11] -
      m[7] * m[8] * m[14] +
      m[7] * m[12] * m[10]
    r[5] =
      m[0] * m[10] * m[15] -
      m[0] * m[14] * m[11] -
      m[2] * m[8] * m[15] +
      m[2] * m[12] * m[11] +
      m[3] * m[8] * m[14] -
      m[3] * m[12] * m[10]
    r[6] =
      -m[0] * m[6] * m[15] +
      m[0] * m[14] * m[7] +
      m[2] * m[4] * m[15] -
      m[2] * m[12] * m[7] -
      m[3] * m[4] * m[14] +
      m[3] * m[12] * m[6]
    r[7] =
      m[0] * m[6] * m[11] -
      m[0] * m[10] * m[7] -
      m[2] * m[4] * m[11] +
      m[2] * m[8] * m[7] +
      m[3] * m[4] * m[10] -
      m[3] * m[8] * m[6]

    r[8] =
      m[4] * m[9] * m[15] -
      m[4] * m[13] * m[11] -
      m[5] * m[8] * m[15] +
      m[5] * m[12] * m[11] +
      m[7] * m[8] * m[13] -
      m[7] * m[12] * m[9]
    r[9] =
      -m[0] * m[9] * m[15] +
      m[0] * m[13] * m[11] +
      m[1] * m[8] * m[15] -
      m[1] * m[12] * m[11] -
      m[3] * m[8] * m[13] +
      m[3] * m[12] * m[9]
    r[10] =
      m[0] * m[5] * m[15] -
      m[0] * m[13] * m[7] -
      m[1] * m[4] * m[15] +
      m[1] * m[12] * m[7] +
      m[3] * m[4] * m[13] -
      m[3] * m[12] * m[5]
    r[11] =
      -m[0] * m[5] * m[11] +
      m[0] * m[9] * m[7] +
      m[1] * m[4] * m[11] -
      m[1] * m[8] * m[7] -
      m[3] * m[4] * m[9] +
      m[3] * m[8] * m[5]

    r[12] =
      -m[4] * m[9] * m[14] +
      m[4] * m[13] * m[10] +
      m[5] * m[8] * m[14] -
      m[5] * m[12] * m[10] -
      m[6] * m[8] * m[13] +
      m[6] * m[12] * m[9]
    r[13] =
      m[0] * m[9] * m[14] -
      m[0] * m[13] * m[10] -
      m[1] * m[8] * m[14] +
      m[1] * m[12] * m[10] +
      m[2] * m[8] * m[13] -
      m[2] * m[12] * m[9]
    r[14] =
      -m[0] * m[5] * m[14] +
      m[0] * m[13] * m[6] +
      m[1] * m[4] * m[14] -
      m[1] * m[12] * m[6] -
      m[2] * m[4] * m[13] +
      m[2] * m[12] * m[5]
    r[15] =
      m[0] * m[5] * m[10] -
      m[0] * m[9] * m[6] -
      m[1] * m[4] * m[10] +
      m[1] * m[8] * m[6] +
      m[2] * m[4] * m[9] -
      m[2] * m[8] * m[5]

    const determinant = m[0] * r[0] + m[1] * r[4] + m[2] * r[8] + m[3] * r[12]
    for (let i = 0; i < r.length; i++) r[i] /= determinant

    return result
  }

  /**
   * @description Modify a matrix such that the camera moves to the eye point (ex, ey, ez)
   * looking towards the center point (cx, cy, cz) with an up direction of (ux, uy, uz). This emulates
   * the openGL function `gluLookAt()`
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
   * @param result - Optional matrix to store the result.
   * @returns The viewing matrix.
   */
  public static lookAt(
    ex: number,
    ey: number,
    ez: number,
    cx: number,
    cy: number,
    cz: number,
    ux: number,
    uy: number,
    uz: number,
    result = new Matrix()
  ) {
    const m = result.m
    const e = new Vector(ex, ey, ez)
    const c = new Vector(cx, cy, cz)
    const u = new Vector(ux, uy, uz)

    const f = e.subtract(c).unit()
    const s = u.cross(f).unit()
    const t = f.cross(s).unit()

    m[0] = s.x
    m[1] = s.y
    m[2] = s.z
    m[3] = -s.dot(e)

    m[4] = t.x
    m[5] = t.y
    m[6] = t.z
    m[7] = -t.dot(e)

    m[8] = f.x
    m[9] = f.y
    m[10] = f.z
    m[11] = -f.dot(e)

    m[12] = 0
    m[13] = 0
    m[14] = 0
    m[15] = 1

    return result
  }

  /**
   * Returns the concatenation of the transforms for the two given matrices.
   * This emulates the OpenGL function glMultMatrix().
   *
   * @param left - The left matrix.
   * @param right - The right matrix.
   * @param result - Optional matrix to store the result.
   * @returns The product matrix.
   */
  public static multiply(left: Matrix, right: Matrix, result = new Matrix()) {
    const a = left.m,
      b = right.m,
      r = result.m

    r[0] = a[0] * b[0] + a[1] * b[4] + a[2] * b[8] + a[3] * b[12]
    r[1] = a[0] * b[1] + a[1] * b[5] + a[2] * b[9] + a[3] * b[13]
    r[2] = a[0] * b[2] + a[1] * b[6] + a[2] * b[10] + a[3] * b[14]
    r[3] = a[0] * b[3] + a[1] * b[7] + a[2] * b[11] + a[3] * b[15]

    r[4] = a[4] * b[0] + a[5] * b[4] + a[6] * b[8] + a[7] * b[12]
    r[5] = a[4] * b[1] + a[5] * b[5] + a[6] * b[9] + a[7] * b[13]
    r[6] = a[4] * b[2] + a[5] * b[6] + a[6] * b[10] + a[7] * b[14]
    r[7] = a[4] * b[3] + a[5] * b[7] + a[6] * b[11] + a[7] * b[15]

    r[8] = a[8] * b[0] + a[9] * b[4] + a[10] * b[8] + a[11] * b[12]
    r[9] = a[8] * b[1] + a[9] * b[5] + a[10] * b[9] + a[11] * b[13]
    r[10] = a[8] * b[2] + a[9] * b[6] + a[10] * b[10] + a[11] * b[14]
    r[11] = a[8] * b[3] + a[9] * b[7] + a[10] * b[11] + a[11] * b[15]

    r[12] = a[12] * b[0] + a[13] * b[4] + a[14] * b[8] + a[15] * b[12]
    r[13] = a[12] * b[1] + a[13] * b[5] + a[14] * b[9] + a[15] * b[13]
    r[14] = a[12] * b[2] + a[13] * b[6] + a[14] * b[10] + a[15] * b[14]
    r[15] = a[12] * b[3] + a[13] * b[7] + a[14] * b[11] + a[15] * b[15]

    return result
  }

  /**
   * Creates an orthographic projection, in which objects are
   * the same size no matter how far away or near to the camera they are.
   * This emulates the openGL function `glOrtho()`.
   *
   * @param left The left-most X coordinate at the near clipping plane
   * @param right The right-most X coordinate at the near clipping plane
   * @param bottom  The bottom-most Y coordinate at the near clipping plane
   * @param top  The top-most Y coordinate at the near clipping plane
   * @param near The distance from the camera to the near clipping plane
   * @param far The distance from the camera to the far clipping plane
   * @returns The orthographic projection matrix.
   */
  public static ortho(
    left: number,
    right: number,
    bottom: number,
    top: number,
    near: number,
    far: number,
    result = new Matrix()
  ) {
    const m = result.m
    m[0] = 2 / (right - left)
    m[1] = 0
    m[2] = 0
    m[3] = -(right + left) / (right - left)

    m[4] = 0
    m[5] = 2 / (top - bottom)
    m[6] = 0
    m[7] = -(top + bottom) / (top - bottom)

    m[8] = 0
    m[9] = 0
    m[10] = -2 / (far - near)
    m[11] = -(far + near) / (far - near)

    m[12] = 0
    m[13] = 0
    m[14] = 0
    m[15] = 1

    return result
  }

  /**
   * Returns a perspective transform matrix, which makes far away objects appear
   * smaller than nearby objects. This emulates the OpenGL function
   * gluPerspective().
   *
   * @param fov The angle (in degrees) of the plane that intersects the near and far planes
   * @param aspect The aspect ratio of the near plane, as a floating point number. This should be the width divided by the height of the viewport.
   * @param near The distance from the camera to the near clipping plane
   * @param far The distance from the camera to the far clipping plane
   * @param result A matrix to store the transposed matrix in. Defaults to creating a new matrix.
   * @returns The perspective projection matrix.
   */
  public static perspective(
    fov: number,
    aspect: number,
    near: number,
    far: number,
    result = new Matrix()
  ) {
    if (fov < 1 || fov >= 180)
      throw new Error(`A field of view of ${fov} is out-of-bounds`)

    const y = Math.tan((fov * Math.PI) / 360) * near
    const x = y * aspect

    return this.frustrum(-x, x, -y, y, near, far, result)
  }

  /**
   * Rotates a matrix by `angle` degrees around the vector `(x, y, z)`. This emulates the openGL function `glRotate()`.
   * If either the angle OR the vector parameters aren't defined, this function will return an identity matrix.
   *
   * @param angle The angle to rotate the matrix by
   * @param x The x-coordinate of the vector
   * @param y The y-coordinate of the vector
   * @param z The z-coordinate of the vector
   * @param result A matrix to store the transposed matrix in. Defaults to creating a new matrix.
   */
  public static rotate(
    result = new Matrix(),
    ...args:
      | [angle: number]
      | [x: number, y: number, z: number]
      | [angle: number, x: number, y: number, z: number]
  ) {
    let [angle, x, y, z] = args
    if (!angle) return Matrix.identity(result)
    if (!x || !y || !z) return Matrix.identity(result)

    const m = result.m
    const distance = Math.sqrt(x! * x! + y! * y! + z! * z!)
    angle = (angle * Math.PI) / 180
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    const t = 1 - c
    x! /= distance
    y! /= distance
    z! /= distance

    m[0] = x * x * t + c
    m[1] = x * y * t - z * s
    m[2] = x * z * t + y * s
    m[3] = 0

    m[4] = y * x * t + z * s
    m[5] = y * y * t + c
    m[6] = y * z * t - x * s
    m[7] = 0

    m[8] = z * x * t - y * s
    m[9] = z * y * t + x * s
    m[10] = z * z * t + c
    m[11] = 0

    m[12] = 0
    m[13] = 0
    m[14] = 0
    m[15] = 1

    return result
  }

  /**
   * @description This emulates the openGL function `glScale()` by creating a scaling matrix.
   *
   * @param x The scaling factor along the x-axis
   * @param y The scaling factor along the y-axis
   * @param z The scaling factor along the z-axis
   * @param result A matrix to store the transposed matrix in. Defaults to creating a new matrix.
   * @returns The scaling matrix.
   */
  public static scale(x: number, y: number, z: number, result = new Matrix()) {
    const m = result.m

    m[0] = x
    m[1] = 0
    m[2] = 0
    m[3] = 0

    m[4] = 0
    m[5] = y
    m[6] = 0
    m[7] = 0

    m[8] = 0
    m[9] = 0
    m[10] = z
    m[11] = 0

    m[12] = 0
    m[13] = 0
    m[14] = 0
    m[15] = 1

    return result
  }

  /**
   * Emulates the OpenGL function glTranslate() by creating a translation matrix.
   *
   * @param x The scaling factor along the x-axis
   * @param y The scaling factor along the y-axis
   * @param z The scaling factor along the z-axis
   * @param result A matrix to store the transposed matrix in. Defaults to creating a new matrix.
   * @returns The translation matrix.
   */
  public static translate(
    x: number,
    y: number,
    z: number,
    result = new Matrix()
  ) {
    const m = result.m

    m[0] = 1
    m[1] = 0
    m[2] = 0
    m[3] = x

    m[4] = 0
    m[5] = 1
    m[6] = 0
    m[7] = y

    m[8] = 0
    m[9] = 0
    m[10] = 1
    m[11] = z

    m[12] = 0
    m[13] = 0
    m[14] = 0
    m[15] = 1

    return result
  }

  /**
   * Returns the matrix with its columns and rows exchanged.
   * You can optionally pass an existing matrix in result to avoid allocating a new matrix.
   *
   * @param matrix - The matrix to transpose.
   * @param result - Optional matrix to store the result.
   * @returns The transposed matrix.
   */
  public static transpose(matrix: Matrix, result = new Matrix()) {
    const m = matrix.m,
      r = result.m

    r[0] = m[0]
    r[1] = m[4]
    r[2] = m[8]
    r[3] = m[12]
    r[4] = m[1]
    r[5] = m[5]
    r[6] = m[9]
    r[7] = m[13]
    r[8] = m[2]
    r[9] = m[6]
    r[10] = m[10]
    r[11] = m[14]
    r[12] = m[3]
    r[13] = m[7]
    r[14] = m[11]
    r[15] = m[15]
    return result
  }
}
