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
export class Buffer {
  buffer: WebGLBuffer | null
  target: BufferTarget
  type: BufferType
  data: number[]
  ctx: WebGL2RenderingContext
  name: VertexBufferName | IndexBufferName = 'vertices'
  spacing: number
  length: number

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
    this.spacing = 3
    this.length = 0
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
  public compile(
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
    this.length = data.length
  }
}

type BufferTarget =
  | WebGLRenderingContextBase['ARRAY_BUFFER']
  | WebGLRenderingContextBase['ELEMENT_ARRAY_BUFFER']
type BufferType = Float32ArrayConstructor | Uint16ArrayConstructor
export type VertexBufferName = 'vertices' | 'coords' | 'normals' | 'colors'
export type IndexBufferName = 'triangles' | 'lines'
