import type { Vector } from './Vector'

/**
 * This is the object used to return hit test results.
 */
export class HitTest {
  t: number
  hit: Vector | undefined
  normal: Vector | undefined

  /**
   * If there are no arguments, the constructed argument represents a hit
   * infinitely far away.
   */
  constructor(t?: number, hit?: Vector, normal?: Vector) {
    this.t = t ?? Number.MAX_VALUE
    this.hit = hit
    this.normal = normal
  }

  public mergeWith(other: HitTest) {
    if (other.t > 0 && other.t < this.t) {
      this.t = other.t
      this.hit = other.hit
      this.normal = other.normal
    }
  }
}
