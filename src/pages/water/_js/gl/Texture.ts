/**
 * Provides a simple wrapper around WebGL textures that supports
 * render-to-texture.
 */
export class Texture {
  ctx: WebGL2RenderingContext
  id: WebGLTexture
  width: number
  height: number
  type: number
  format: number
  framebuffer: WebGLFramebuffer | undefined
  renderBuffer: WebGLRenderbuffer | undefined

  /**
   *
   * @param ctx A webgl context
   * @param width The size of the texture in texels
   * @param height The size of the texture in texels
   * @param options (Optional) Texture parameters
   *
   * @example
   * ```ts
   * const texture = new Texture(gl.ctx, 256, 256, {
   *   // Defaults to gl.LINEAR, set both at once with "filter"
   *   magFilter: ctx.NEAREST,
   *   minFilter: ctx.NEAREST,
   *
   *   // Defaults to ctx.CLAMP_TO_EDGE, set both at once with "wrap"
   *   wrapS: gl.REPEAT,
   *   wrapT: gl.REPEAT,
   *
   *   // Defaults to ctx.RGBA
   *   format: ctx.RGBA,
   *
   *   // Default to ctx.UNSIGNED_BYTE
   *   type: ctx.FLOAT
   * })
   * ```
   */
  constructor(
    ctx: WebGL2RenderingContext,
    width: number,
    height: number,
    options: TextureOptions = {}
  ) {
    this.ctx = ctx
    this.id = ctx.createTexture()
    this.width = width
    this.height = height
    this.type = options.type ?? ctx.UNSIGNED_BYTE
    this.format = options.format ?? ctx.RGBA8

    const magFilter = options.filter ?? options.magFilter ?? ctx.LINEAR
    const minFilter = options.filter ?? options.minFilter ?? ctx.LINEAR

    if (this.type === ctx.FLOAT) {
      if (!Texture.canUseFloatingPointTextures(ctx)) {
        throw new Error('This browser does not support floating point textures')
      }
      if (
        (minFilter !== ctx.NEAREST || magFilter !== ctx.NEAREST) &&
        !Texture.canUseFloatingPointLinearFiltering(ctx)
      ) {
        throw new Error(
          'This browser does not support floating point linear filtering'
        )
      }
    } else if (this.type === ctx.HALF_FLOAT) {
      if (!Texture.canUseHalfFloatingPointTextures(ctx)) {
        throw new Error(
          'This browser does not support half floating point textures'
        )
      }
      if (
        (minFilter !== ctx.NEAREST || magFilter !== ctx.NEAREST) &&
        !Texture.canUseHalfFloatingPointLinearFiltering(ctx)
      ) {
        throw new Error(
          'This browser does not support half floating point linear filtering'
        )
      }
    }

    ctx.bindTexture(ctx.TEXTURE_2D, this.id)
    ctx.pixelStorei(ctx.UNPACK_FLIP_Y_WEBGL, 1)
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, magFilter)
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, minFilter)
    ctx.texParameteri(
      ctx.TEXTURE_2D,
      ctx.TEXTURE_WRAP_S,
      options.wrap ?? options.wrapS ?? ctx.CLAMP_TO_EDGE
    )
    ctx.texParameteri(
      ctx.TEXTURE_2D,
      ctx.TEXTURE_WRAP_T,
      options.wrap ?? options.wrapT ?? ctx.CLAMP_TO_EDGE
    )
    ctx.texImage2D(
      ctx.TEXTURE_2D,
      0,
      this.format,
      width,
      height,
      0,
      this.format,
      this.type,
      null
    )
  }

  /**
   * Bind this texture to the given texture unit (0-7, defaults to 0)
   */
  public bind(unit = 0) {
    this.ctx.activeTexture(this.ctx.TEXTURE0 + unit)
    this.ctx.bindTexture(this.ctx.TEXTURE_2D, this.id)
  }
  /**
   * Check if rendering to this texture is supported. It may not be supported
   * for floating-point textures on some configurations
   */
  public canDrawTo() {
    if (!this.framebuffer) {
      this.framebuffer = this.ctx.createFramebuffer()
    }
    if (!this.framebuffer) {
      throw new Error('Failed to create framebuffer')
    }

    this.ctx.bindFramebuffer(this.ctx.FRAMEBUFFER, this.framebuffer)
    this.ctx.framebufferTexture2D(
      this.ctx.FRAMEBUFFER,
      this.ctx.COLOR_ATTACHMENT0,
      this.ctx.TEXTURE_2D,
      this.id,
      0
    )
    const result =
      this.ctx.checkFramebufferStatus(this.ctx.FRAMEBUFFER) ===
      this.ctx.FRAMEBUFFER_COMPLETE
    this.ctx.bindFramebuffer(this.ctx.FRAMEBUFFER, null)

    return result
  }
  /**
   * Render all draw calls in `callback` to this texture. This method sets up a
   * framebuffer with this texture as the color attachment and a renderbuffer
   * as the depth attachment. It also temporarily changes the viewport to the
   * size of the texture.
   *
   * @example
   * ```ts
   * texture.drawTo(() => {
   *   ctx.clearColor(1,0,0,1)
   *   ctx.clear(ctx.COLOR_BUFFER_BIT)
   * })
   */
  public drawTo(fn: () => void) {
    // Store the current viewport
    const viewport = this.ctx.getParameter(this.ctx.VIEWPORT)

    // Create framebuffer and renderbuffer if they don't exist
    if (!this.framebuffer) {
      this.framebuffer = this.ctx.createFramebuffer()
    }
    if (!this.renderBuffer) {
      this.renderBuffer = this.ctx.createRenderbuffer()
    }
    if (!this.framebuffer || !this.renderBuffer) {
      throw new Error('Failed to create framebuffer or renderbuffer')
    }

    // Bind framebuffer and renderbuffer
    this.ctx.bindFramebuffer(this.ctx.FRAMEBUFFER, this.framebuffer)
    this.ctx.bindRenderbuffer(this.ctx.RENDERBUFFER, this.renderBuffer)

    // Get current renderbuffer dimensions
    const rbWidth = this.ctx.getRenderbufferParameter(
      this.ctx.RENDERBUFFER,
      this.ctx.RENDERBUFFER_WIDTH
    )
    const rbHeight = this.ctx.getRenderbufferParameter(
      this.ctx.RENDERBUFFER,
      this.ctx.RENDERBUFFER_HEIGHT
    )

    // Resize renderbuffer if needed
    if (this.width !== rbWidth || this.height !== rbHeight) {
      this.ctx.renderbufferStorage(
        this.ctx.RENDERBUFFER,
        this.ctx.DEPTH_COMPONENT16,
        this.width,
        this.height
      )
    }

    // Attach texture and renderbuffer to framebuffer
    this.ctx.framebufferTexture2D(
      this.ctx.FRAMEBUFFER,
      this.ctx.COLOR_ATTACHMENT0,
      this.ctx.TEXTURE_2D,
      this.id,
      0
    )
    this.ctx.framebufferRenderbuffer(
      this.ctx.FRAMEBUFFER,
      this.ctx.DEPTH_ATTACHMENT,
      this.ctx.RENDERBUFFER,
      this.renderBuffer
    )

    // Check framebuffer status
    if (
      this.ctx.checkFramebufferStatus(this.ctx.FRAMEBUFFER) !==
      this.ctx.FRAMEBUFFER_COMPLETE
    ) {
      throw new Error(
        'Rendering to this texture is not supported (!incomplete framebuffer)'
      )
    }

    // Set the viewport to the texture size
    this.ctx.viewport(0, 0, this.width, this.height)

    // Execute drawing callback
    fn()

    // Restore previous framebuffer, renderbuffer, and viewport
    this.ctx.bindFramebuffer(this.ctx.FRAMEBUFFER, null)
    this.ctx.bindRenderbuffer(this.ctx.RENDERBUFFER, null)
    this.ctx.viewport(viewport[0], viewport[1], viewport[2], viewport[3])
  }
  /**
   * Clear the given texture unit (0-7, defaults to 0)
   */
  public unbind(unit = 0) {
    this.ctx.activeTexture(this.ctx.TEXTURE0 + unit)
    this.ctx.bindTexture(this.ctx.TEXTURE_2D, null)
  }
  /**
   * Switch this texture with `other`, useful for ping-pong rendering technique
   * used in multi-pass rendering
   */
  public swapWith(other: Texture) {
    let temp = other.id
    other.id = this.id
    this.id = temp

    let buffer = other.width
    other.width = this.width
    this.width = buffer

    buffer = other.height
    other.height = this.height
    this.height = buffer
  }

  /**
   * Returns false if `ctx.FLOAT` is not supported.
   *
   * @param ctx A webgl context
   * @returns
   */
  public static canUseFloatingPointTextures(ctx: WebGL2RenderingContext) {
    return !!ctx.getExtension('EXT_color_buffer_float')
  }
  /**
   * Returns false if `ctx.LINEAR` is not supported as a texture filter mode
   * for textures of type `ctx.FLOAT`.
   *
   * @param ctx A webgl context
   * @returns
   */
  public static canUseFloatingPointLinearFiltering(
    ctx: WebGL2RenderingContext
  ) {
    return !!ctx.getExtension('OES_texture_float_linear')
  }
  /**
   * Returns false if `ctx.HALF_FLOAT_OES` is not supported.
   *
   * @param ctx A webgl context
   */
  public static canUseHalfFloatingPointTextures(ctx: WebGL2RenderingContext) {
    return !!ctx.getExtension('EXT_color_buffer_half_float')
  }
  /**
   * Returns false if `ctx.LINEAR` is not supported as a texture filter mode
   * for textures of type `ctx.HALF_FLOAT_OES`.
   *
   * @param ctx A webgl context
   */
  public static canUseHalfFloatingPointLinearFiltering(
    ctx: WebGL2RenderingContext
  ) {
    return !!ctx.getExtension('OES_texture_half_float_linear')
  }
  /**
   * Return a new image created from `image`, an `<img>` tag
   */
  public static fromImage(
    ctx: WebGL2RenderingContext,
    image: HTMLImageElement,
    options: TextureOptions = {}
  ) {
    const texture = new Texture(ctx, image.width, image.height, options)

    try {
      ctx.texImage2D(
        ctx.TEXTURE_2D,
        0,
        texture.format,
        texture.format,
        texture.type,
        image
      )
    } catch (e) {
      if (location.protocol === 'file:') {
        throw new Error(
          'image not loaded for security reasons (serve this page over "http://" instead'
        )
      } else {
        throw new Error(
          'image not loaded for security reasons (image must be loaded from the same origin as the page or use CORS)'
        )
      }
    }

    if (
      'minFilter' in options &&
      options.minFilter != ctx.NEAREST &&
      options.minFilter !== ctx.LINEAR
    ) {
      ctx.generateMipmap(ctx.TEXTURE_2D)
    }

    return texture
  }
  /**
   * Return a checkerboard texture that will switch to the correct texture when
   * it loads.
   */
  public static fromURL() {}
}

type TextureOptions = {
  filter?: number
  format?: number
  magFilter?: number
  minFilter?: number
  type?: number
  wrap?: number
  wrapS?: number
  wrapT?: number
}
