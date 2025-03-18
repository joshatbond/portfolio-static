import { Matrix } from './Matrix'
import { Vector } from './Vector'

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

  vertexBuffers: Record<string, Buffer>
  indexBuffers: Record<string, Buffer>

  constructor(
    ctx: WebGL2RenderingContext,
    options: Partial<{
      coords: boolean
      normals: boolean
      colors: boolean
      triangles: boolean
      lines: boolean
    }> = {}
  ) {
    this.ctx = ctx
    this.vertexBuffers = {}
    this.indexBuffers = {}
    this.addVertexBuffer('vertices', 'gl_Vertex')
    if (options.coords) this.addVertexBuffer('coords', 'gl_TexCoord')
    if (options.normals) this.addVertexBuffer('normals', 'gl_Normal')
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
  addIndexBuffer(name: IndexBufferName) {
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
  addVertexBuffer(name: VertexBufferName, attribute: string) {
    const buffer = (this.vertexBuffers[attribute] = new Buffer(
      this.ctx.ARRAY_BUFFER,
      Float32Array,
      this.ctx
    ))
    buffer.name = name
    this[name] = []
  }
  /**
   * @description Upload all attached buffers to the GPU in preparation for
   * rendering. This doesn't need to be called every frame, only needs to be
   * done when the data changes.
   */
  compile() {
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
  computeNormals() {
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
  computeWireframe() {
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
  getAABB() {
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
  getBoundingSphere() {
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
  transform(matrix: Matrix) {
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

  static plane(options: Mesh) {}
}

/**
 * @description Generates indices into a list of unique objects from a stream
 * of objects that may contain duplicates. This is useful for generating
 * compact indexed meshes from unindexed data.
 */
export class Indexer<T> {
  unique: T[]
  map: Record<string, number>

  constructor() {
    this.unique = []
    this.map = {}
  }

  add(el: T) {
    const key = JSON.stringify(el)
    if (!(key in this.map)) {
      this.map[key] = this.unique.length
      this.unique.push(el)
    }

    return this.map[key]
  }
}

/**
 * @description Provides a simple method of uploading data to a GPU buffer.
 * @example
 *
 * ```ts
 * const vertices = new GL.Buffer(gl.ARRAY_BUFFER, Float32Array);
 * const indices = new GL.Buffer(gl.ELEMENT_ARRAY_BUFFER, Uint16Array);
 * vertices.data = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]];
 * indices.data = [[0, 1, 2], [2, 1, 3]];
 * vertices.compile();
 * indices.compile();
 * ```
 */
class Buffer {
  buffer: WebGLBuffer | null
  target: BufferTarget
  type: BufferType
  data: number[]
  ctx: WebGL2RenderingContext
  name: VertexBufferName | IndexBufferName = 'vertices'

  constructor(
    target: BufferTarget,
    type: BufferType,
    ctx: WebGL2RenderingContext
  ) {
    this.buffer = null
    this.target = target
    this.type = type
    this.data = []
    this.ctx = ctx
  }

  /**
   * @description Upload the contents of `data` to the GPU in preparation for
   * rendering. The data must be a list of lists where each inner list has the
   * same length. For example, each element of data for vertex normals would be
   * a list of length three. This will remember the data length and element
   * length for later use by shaders. The type can be either `gl.STATIC_DRAW`
   * or `gl.DYNAMIC_DRAW`, and defaults to `gl.STATIC_DRAW`.
   *
   * This could have used `[].concat.apply([], this.data)` to flatten the array
   * but Google Chrome has a maximum number of arguments so the concatenations
   * are chunked to avoid that limit.
   */
  compile(
    type:
      | WebGLRenderingContextBase['STATIC_DRAW']
      | WebGLRenderingContextBase['DYNAMIC_DRAW'] = 35048
  ) {
    let data: number[] = []
    for (let i = 0, chunk = 1e4; i < this.data.length; i += chunk) {
      data = Array.prototype.concat.apply(data, this.data.slice(i, i + chunk))
    }
    const spacing = this.data.length ? data.length / this.data.length : 0
    if (spacing !== Math.round(spacing)) {
      throw new Error(
        `buffer elements not of consistent size, average size is ${spacing}`
      )
    }

    this.buffer = this.buffer || this.ctx.createBuffer()
    if (!this.buffer) throw new Error('unable to create buffer')

    this.ctx.bindBuffer(this.target, this.buffer)
    this.ctx.bufferData(this.target, new this.type(data), type)
  }
}

type BufferTarget =
  | WebGLRenderingContextBase['ARRAY_BUFFER']
  | WebGLRenderingContextBase['ELEMENT_ARRAY_BUFFER']
type BufferType = Float32ArrayConstructor | Uint16ArrayConstructor
type VertexBufferName = 'vertices' | 'coords' | 'normals' | 'colors'
type IndexBufferName = 'triangles' | 'lines'
