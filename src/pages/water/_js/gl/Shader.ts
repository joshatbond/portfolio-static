import type { GL } from '.'
import { Matrix } from './Matrix'
import type { Mesh } from './Mesh'
import { Vector } from './Vector'

const headerRoot = `
  uniform mat3 gl_NormalMatrix;
  uniform mat4 gl_ModelViewMatrix;
  uniform mat4 gl_ProjectionMatrix;
  uniform mat4 gl_ModelViewProjectionMatrix;
  uniform mat4 gl_ModelViewMatrixInverse;
  uniform mat4 gl_ProjectionMatrixInverse;
  uniform mat4 gl_ModelViewProjectionMatrixInverse;
`
const vertexHeader = `
  ${headerRoot}
  attribute vec4 gl_Vertex;
  attribute vec4 gl_TexCoord;
  attribute vec3 gl_Normal;
  attribute vec4 gl_Color;
  vec4 ftransform() {
    return gl_ModelViewProjectionMatrix * gl_Vertex;
  }
`
const fragmentHeader = `
  precision highp float;
  ${headerRoot}
`
/**
 * @description Non-standard names beginning with `gl_` must be mangled because
 * they will otherwise cause a compiler error.
 */
var LIGHTGL_PREFIX = 'LIGHTGL'

/**
 * Compiles a shader program using the provided vertex and
 * fragment shaders.
 */
export class Shader {
  vertexSource: string | null = null
  fragmentSource: string | null = null
  usedMatrices: Record<string, string> = {}
  program: WebGLProgram
  attributes: Record<string, GLuint> = {}
  uniformLocations: Record<string, WebGLUniformLocation> = {}
  /**
   * @description Sampler uniforms need to be uploaded using `gl.uniform1i()`
   * instead of `gl.uniform1f()`. To do this automatically, we detect and
   * remember all uniform samplers in the source code.
   */
  isSampler: Record<string, number> = {}

  private gl: GL

  /**
   * Constructs a new Shader
   *
   * @param gl A webGL 2 rendering context
   * @param vertexSource EITHER a GLSL shader or the id of a script tag containing the GLSL shader
   * @param fragmentSource EITHER a GLSL shader or the id of a script tag containing the GLSL shader
   */
  constructor(gl: GL, vertexSource: string, fragmentSource: string) {
    this.gl = gl
    this.vertexSource = this.followScriptTagById(vertexSource)
    this.fragmentSource = this.followScriptTagById(fragmentSource)

    // Check for the use of built-in matrices that require expensive matrix
    // multiplications to compute, and record these in `usedMatrices`
    const source = vertexSource + fragmentSource
    this.regexMap(/\b(gl_[^;]*)\b;/g, headerRoot, (groups: RegExpExecArray) => {
      const name = groups[1]
      if (source.indexOf(name) != -1) {
        const capitalLetters = name.replace(/[a-z_]/g, '')
        this.usedMatrices[capitalLetters] = `${LIGHTGL_PREFIX}${name}`
      }
    })

    if (source.indexOf('transform') !== -1)
      this.usedMatrices.MVPM = `${LIGHTGL_PREFIX}gl_ModelViewProjectionMatrix`

    vertexSource = this.fix(vertexHeader, vertexSource)
    fragmentSource = this.fix(fragmentHeader, fragmentSource)

    const program = this.gl.ctx.createProgram()
    if (!program) throw new Error('unable to create program')

    this.program = program

    this.gl.ctx.attachShader(
      this.program,
      this.compileSource(this.gl.ctx.VERTEX_SHADER, vertexSource)
    )
    this.gl.ctx.attachShader(
      this.program,
      this.compileSource(this.gl.ctx.FRAGMENT_SHADER, fragmentSource)
    )
    this.gl.ctx.linkProgram(this.program)

    this.regexMap(
      /uniform\s+sampler(1D|2D|3D|Cube)\s+(\w+)\s*;/g,
      vertexSource + fragmentSource,
      (groups: RegExpExecArray) => {
        this.isSampler[groups[2]] = 1
      }
    )
  }

