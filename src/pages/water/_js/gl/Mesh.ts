import { Buffer, type IndexBufferName, type VertexBufferName } from './Buffer'
import { Indexer } from './Indexer'
import { Matrix } from './Matrix'
import { Vector } from './Vector'

/**
 * Represents a buffer that can be uploaded to the GPU.
 */
const cubeData = [
  [0, 4, 2, 6, -1, 0, 0], // -x
  [1, 3, 5, 7, +1, 0, 0], // +x
  [0, 1, 4, 5, 0, -1, 0], // -y
  [2, 6, 3, 7, 0, +1, 0], // +y
  [0, 2, 1, 3, 0, 0, -1], // -z
  [4, 5, 6, 7, 0, 0, +1], // +z
]

/**
 * Represents a collection of vertex buffers and index buffers.
 *
 * Each vertex buffer maps to one attribute in GLSL and has a corresponding
 * property set on the Mesh instance. There is one vertex buffer by default:
 * `vertices`, `which maps to `gl_Vertex`. The `coords`, `normals`, and
 * `colors` vertex buffers map to `gl_TexCoord`, `gl_Normal`, and `gl_Color`
 * respectively, and can be enabled by setting the corresponding options to
 * true. There are two index buffers, `triangles` and `lines`, which are used
 * for rendering `gl.TRIANGLES` and `gl.LINES`, respectively. Only `triangles`
 * is enabled by default, although `computeWireframe()` will add a normal
 * buffer if it wasn't initially enabled.
 */
export class Mesh {
  ctx: WebGL2RenderingContext
  // vertexBuffers
  colors: number[] | null = null
  coords: number[][] | null = null
  normals: [x: number, y: number, z: number][] | null = null
  vertices: [x: number, y: number, z: number][] = []
  // indexBuffers
  triangles: [x: number, y: number, z: number][] = []
  lines: [x: number, y: number][] = []

  vertexBuffers: Record<string, Buffer & { spacing: number }>
  indexBuffers: Record<string, Buffer>

  constructor(ctx: WebGL2RenderingContext, options: MeshOptions = {}) {
    this.ctx = ctx
    this.vertexBuffers = {}
    this.indexBuffers = {}
    this.addVertexBuffer('vertices', 'gl_Vertex')
    if (options.coords) this.addVertexBuffer('coords', 'gl_TexCoord', 2)
    if (options.normals) this.addVertexBuffer('normals', 'gl_Normal', 3)
    if (options.colors) this.addVertexBuffer('colors', 'gl_Color')
    if (!('triangles' in options) || options.triangles) {
      this.addIndexBuffer('triangles')
    }
    if (options.lines) this.addIndexBuffer('lines')
  }

