import type { GL } from './gl'
import { Mesh } from './gl/Mesh'
import { Shader } from './gl/Shader'
import { Texture } from './gl/Texture'
import type { Vector } from './gl/Vector'

const vertexShader = `
  varying vec2 coord;
  void main() {
    coord = gl_Vertex.xy * 0.5 + 0.5;
    gl_Position = vec4(gl_Vertex.xyz, 1.0);
  }
`

/**
 * Represents a water simulation with caustics.
 */
export class Water {
  gl: GL
  plane: Mesh
  textureA: Texture
  textureB: Texture
  dropShader: Shader
  updateShader: Shader
  normalShader: Shader
  sphereShader: Shader

  /**
   * Constructs the water simulation.
   * @param ctx The webGL context to work within.
   */
  constructor(gl: GL) {
    if (!Texture.canUseFloatingPointTextures(gl.ctx)) {
      throw new Error('This requires the OES_texture_float extension')
    }

    let filter = Texture.canUseFloatingPointLinearFiltering(gl.ctx)
      ? gl.ctx.LINEAR
      : gl.ctx.NEAREST

    this.gl = gl
    this.plane = Mesh.plane(gl.ctx)
    this.textureA = new Texture(gl.ctx, 256, 256, {
      filter,
      type: gl.ctx.FLOAT,
    })
    this.textureB = new Texture(gl.ctx, 256, 256, {
      filter,
      type: gl.ctx.FLOAT,
    })

    if (
      !this.textureA.canDrawTo() ||
      (!this.textureB.canDrawTo() &&
        Texture.canUseHalfFloatingPointTextures(gl.ctx))
    ) {
      filter = Texture.canUseHalfFloatingPointLinearFiltering(gl.ctx)
        ? gl.ctx.LINEAR
        : gl.ctx.NEAREST
      this.textureA = new Texture(gl.ctx, 256, 256, {
        filter,
        type: gl.ctx.HALF_FLOAT,
      })
      this.textureB = new Texture(gl.ctx, 256, 256, {
        filter,
        type: gl.ctx.HALF_FLOAT,
      })
    }

    this.dropShader = new Shader(gl, vertexShader, this.dropFragmentShader())
    this.updateShader = new Shader(
      gl,
      vertexShader,
      this.updateFragmentShader()
    )
    this.normalShader = new Shader(
      gl,
      vertexShader,
      this.normalFragmentShader()
    )
    this.sphereShader = new Shader(
      gl,
      vertexShader,
      this.sphereFragmentShader()
    )
  }

  public addDrop(x: number, y: number, radius: number, strength: number) {
    const self = this
    this.textureB.drawTo(() => {
      self.textureA.bind()
      self.dropShader
        .uniforms({
          center: [x, y],
          radius,
          strength,
        })
        .draw(self.plane)
    })
    this.textureB.swapWith(this.textureA)
  }
  public moveSphere(oldCenter: Vector, newCenter: Vector, radius: number) {
    const self = this
    this.textureB.drawTo(() => {
      self.textureA.bind()
      self.sphereShader
        .uniforms({
          oldCenter,
          newCenter,
          radius,
        })
        .draw(self.plane)
    })
    this.textureB.swapWith(this.textureA)
  }
  public stepSimulation() {
    const self = this
    this.textureB.drawTo(() => {
      self.textureA.bind()
      self.updateShader
        .uniforms({
          delta: [1 / self.textureA.width, 1 / self.textureA.height],
        })
        .draw(self.plane)
    })
    this.textureB.swapWith(this.textureA)
  }
  public updateNormals() {
    const self = this
    this.textureB.drawTo(() => {
      self.textureA.bind()
      self.normalShader
        .uniforms({
          delta: [1 / self.textureA.width, 1 / self.textureA.height],
        })
        .draw(self.plane)
    })
    this.textureB.swapWith(this.textureA)
  }

  private dropFragmentShader() {
    return `
      const float PI = 3.141592653589793;
      uniform sampler2D texture;
      uniform vec2 center;
      uniform float radius;
      uniform float strength;
      varying vec2 coord;
      void main() {
        /* get vertex info */
        vec4 info = texture2D(texture, coord);
        
        /* add the drop to the height */
        float drop = max(0.0, 1.0 - length(center * 0.5 + 0.5 - coord) / radius);
        drop = 0.5 - cos(drop * PI) * 0.5;
        info.r += drop * strength;
        
        gl_FragColor = info;
      }
    `
  }
  private updateFragmentShader() {
    return `
      uniform sampler2D texture;
      uniform vec2 delta;
      varying vec2 coord;
      void main() {
        /* get vertex info */
        vec4 info = texture2D(texture, coord);
        
        /* calculate average neighbor height */
        vec2 dx = vec2(delta.x, 0.0);
        vec2 dy = vec2(0.0, delta.y);
        float average = (
          texture2D(texture, coord - dx).r +
          texture2D(texture, coord - dy).r +
          texture2D(texture, coord + dx).r +
          texture2D(texture, coord + dy).r
        ) * 0.25;
        
        /* change the velocity to move toward the average */
        info.g += (average - info.r) * 2.0;
        
        /* attenuate the velocity a little so waves do not last forever */
        info.g *= 0.995;
        
        /* move the vertex along the velocity */
        info.r += info.g;
        
        gl_FragColor = info;
      }
    `
  }
  private normalFragmentShader() {
    return `
      uniform sampler2D texture;
      uniform vec2 delta;
      varying vec2 coord;
      void main() {
        /* get vertex info */
        vec4 info = texture2D(texture, coord);
        
        /* update the normal */
        vec3 dx = vec3(delta.x, texture2D(texture, vec2(coord.x + delta.x, coord.y)).r - info.r, 0.0);
        vec3 dy = vec3(0.0, texture2D(texture, vec2(coord.x, coord.y + delta.y)).r - info.r, delta.y);
        info.ba = normalize(cross(dy, dx)).xz;
        
        gl_FragColor = info;
      }
    `
  }
  private sphereFragmentShader() {
    return `
      uniform sampler2D texture;
      uniform vec3 oldCenter;
      uniform vec3 newCenter;
      uniform float radius;
      varying vec2 coord;
      
      float volumeInSphere(vec3 center) {
        vec3 toCenter = vec3(coord.x * 2.0 - 1.0, 0.0, coord.y * 2.0 - 1.0) - center;
        float t = length(toCenter) / radius;
        float dy = exp(-pow(t * 1.5, 6.0));
        float ymin = min(0.0, center.y - dy);
        float ymax = min(max(0.0, center.y + dy), ymin + 2.0 * dy);
        return (ymax - ymin) * 0.1;
      }
      
      void main() {
        /* get vertex info */
        vec4 info = texture2D(texture, coord);
        
        /* add the old volume */
        info.r += volumeInSphere(oldCenter);
        
        /* subtract the new volume */
        info.r -= volumeInSphere(newCenter);
        
        gl_FragColor = info;
      }
    `
  }
}
