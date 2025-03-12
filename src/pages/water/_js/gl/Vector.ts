/**
 * Represents a 3D vector and provides methods for common vector operations.
 */
export class Vector {
  public x: number
  public y: number
  public z: number

  /**
   * Creates an instance of Vector.
   * @param {number} [x=0] - The x component.
   * @param {number} [y=0] - The y component.
   * @param {number} [z=0] - The z component.
   */
  constructor(x?: number, y?: number, z?: number) {
    this.x = x || 0
    this.y = y || 0
    this.z = z || 0
  }

  // Instance Methods

  /**
   * Returns a new vector with all components negated.
   * @returns {Vector} A new vector that is the negation of this vector.
   */
  public negative(): Vector {
    return new Vector(-this.x, -this.y, -this.z)
  }

  /**
   * Adds a vector or scalar to this vector and returns a new vector.
   * @param {Vector | number} v - The vector or scalar to add.
   * @returns {Vector} The resulting vector.
   */
  public add(v: Vector | number): Vector {
    return v instanceof Vector
      ? new Vector(this.x + v.x, this.y + v.y, this.z + v.z)
      : new Vector(this.x + v, this.y + v, this.z + v)
  }

  /**
   * Subtracts a vector or scalar from this vector and returns a new vector.
   * @param {Vector | number} v - The vector or scalar to subtract.
   * @returns {Vector} The resulting vector.
   */
  public subtract(v: Vector | number): Vector {
    return v instanceof Vector
      ? new Vector(this.x - v.x, this.y - v.y, this.z - v.z)
      : new Vector(this.x - v, this.y - v, this.z - v)
  }

  /**
   * Multiplies this vector by a vector or scalar and returns a new vector.
   * @param {Vector | number} v - The vector or scalar to multiply.
   * @returns {Vector} The resulting vector.
   */
  public multiply(v: Vector | number): Vector {
    return v instanceof Vector
      ? new Vector(this.x * v.x, this.y * v.y, this.z * v.z)
      : new Vector(this.x * v, this.y * v, this.z * v)
  }

  /**
   * Divides this vector by a vector or scalar and returns a new vector.
   * @param {Vector | number} v - The vector or scalar to divide by.
   * @returns {Vector} The resulting vector.
   */
  public divide(v: Vector | number): Vector {
    return v instanceof Vector
      ? new Vector(this.x / v.x, this.y / v.y, this.z / v.z)
      : new Vector(this.x / v, this.y / v, this.z / v)
  }

  /**
   * Checks if this vector equals another vector.
   * @param {Vector} v - The vector to compare with.
   * @returns {boolean} True if the vectors are equal, otherwise false.
   */
  public equals(v: Vector): boolean {
    return this.x === v.x && this.y === v.y && this.z === v.z
  }

  /**
   * Computes the dot product of this vector with another vector.
   * @param {Vector} v - The other vector.
   * @returns {number} The dot product.
   */
  public dot(v: Vector): number {
    return this.x * v.x + this.y * v.y + this.z * v.z
  }

  /**
   * Computes the cross product of this vector with another vector.
   * @param {Vector} v - The other vector.
   * @returns {Vector} A new vector representing the cross product.
   */
  public cross(v: Vector): Vector {
    return new Vector(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    )
  }

  /**
   * Calculates the length (magnitude) of the vector.
   * @returns {number} The length of the vector.
   */
  public length(): number {
    return Math.sqrt(this.dot(this))
  }

  /**
   * Returns the unit (normalized) vector.
   * @returns {Vector} The unit vector.
   */
  public unit(): Vector {
    return this.divide(this.length())
  }

  /**
   * Returns the smallest component of this vector.
   * @returns {number} The minimum value among x, y, and z.
   */
  public min(): number {
    return Math.min(this.x, this.y, this.z)
  }

  /**
   * Returns the largest component of this vector.
   * @returns {number} The maximum value among x, y, and z.
   */
  public max(): number {
    return Math.max(this.x, this.y, this.z)
  }