  /**
   * @description Add a new index buffer with a list as a property called
   * `name` on this object.
   * @param name The name of the data array on the mesh instance
   */
  public addIndexBuffer(name: IndexBufferName) {
    this.indexBuffers[name] = new Buffer(
      this.ctx.ELEMENT_ARRAY_BUFFER,
      Uint16Array,
      this.ctx
    )
    this[name] = []
  }
  /**
   * @description Add a new vertex buffer with a list as a property called
   * `name` on this object and map it to the attribute called `attribute` in
   * all shaders that draw this mesh.
   */
  public addVertexBuffer(
    name: VertexBufferName,
    attribute: string,
    spacing = 3
  ) {
    const buffer = (this.vertexBuffers[attribute] = new Buffer(
      this.ctx.ARRAY_BUFFER,
      Float32Array,
      this.ctx
    ))
    buffer.name = name
    buffer.spacing = spacing
    this[name] = []
  }
  /**
   * @description Upload all attached buffers to the GPU in preparation for
   * rendering. This doesn't need to be called every frame, only needs to be
   * done when the data changes.
   */
  public compile() {
    for (const attribute in this.vertexBuffers) {
      const buffer = this.vertexBuffers[attribute]
      buffer.data = this[buffer.name] as number[]
      buffer.compile()
    }
    for (const name in this.indexBuffers) {
      const buffer = this.indexBuffers[name]
      buffer.data = this[buffer.name] as number[]
      buffer.compile()
    }
  }
  /**
   * @description Computes a new normal for each vertex from the average normal
   * of the neighboring triangles. This means adjacent triangles must share
   * vertices for the resulting normals to be smooth.
   */
  public computeNormals() {
    if (!this.normals) {
      this.addVertexBuffer('normals', 'gl_Normal')
      this.normals = []
    }
    const normalVectors: Vector[] = []
    for (let i = 0; i < this.vertices.length; i++) {
      normalVectors[i] = new Vector()
    }
    for (let i = 0; i < this.triangles.length; i++) {
      const t = this.triangles[i]
      const a = Vector.fromArray(this.vertices[t[0]])
      const b = Vector.fromArray(this.vertices[t[1]])
      const c = Vector.fromArray(this.vertices[t[2]])
      const normal = b.subtract(a).cross(c.subtract(a)).unit()
      normalVectors[t[0]] = normalVectors[t[0]].add(normal)
      normalVectors[t[1]] = normalVectors[t[1]].add(normal)
      normalVectors[t[2]] = normalVectors[t[2]].add(normal)
    }
    for (let i = 0; i < this.vertices.length; i++) {
      this.normals[i] = normalVectors[i].unit().toArray() as NonNullable<
        Mesh['normals']
      >[number]
    }
    this.compile()
    return this
  }
  /**
   * @description Populate the `lines` index buffer from the `triangles` index
   * buffer.
   */
  public computeWireframe() {
    const indexer = new Indexer<(typeof this.lines)[number]>()
    if (!this.lines) {
      this.addIndexBuffer('lines')
      this.lines = []
    }

    for (let i = 0; i < this.triangles.length; i++) {
      const t = this.triangles[i]
      for (let j = 0; j < t.length; j++) {
        const a = t[j],
          b = t[(j + 1) % t.length]
        indexer.add([Math.min(a, b), Math.max(a, b)])
      }
    }

    this.lines = indexer.unique
    this.compile()
    return this
  }
  /**
   * @description Computes the axis-aligned bounding box, which is an object
   * whose `min` and `max` properties contain the minimum and maximum
   * coordinates of all vertices.
   */
  public getAABB() {
    const aabb = {
      min: new Vector(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE),
      max: new Vector(),
    }
    aabb.max = Vector.negative(aabb.min, aabb.max)
    for (let i = 0; i < this.vertices.length; i++) {
      const vector = Vector.fromArray(this.vertices[i])
      aabb.min = Vector.min(aabb.min, vector)
      aabb.max = Vector.max(aabb.max, vector)
    }
    return aabb
  }
  /**
   * @description Computes a sphere that contains all vertices (not necessarily
   * the smallest sphere).
   */
  public getBoundingSphere() {
    const aabb = this.getAABB()
    const sphere = { center: aabb.min.add(aabb.max).divide(2), radius: 0 }

    for (let i = 0; i < this.vertices.length; i++) {
      sphere.radius = Math.max(
        sphere.radius,
        Vector.fromArray(this.vertices[i]).subtract(sphere.center).length()
      )
    }

    return sphere
  }
  /**
   * @description Transform all vertices by `matrix` and all normals by the
   * inverse transpose of `matrix`.
   */
  public transform(matrix: Matrix) {
    this.vertices = this.vertices.map(v =>
      matrix.transformPoint(Vector.fromArray(v)).toArray()
    ) as Mesh['vertices']

    if (this.normals) {
      const invTrans = matrix.inverse().transpose()
      this.normals = this.normals.map(n =>
        invTrans.transformVector(Vector.fromArray(n)).unit().toArray()
      ) as Mesh['normals']
    }

    this.compile()
    return this
  }

