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
 * @description Compiles a shader program using the provided vertex and
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

  private gl: WebGL2RenderingContext

  /**
   * Constructs a new Shader
   *
   * @param gl A webGL 2 rendering context
   * @param vertexSource EITHER a GLSL shader or the id of a script tag containing the GLSL shader
   * @param fragmentSource EITHER a GLSL shader or the id of a script tag containing the GLSL shader
   */
  constructor(
    gl: WebGL2RenderingContext,
    vertexSource: string,
    fragmentSource: string
  ) {
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

    const program = this.gl.createProgram()
    if (!program) throw new Error('unable to create program')

    this.program = program

    this.gl.attachShader(
      this.program,
      this.compileSource(this.gl.VERTEX_SHADER, vertexSource)
    )
    this.gl.attachShader(
      this.program,
      this.compileSource(this.gl.FRAGMENT_SHADER, fragmentSource)
    )
    this.gl.linkProgram(this.program)

    this.regexMap(
      /uniform\s+sampler(1D|2D|3D|Cube)\s+(\w+)\s*;/g,
      vertexSource + fragmentSource,
      (groups: RegExpExecArray) => {
        this.isSampler[groups[2]] = 1
      }
    )
  }

  /**
   * @description Compile and link errors are thrown as strings
   */
  compileSource(type: GLenum, source: string) {
    const shader = this.gl.createShader(type)
    if (!shader) throw new Error('unable to create shader')

    this.gl.shaderSource(shader, source)
    this.gl.compileShader(shader)

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error('compile error: ' + this.gl.getShaderInfoLog(shader))
    }

    return shader
  }
  /** */
  draw(mesh: Mesh, mode: number) {}
  /** */
  drawBuffers() {}
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
    this.gl.useProgram(this.program)

    for (const name in uniforms) {
      if (!(name in this.uniformLocations)) {
        const location = this.gl.getUniformLocation(this.program, name)
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
            this.gl.uniform1fv(
              this.uniformLocations[name],
              new Float32Array(value)
            )
            break
          case 2:
            this.gl.uniform2fv(
              this.uniformLocations[name],
              new Float32Array(value)
            )
            break
          case 3:
            this.gl.uniform3fv(
              this.uniformLocations[name],
              new Float32Array(value)
            )
            break
          case 4:
            this.gl.uniform4fv(
              this.uniformLocations[name],
              new Float32Array(value)
            )
            break
          // Matrices are automatically transposed, since WebGL uses column-major
          // indices instead of row-major indices.
          case 9:
            this.gl.uniformMatrix3fv(
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
            this.gl.uniformMatrix4fv(
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
        ;(this.isSampler[name] ? this.gl.uniform1i : this.gl.uniform1f).call(
          this.gl,
          this.uniformLocations[name],
          Number(value)
        )
      } else {
        throw new Error(
          `attempted to set uniform ${name} to invalid value ${value}`
        )
      }
    }

    return this
  }
}