  /**
   * Converts the vector to spherical angles.
   * @returns {{theta: number, phi: number}} An object with theta and phi angles.
   */
  public toAngles(): { theta: number; phi: number } {
    return {
      theta: Math.atan2(this.z, this.x),
      phi: Math.asin(this.y / this.length()),
    }
  }

  /**
   * Computes the angle between this vector and another vector.
   * @param {Vector} a - The other vector.
   * @returns {number} The angle in radians.
   */
  public angleTo(a: Vector): number {
    return Math.acos(this.dot(a) / (this.length() * a.length()))
  }

  /**
   * Converts the vector to an array of numbers.
   * @param {number} [n=3] - The number of components to include.
   * @returns {number[]} An array representation of the vector.
   */
  public toArray(n: number = 3): number[] {
    return [this.x, this.y, this.z].slice(0, n)
  }

  /**
   * Creates a clone of this vector.
   * @returns {Vector} A new vector with the same components.
   */
  public clone(): Vector {
    return new Vector(this.x, this.y, this.z)
  }

  /**
   * Initializes or resets the components of the vector.
   * @param {number} x - The new x component.
   * @param {number} y - The new y component.
   * @param {number} z - The new z component.
   * @returns {this} The current vector instance.
   */
  public init(x: number, y: number, z: number): this {
    this.x = x
    this.y = y
    this.z = z
    return this
  }

  // Static Methods

  /**
   * Sets vector b to be the negative of vector a.
   * @param {Vector} a - The source vector.
   * @param {Vector} b - The target vector.
   * @returns {Vector} The modified target vector.
   */
  public static negative(a: Vector, b: Vector): Vector {
    b.x = -a.x
    b.y = -a.y
    b.z = -a.z
    return b
  }

  /**
   * Adds vector a and vector (or scalar) b and stores the result in vector c.
   * @param {Vector} a - The first vector.
   * @param {Vector | number} b - The second vector or a scalar.
   * @param {Vector} c - The vector in which to store the result.
   * @returns {Vector} The result vector.
   */
  public static add(a: Vector, b: Vector | number, c: Vector): Vector {
    if (b instanceof Vector) {
      c.x = a.x + b.x
      c.y = a.y + b.y
      c.z = a.z + b.z
    } else {
      c.x = a.x + b
      c.y = a.y + b
      c.z = a.z + b
    }
    return c
  }

  /**
   * Subtracts vector (or scalar) b from vector a and stores the result in vector c.
   * @param {Vector} a - The first vector.
   * @param {Vector | number} b - The vector or scalar to subtract.
   * @param {Vector} c - The vector in which to store the result.
   * @returns {Vector} The result vector.
   */
  public static subtract(a: Vector, b: Vector | number, c: Vector): Vector {
    if (b instanceof Vector) {
      c.x = a.x - b.x
      c.y = a.y - b.y
      c.z = a.z - b.z
    } else {
      c.x = a.x - b
      c.y = a.y - b
      c.z = a.z - b
    }
    return c
  }

  /**
   * Multiplies vector a by vector (or scalar) b and stores the result in vector c.
   * @param {Vector} a - The first vector.
   * @param {Vector | number} b - The vector or scalar to multiply.
   * @param {Vector} c - The vector in which to store the result.
   * @returns {Vector} The result vector.
   */
  public static multiply(a: Vector, b: Vector | number, c: Vector): Vector {
    if (b instanceof Vector) {
      c.x = a.x * b.x
      c.y = a.y * b.y
      c.z = a.z * b.z
    } else {
      c.x = a.x * b
      c.y = a.y * b
      c.z = a.z * b
    }
    return c
  }