  /**
   * Generates a square 2x2 mesh the xy plane centered at the origin.
   * Two triangles are generated by default.
   *
   * @param ctx The webGL context to perform work in
   * @param options Specifies options to customize the plane.
   *
   * @example
   * ```typescript
   * const mesh1 = Mesh.plane()
   * const mesh2 = Mesh.plane({ detail: 5 })
   * const mesh3 = Mesh.plane({ detailX: 20, detailY: 40 })
   * ```
   */
  static plane(
    ctx: WebGL2RenderingContext,
    options: PlaneOptions = {
      detail: 1,
    }
  ) {
    const mesh = new Mesh(ctx, options.mesh)
    const detailX = options.detailX ?? options.detail
    const detailY = options.detailY ?? options.detail

    for (let y = 0; y <= detailY; y++) {
      const t = y / detailY
      for (let x = 0; x <= detailX; x++) {
        const s = x / detailX
        mesh.vertices.push([2 * s - 1, 2 * t - 1, 0])

        if (mesh.coords) mesh.coords.push([s, t])
        if (mesh.normals) mesh.normals.push([0, 0, 1])
        if (x < detailX && y < detailY) {
          const i = x + y * (detailX + 1)
          mesh.triangles.push([i, i + 1, i + detailX + 1])
          mesh.triangles.push([i + detailX + 1, i + 1, i + detailX + 2])
        }
      }
    }

    mesh.compile()
    return mesh
  }
  /**
   * Generates a 2x2x2 box centered at the origin.
   *
   * @param ctx The WebGL context to perform work in.
   * @param options Specify options to customize the cube.
   */
  static cube(ctx: WebGL2RenderingContext, options?: MeshOptions) {
    const mesh = new Mesh(ctx, options)

    for (let i = 0; i < cubeData.length; i++) {
      const face = cubeData[i]
      const v = i * 4

      for (let j = 0; j < 4; j++) {
        mesh.vertices.push(
          pickOctant(face[j]).toArray() as Mesh['vertices'][number]
        )
        if (mesh.coords) mesh.coords.push([j & 1, (j & 2) / 2])
        if (mesh.normals)
          mesh.normals.push(
            face.slice(4, 7) as NonNullable<Mesh['normals']>[number]
          )
      }

      mesh.triangles.push([v, v + 1, v + 2])
      mesh.triangles.push([v + 2, v + 1, v + 3])
    }

    mesh.compile()
    return mesh
  }
  /**
   * Generates a geodesic sphere of radius 1.
   *
   * @param ctx The WebGL context to perform work in.
   * @param options Specify options to customize the sphere.
   *
   * @example
   * ```typescript
   * const mesh1 = Mesh.sphere()
   * const mesh2 = Mesh.sphere({ detail: 5 })
   * ```
   */
  static sphere(
    ctx: WebGL2RenderingContext,
    options: SphereOptions = { detail: 6 }
  ) {
    const mesh = new Mesh(ctx, options.mesh)
    const indexer = new Indexer<{
      vertex: Vector
      coords: number[] | undefined
    }>()

    for (let octant = 0; octant < 8; octant++) {
      const scale = pickOctant(octant)
      const flip = scale.x * scale.y * scale.z > 0
      const data = [] as number[]

      for (let i = 0; i < options.detail; i++) {
        // Generate a row of vertices on the surface of the sphere
        // using barycentric coordinates.
        for (let j = 0; i + j < options.detail; j++) {
          const a = i / options.detail
          const b = j / options.detail
          const c = (options.detail - i - j) / options.detail
          const vertex = {
            vertex: new Vector(fix(a), fix(b), fix(c)).unit().multiply(scale),
            coords: mesh.coords
              ? scale.y > 0
                ? [1 - a, c]
                : [c, 1 - a]
              : undefined,
          }

          data.push(indexer.add(vertex))
        }

        // Generate triangles from this row and the previous
        if (i > 0) {
          for (let j = 0; j < options.detail; j++) {
            const a =
              (i - 1) * (options.detail + 1) +
              (i - 1 - (i - 1) * (i - 1)) / 2 +
              j
            const b = i * (options.detail + 1) + (i - i * i) / 2 + j

            mesh.triangles.push(tri(data[a], data[a + 1], data[b], flip))

            if (i + j < options.detail) {
              mesh.triangles.push(tri(data[b], data[a + 1], data[b + 1], flip))
            }
          }
        }
      }

      // reconstruct the geometry from the indexer
      mesh.vertices = indexer.unique.map(
        v => v.vertex.toArray() as Mesh['vertices'][number]
      )
      if (mesh.coords) {
        mesh.coords = indexer.unique.map(
          v => v.coords as NonNullable<Mesh['coords']>[number]
        )
      }
      if (mesh.normals) {
        mesh.normals = mesh.vertices
      }
    }

    mesh.compile()
    return mesh

    function tri(
      a: number,
      b: number,
      c: number,
      flip: boolean
    ): [x: number, y: number, z: number] {
      return flip ? [a, c, b] : [a, b, c]
    }
    function fix(x: number) {
      return x + (x - x * x) / 2
    }
  }
}

/**
 * Computes the position of a vertex in a unit cube based on an index.
 *
 * The cube is centered at the origin with vertices at (-1, -1, -1) to (1, 1, 1).
 * The index `i` (0–7) determines which of the 8 corners of the cube is selected.
 *
 * @param i - An index from 0 to 7 representing one of the eight cube corners.
 * @returns A Vector representing the position of the corresponding vertex.
 */
function pickOctant(i: number) {
  return new Vector((i & 1) * 2 - 1, (i & 2) - 1, (i & 4) / 2 - 1)
}

type MeshOptions = Partial<{
  /**
   * Determines whether a coordinate vertex buffer will be created for the mesh.
   * By default, it does not.
   */
  coords: boolean
  /**
   * Determines whether a normals vertex buffer will be created for the mesh.
   * By default, it does not.
   */
  normals: boolean
  /**
   * Determines whether a colors vertex buffer will be created for the mesh.
   * By default, it does not.
   */
  colors: boolean
  /**
   * Determines whether the triangles index buffer will be created for the mesh.
   * By default, it does.
   */
  triangles: boolean
  /**
   * Determines whether the lines index buffer will be created for the mesh.
   * By default, it does not.
   */
  lines: boolean
}>
type PlaneOptions = {
  /**
   * Specify the level of detail (number of vertices) for both the `x` and `y`.
   * Defaults to `1`.
   */
  detail: number
  /** Options to pass to the Mesh constructor */
  mesh?: MeshOptions
  /** Specify the level of detail (number of vertices) in the x direction.
   */
  detailX?: number
  /** Specify the level of detail (number of vertices) in the y direction.
   */
  detailY?: number
}
type SphereOptions = {
  /**
   * Specify the level of detail (number of vertices) for both the `x` and `y`.
   * Defaults to `1`.
   */
  detail: number
  /** Options to pass to the Mesh constructor */
  mesh?: MeshOptions
  /** Specify the level of detail (number of vertices) in the x direction.
   */
}