  /**
   * Compile and link errors are thrown as strings
   */
  public compileSource(type: GLenum, source: string) {
    const shader = this.gl.ctx.createShader(type)
    if (!shader) throw new Error('unable to create shader')

    this.gl.ctx.shaderSource(shader, source)
    this.gl.ctx.compileShader(shader)

    if (!this.gl.ctx.getShaderParameter(shader, this.gl.ctx.COMPILE_STATUS)) {
      throw new Error('compile error: ' + this.gl.ctx.getShaderInfoLog(shader))
    }

    return shader
  }
  /**
   * Sets all uniform matrix attributes, binds all relevant buffers, and draws
   * the mesh geometry as indexed triangles or indexed lines. Set `mode` to
   * `gl.LINES`  (and either add indices to `lines` or call
   * `computeWireframe()`) to draw the mesh in wireframe.
   *
   * @param mesh The mesh to draw
   * @param mode The mode to draw the mesh in
   */
  public draw(mesh: Mesh, mode?: number) {
    this.drawBuffers(
      mesh.vertexBuffers,
      mesh.indexBuffers[mode === this.gl.ctx.LINES ? 'lines' : 'triangles'],
      mode ? mode : this.gl.ctx.TRIANGLES
    )
  }
  /**
   * Sets all uniform matrix attributes, binds all relevant buffers, and draws the
   * indexed mesh geometry. This method automatically creates and caches
   * vertex attribute pointers for attributes as needed.
   *
   * @param vertexBuffers a map from attribute names to `Buffer` objects of type `gl.ARRAY_BUFFER`
   * @param indexBuffer a `Buffer` object of type `gl.ELEMENT_ARRAY_BUFFER`
   * @param mode a WebGL primitive mode like `gl.TRIANGLES` or `gl.LINES`
   */
  public drawBuffers(
    vertexBuffers: Mesh['vertexBuffers'],
    indexBuffer: Mesh['indexBuffers'][number],
    modes: number
  ) {
    // only construct the built-in matrices that are needed
    const MVPMI = this.usedMatrices.MVPMI
      ? this.usedMatrices.MVPM || this.usedMatrices.MVPMI
        ? this.gl.projectionMatrix.multiply(this.gl.modelViewMatrix).inverse()
        : null
      : undefined

    this.uniforms({
      MVM: this.usedMatrices.MVM ? this.gl.modelViewMatrix : undefined,
      MVMI: this.usedMatrices.MVMI
        ? this.usedMatrices.MVMI || this.usedMatrices.NM
          ? this.gl.modelViewMatrix.inverse()
          : null
        : undefined,
      PM: this.usedMatrices.PM ? this.gl.projectionMatrix : undefined,
      PMI: this.usedMatrices.PMI
        ? this.gl.projectionMatrix.inverse()
        : undefined,
      MVPM: this.usedMatrices.MVPM
        ? this.usedMatrices.MVPM || this.usedMatrices.MVPMI
          ? this.gl.projectionMatrix.multiply(this.gl.modelViewMatrix)
          : null
        : undefined,
      MVPMI,
      NM:
        this.usedMatrices.NM && MVPMI
          ? [
              MVPMI.m[0],
              MVPMI.m[4],
              MVPMI.m[8],
              MVPMI.m[1],
              MVPMI.m[5],
              MVPMI.m[9],
              MVPMI.m[2],
              MVPMI.m[6],
              MVPMI.m[10],
            ]
          : undefined,
    })

    let length = 0
    for (const attribute in vertexBuffers) {
      const buffer = vertexBuffers[attribute]
      const location =
        this.attributes[attribute] ||
        this.gl.ctx.getAttribLocation(
          this.program,
          attribute.replace(/^(gl_.*)$/, LIGHTGL_PREFIX + '$1')
        )
      if (location === -1 || !buffer.buffer) continue

      this.attributes[attribute] = location
      this.gl.ctx.bindBuffer(this.gl.ctx.ARRAY_BUFFER, buffer.buffer)
      this.gl.ctx.enableVertexAttribArray(location)
      this.gl.ctx.vertexAttribPointer(
        location,
        buffer.spacing,
        this.gl.ctx.FLOAT,
        false,
        0,
        0
      )
      length = buffer.length / buffer.spacing
    }

    // disablue unused attribute pointers
    for (const attribute in this.attributes) {
      if (!(attribute in vertexBuffers)) {
        this.gl.ctx.disableVertexAttribArray(this.attributes[attribute])
      }
    }

    // draw the geometry
    if (length && (!indexBuffer || indexBuffer.buffer)) {
      if (indexBuffer) {
        this.gl.ctx.bindBuffer(
          this.gl.ctx.ELEMENT_ARRAY_BUFFER,
          indexBuffer.buffer
        )
        this.gl.ctx.drawElements(
          modes,
          indexBuffer.length,
          this.gl.ctx.UNSIGNED_SHORT,
          0
        )
      } else {
        this.gl.ctx.drawArrays(modes, 0, length)
      }
    }
  }
  /**
   * The `gl_` prefix must be substituted for something else to
   * avoid compile errors, since it's a reserved prefix. This prefixes all
   * reserved names with `_`. The header is inserted after any extensions, since
   * those must come first.
   */
  fix(header: string, source: string) {
    const replaced: Record<string, boolean> = {}
    const match = /^((\s*\/\/.*\n|\s*#extension.*\n)+)[^]*$/.exec(source)
    source = match
      ? match[1] + header + source.substr(match[1].length)
      : header + source
    this.regexMap(/\bgl_\w+\b/g, header, (results: RegExpExecArray) => {
      results.forEach(result => {
        if (result in replaced) return

        source = source.replace(
          new RegExp('\\b' + result + '\\b', 'g'),
          LIGHTGL_PREFIX + result
        )
        replaced[result] = true
      })
    })

    return source
  }
  /**
   * Allow passing in the id of an HTML script tag with the source
   * @param id The dom elementId of the script to follow
   */
  followScriptTagById(id: string) {
    const element = document.getElementById(id)
    return element ? element.textContent : id
  }
  /**
   * Iterate through the results of a regex match
   *
   * @param regex The regex to search with
   * @param text The text to search on
   * @param callback A function to handle the processed results
   */
  regexMap(
    regex: RegExp,
    text: string,
    callback: (r: RegExpExecArray) => void
  ) {
    let result: RegExpExecArray | null
    while ((result = regex.exec(text)) != null) {
      callback(result)
    }
  }
  /**
   * @description Set a uniform for each property of `uniforms`. The correct
   * `gl.uniform*()` method is inferred from the value types and from the stored
   * uniform sampler flags.
   */
  uniforms(uniforms: Record<string, unknown>) {
    this.gl.ctx.useProgram(this.program)

    for (const name in uniforms) {
      if (!(name in this.uniformLocations)) {
        const location = this.gl.ctx.getUniformLocation(this.program, name)
        if (!location) continue
        this.uniformLocations[name] = location
      }

      let value = uniforms[name]
      if (value instanceof Vector) {
        value = [value.x, value.y, value.z]
      } else if (value instanceof Matrix) {
        value = value.m
      }

      if (Array.isArray(value)) {
        switch (value.length) {
          case 1:
            this.gl.ctx.uniform1fv(
              this.uniformLocations[name],
              new Float32Array(value)
            )
            break
          case 2:
            this.gl.ctx.uniform2fv(
              this.uniformLocations[name],
              new Float32Array(value)
            )
            break
          case 3:
            this.gl.ctx.uniform3fv(
              this.uniformLocations[name],
              new Float32Array(value)
            )
            break
          case 4:
            this.gl.ctx.uniform4fv(
              this.uniformLocations[name],
              new Float32Array(value)
            )
            break
          // Matrices are automatically transposed, since WebGL uses column-major
          // indices instead of row-major indices.
          case 9:
            this.gl.ctx.uniformMatrix3fv(
              this.uniformLocations[name],
              false,
              new Float32Array([
                value[0],
                value[3],
                value[6],
                value[1],
                value[4],
                value[7],
                value[2],
                value[5],
                value[8],
              ])
            )
            break
          case 16:
            this.gl.ctx.uniformMatrix4fv(
              this.uniformLocations[name],
              false,
              new Float32Array([
                value[0],
                value[4],
                value[8],
                value[12],
                value[1],
                value[5],
                value[9],
                value[13],
                value[2],
                value[6],
                value[10],
                value[14],
                value[3],
                value[7],
                value[11],
                value[15],
              ])
            )
            break
          default:
            throw new Error(
              `don't know how to load uniform ${name} of length ${value.length}`
            )
        }
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        ;(this.isSampler[name]
          ? this.gl.ctx.uniform1i
          : this.gl.ctx.uniform1f
        ).call(this.gl.ctx, this.uniformLocations[name], Number(value))
      } else {
        throw new Error(
          `attempted to set uniform ${name} to invalid value ${value}`
        )
      }
    }

    return this
  }
}