  /**
   * Divides vector a by vector (or scalar) b and stores the result in vector c.
   * @param {Vector} a - The dividend vector.
   * @param {Vector | number} b - The divisor vector or scalar.
   * @param {Vector} c - The vector in which to store the result.
   * @returns {Vector} The result vector.
   */
  public static divide(a: Vector, b: Vector | number, c: Vector): Vector {
    if (b instanceof Vector) {
      c.x = a.x / b.x
      c.y = a.y / b.y
      c.z = a.z / b.z
    } else {
      c.x = a.x / b
      c.y = a.y / b
      c.z = a.z / b
    }
    return c
  }

  /**
   * Computes the cross product of vectors a and b and stores the result in vector c.
   * @param {Vector} a - The first vector.
   * @param {Vector} b - The second vector.
   * @param {Vector} c - The vector in which to store the result.
   * @returns {Vector} The cross product vector.
   */
  public static cross(a: Vector, b: Vector, c: Vector): Vector {
    c.x = a.y * b.z - a.z * b.y
    c.y = a.z * b.x - a.x * b.z
    c.z = a.x * b.y - a.y * b.x
    return c
  }

  /**
   * Computes the unit (normalized) vector of a and stores the result in vector b.
   * @param {Vector} a - The source vector.
   * @param {Vector} b - The vector in which to store the result.
   * @returns {Vector} The unit vector.
   */
  public static unit(a: Vector, b: Vector): Vector {
    const length = a.length()
    b.x = a.x / length
    b.y = a.y / length
    b.z = a.z / length
    return b
  }

  /**
   * Creates a new vector from spherical angles.
   * @param {number} theta - The angle in the x-z plane.
   * @param {number} phi - The angle from the y-axis.
   * @returns {Vector} The resulting vector.
   */
  public static fromAngles(theta: number, phi: number): Vector {
    return new Vector(
      Math.cos(theta) * Math.cos(phi),
      Math.sin(phi),
      Math.sin(theta) * Math.cos(phi)
    )
  }

  /**
   * Generates a random unit vector with a statistically uniform direction.
   * @returns {Vector} A random unit vector.
   */
  public static randomDirection(): Vector {
    return Vector.fromAngles(
      Math.random() * Math.PI * 2,
      Math.asin(Math.random() * 2 - 1)
    )
  }

  /**
   * Returns a new vector that contains the minimum components of two vectors.
   * @param {Vector} a - The first vector.
   * @param {Vector} b - The second vector.
   * @returns {Vector} A new vector with the component-wise minimum.
   */
  public static min(a: Vector, b: Vector): Vector {
    return new Vector(
      Math.min(a.x, b.x),
      Math.min(a.y, b.y),
      Math.min(a.z, b.z)
    )
  }

  /**
   * Returns a new vector that contains the maximum components of two vectors.
   * @param {Vector} a - The first vector.
   * @param {Vector} b - The second vector.
   * @returns {Vector} A new vector with the component-wise maximum.
   */
  public static max(a: Vector, b: Vector): Vector {
    return new Vector(
      Math.max(a.x, b.x),
      Math.max(a.y, b.y),
      Math.max(a.z, b.z)
    )
  }

  /**
   * Linearly interpolates between vectors a and b by a given fraction.
   * @param {Vector} a - The start vector.
   * @param {Vector} b - The end vector.
   * @param {number} fraction - The interpolation fraction (between 0 and 1).
   * @returns {Vector} The interpolated vector.
   */
  public static lerp(a: Vector, b: Vector, fraction: number): Vector {
    return b.subtract(a).multiply(fraction).add(a)
  }

  /**
   * Creates a new vector from an array of numbers.
   * @param {number[]} a - The array containing vector components.
   * @returns {Vector} The resulting vector.
   */
  public static fromArray(a: number[]): Vector {
    return new Vector(a[0], a[1], a[2])
  }

  /**
   * Calculates the angle between two vectors.
   * @param {Vector} a - The first vector.
   * @param {Vector} b - The second vector.
   * @returns {number} The angle in radians between the two vectors.
   */
  public static angleBetween(a: Vector, b: Vector): number {
    return a.angleTo(b)
  }
}
