import type { GL } from '.'

/**
 * Represents a cubemap texture
 */
export class Cubemap {
  /** The WebGL texture id for this cubemap */
  private id: WebGLTexture

  /**
   * Creates a new cubemap texture from the provided images
   *
   * @param gl - The WebGL rendering context
   * @param images - Object containing the six faces of the cubemap
   */
  constructor(
    gl: WebGL2RenderingContext,
    images: {
      xneg: HTMLImageElement
      xpos: HTMLImageElement
      yneg: HTMLImageElement
      ypos: HTMLImageElement
      zneg: HTMLImageElement
      zpos: HTMLImageElement
    }
  ) {
    this.id = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.id)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)

    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    gl.texImage2D(
      gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      images.xneg
    )
    gl.texImage2D(
      gl.TEXTURE_CUBE_MAP_POSITIVE_X,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      images.xpos
    )
    gl.texImage2D(
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      images.yneg
    )
    gl.texImage2D(
      gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      images.ypos
    )
    gl.texImage2D(
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      images.zneg
    )
    gl.texImage2D(
      gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      images.zpos
    )
  }

  /**
   * Binds this cubemap to the specified texture unit
   *
   * @param gl - The WebGL rendering context
   * @param unit - The texture unit to bind to (defaults to 0)
   */
  bind(gl: WebGLRenderingContext, unit: number = 0): void {
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.id)
  }

  /**
   * Unbinds this cubemap from the specified texture unit
   *
   * @param gl - The WebGL rendering context
   * @param unit - The texture unit to unbind from (defaults to 0)
   */
  unbind(gl: WebGLRenderingContext, unit: number = 0): void {
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null)
  }

  /**
   * Deletes the WebGL texture associated with this cubemap
   *
   * @param gl - The WebGL rendering context
   */
  delete(gl: WebGLRenderingContext): void {
    gl.deleteTexture(this.id)
  }
}
