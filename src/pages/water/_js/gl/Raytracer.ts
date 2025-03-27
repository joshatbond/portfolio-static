import type { GL } from '.'
import { HitTest } from './HitTest'
import { Vector } from './Vector'

export class Raytracer {
  eye: Vector
  ray00: Vector
  ray10: Vector
  ray01: Vector
  ray11: Vector
  viewport: number[]

  /**
   * Creates a new Raytracer instance.
   * Reads the current modelview matrix, projection matrix, and viewport,
   * reconstructing the eye position to generate per-pixel rays.
   */
  constructor(gl: GL) {
    const v = gl.ctx.getParameter(gl.ctx.VIEWPORT)
    const m = gl.modelViewMatrix.m

    const axisX = new Vector(m[0], m[4], m[8])
    const axisY = new Vector(m[1], m[5], m[9])
    const axisZ = new Vector(m[2], m[6], m[10])
    const offset = new Vector(m[3], m[7], m[11])

    this.eye = new Vector(
      -offset.dot(axisX),
      -offset.dot(axisY),
      -offset.dot(axisZ)
    )

    const minX = v[0]
    const maxX = minX + v[2]
    const minY = v[1]
    const maxY = minY + v[3]
    const viewport = gl.ctx.getParameter(gl.ctx.VIEWPORT)

    this.ray00 = gl.unProject(minX, minY, 1, viewport).subtract(this.eye)
    this.ray10 = gl.unProject(maxX, minY, 1, viewport).subtract(this.eye)
    this.ray01 = gl.unProject(minX, maxY, 1, viewport).subtract(this.eye)
    this.ray11 = gl.unProject(maxX, maxY, 1, viewport).subtract(this.eye)
    this.viewport = v
  }

  /**
   * Returns the ray originating from the camera and traveling through the given pixel coordinates.
   * @param x - The x-coordinate of the pixel.
   * @param y - The y-coordinate of the pixel.
   * @returns A unit vector representing the ray direction.
   */
  public getRayForPixel(x: number, y: number): Vector {
    x = (x - this.viewport[0]) / this.viewport[2]
    y = 1 - (y - this.viewport[1]) / this.viewport[3]
    const ray0 = Vector.lerp(this.ray00, this.ray10, x)
    const ray1 = Vector.lerp(this.ray01, this.ray11, x)
    return Vector.lerp(ray0, ray1, y).unit()
  }

  /**
   * Performs a hit test against an axis-aligned bounding box.
   * @param origin - The ray's origin.
   * @param ray - The ray direction.
   * @param min - The minimum bounds of the box.
   * @param max - The maximum bounds of the box.
   * @returns A HitTest instance if there is an intersection, otherwise null.
   */
  static hitTestBox(origin: Vector, ray: Vector, min: Vector, max: Vector) {
    const tMin = min.subtract(origin).divide(ray)
    const tMax = max.subtract(origin).divide(ray)
    const t1 = Vector.min(tMin, tMax)
    const t2 = Vector.max(tMin, tMax)
    const tNear = t1.max()
    const tFar = t2.min()

    if (tNear > 0 && tNear < tFar) {
      const epsilon = 1.0e-6
      const hit = origin.add(ray.multiply(tNear))
      min = min.add(epsilon)
      max = max.subtract(epsilon)
      return new HitTest(
        tNear,
        hit,
        new Vector(
          +(hit.x > max.x) - +(hit.x < min.x),
          +(hit.y > max.y) - +(hit.y < min.y),
          +(hit.z > max.z) - +(hit.z < min.z)
        )
      )
    }

    return null
  }
  /**
   * Performs a hit test against a sphere.
   * @param origin - The ray's origin.
   * @param ray - The ray direction.
   * @param center - The center of the sphere.
   * @param radius - The radius of the sphere.
   * @returns A HitTest instance if there is an intersection, otherwise null.
   */
  static hitTestSphere(
    origin: Vector,
    ray: Vector,
    center: Vector,
    radius: number
  ): HitTest | null {
    const offset = origin.subtract(center)
    const a = ray.dot(ray)
    const b = 2 * ray.dot(offset)
    const c = offset.dot(offset) - radius * radius
    const discriminant = b * b - 4 * a * c

    if (discriminant > 0) {
      const t = (-b - Math.sqrt(discriminant)) / (2 * a)
      const hit = origin.add(ray.multiply(t))
      return new HitTest(t, hit, hit.subtract(center).divide(radius))
    }

    return null
  }

  /**
   * Performs a hit test against a triangle.
   * @param origin - The ray's origin.
   * @param ray - The ray direction.
   * @param a - First vertex of the triangle.
   * @param b - Second vertex of the triangle.
   * @param c - Third vertex of the triangle.
   * @returns A HitTest instance if there is an intersection, otherwise null.
   */
  static hitTestTriangle(
    origin: Vector,
    ray: Vector,
    a: Vector,
    b: Vector,
    c: Vector
  ) {
    const ab = b.subtract(a)
    const ac = c.subtract(a)
    const normal = ab.cross(ac).unit()
    const t = normal.dot(a.subtract(origin)) / normal.dot(ray)

    if (t <= 0) return null

    const hit = origin.add(ray.multiply(t))
    const toHit = hit.subtract(a)
    const dot00 = ac.dot(ac)
    const dot01 = ac.dot(ab)
    const dot02 = ac.dot(toHit)
    const dot11 = ab.dot(ab)
    const dot12 = ab.dot(toHit)
    const divisor = dot00 * dot11 - dot01 * dot01
    const u = (dot11 * dot02 - dot01 * dot12) / divisor
    const v = (dot00 * dot12 - dot01 * dot02) / divisor
    return u >= 0 && v >= 0 && u + v <= 1 ? new HitTest(t, hit, normal) : null
  }
}
