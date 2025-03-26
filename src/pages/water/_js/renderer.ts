import { Mesh } from './gl/Mesh';
import { Shader } from './gl/Shader';
import { Texture } from './gl/Texture';
import { Vector } from './gl/Vector';
import { getElementById } from './utils/dom';


/**
 * WebGL Water Renderer
 * Converts the original JavaScript implementation into a TypeScript class
 */
export class Renderer {
  private tileTexture: Texture
  private lightDir: Vector
  private causticTex: Texture
  private waterMesh: Mesh
  private waterShaders: Shader[]
  private sphereMesh: Mesh
  private sphereShader: Shader
  private cubeMesh: Mesh
  private cubeShader: Shader
  private causticsShader: Shader
  private sphereCenter: Vector
  private sphereRadius: number

  /**
   * Initializes the WebGL water renderer.
   */
  constructor(ctx: WebGL2RenderingContext) {
    this.tileTexture = Texture.fromImage(
      ctx,
      getElementById<HTMLImageElement>('tiles'),
      {
        minFilter: ctx.LINEAR_MIPMAP_LINEAR,
        wrap: ctx.REPEAT,
        format: ctx.RGB,
      }
    )

    this.lightDir = new Vector(2.0, 2.0, -1.0).unit()
    this.causticTex = new Texture(ctx, 1024, 1024)
    this.waterMesh = Mesh.plane({ detail: 200 })
    this.waterShaders = []

    for (let i = 0; i < 2; i++) {
      this.waterShaders[i] = new Shader(
        ctx,
        this.getVertexShader(),
        this.getFragmentShader(i)
      )
    }

    this.sphereMesh = Mesh.sphere({ detail: 10 })
    this.sphereShader = new .Shader(
      ctx,
      this.getSphereVertexShader(),
      this.getSphereFragmentShader()
    )
    this.cubeMesh = Mesh.cube()
    this.cubeMesh.triangles.splice(4, 2)
    this.cubeMesh.compile()
    this.cubeShader = new Shader(
      ctx,
      this.getCubeVertexShader(),
      this.getCubeFragmentShader()
    )
    this.sphereCenter = new Vector()
    this.sphereRadius = 0
    const hasDerivatives = !!ctx.getExtension('OES_standard_derivatives')
    this.causticsShader = new Shader(
      ctx,
      this.getCausticsVertexShader(),
      this.getCausticsFragmentShader(hasDerivatives)
    )
  }

  /**
   * Returns the vertex shader source code.
   */
  private getVertexShader(): string {
    return `
      uniform sampler2D water;
      varying vec3 position;
      void main() {
        vec4 info = texture2D(water, gl_Vertex.xy * 0.5 + 0.5);
        position = gl_Vertex.xzy;
        position.y += info.r;
        gl_Position = gl_ModelViewProjectionMatrix * vec4(position, 1.0);
      }
    `
  }

  /**
   * Returns the fragment shader source code.
   */
  private getFragmentShader(index: number): string {
    return `
      uniform vec3 eye;
      varying vec3 position;
      uniform samplerCube sky;
      void main() {
        vec2 coord = position.xz * 0.5 + 0.5;
        vec4 info = texture2D(water, coord);
        for (int i = 0; i < 5; i++) {
          coord += info.ba * 0.005;
          info = texture2D(water, coord);
        }
        vec3 normal = vec3(info.b, sqrt(1.0 - dot(info.ba, info.ba)), info.a);
        vec3 incomingRay = normalize(position - eye);
        ${index === 1 ? this.getUnderwaterFragment() : this.getAboveWaterFragment()}
      }
    `
  }

  /**
   * Returns the shader code for underwater rendering.
   */
  private getUnderwaterFragment(): string {
    return `
      normal = -normal;
      vec3 reflectedRay = reflect(incomingRay, normal);
      vec3 refractedRay = refract(incomingRay, normal, 1.333);
      float fresnel = mix(0.5, 1.0, pow(1.0 - dot(normal, -incomingRay), 3.0));
      gl_FragColor = vec4(mix(getSurfaceRayColor(position, reflectedRay), getSurfaceRayColor(position, refractedRay) * vec3(0.8, 1.0, 1.1), (1.0 - fresnel)), 1.0);
    `
  }

  /**
   * Returns the shader code for above water rendering.
   */
  private getAboveWaterFragment(): string {
    return `
      vec3 reflectedRay = reflect(incomingRay, normal);
      vec3 refractedRay = refract(incomingRay, normal, 1.0 / 1.333);
      float fresnel = mix(0.25, 1.0, pow(1.0 - dot(normal, -incomingRay), 3.0));
      gl_FragColor = vec4(mix(getSurfaceRayColor(position, refractedRay), getSurfaceRayColor(position, reflectedRay), fresnel), 1.0);
    `
  }

  /**
   * Returns the vertex shader for the sphere.
   */
  private getSphereVertexShader(): string {
    return `
      varying vec3 position;
      void main() {
        position = sphereCenter + gl_Vertex.xyz * sphereRadius;
        gl_Position = gl_ModelViewProjectionMatrix * vec4(position, 1.0);
      }
    `
  }

  /**
   * Returns the fragment shader for the sphere.
   */
  private getSphereFragmentShader(): string {
    return `
      varying vec3 position;
      void main() {
        gl_FragColor = vec4(getSphereColor(position), 1.0);
      }
    `
  }

  /**
   * Returns the cube vertex shader.
   */
  private getCubeVertexShader(): string {
    return `
      varying vec3 position;
      void main() {
        position = gl_Vertex.xyz;
        gl_Position = gl_ModelViewProjectionMatrix * vec4(position, 1.0);
      }
    `
  }

  /**
   * Returns the cube fragment shader.
   */
  private getCubeFragmentShader(): string {
    return `
      varying vec3 position;
      void main() {
        gl_FragColor = vec4(getWallColor(position), 1.0);
      }
    `
  }
}