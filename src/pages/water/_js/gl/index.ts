import { to } from '../utils/apply'

/**
 * A value to `bitwise-or` with new enums to make them
 * distinguishable from standard WebGL enums
 */
const ENUM = 0x12340000

export function GL(options: WebGLContextAttributes = {}) {
  return to(() => glCore(options)).get()
}
export type GL = ReturnType<typeof GL>

function glCore(options: WebGLContextAttributes) {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 600

  const context = canvas.getContext('webgl2', {
    ...options,
    alpha: 'alpha' in options ? options.alpha : false,
  })
  if (!context) throw new Error('WebGL context could not be created')

  const HALF_FLOAT_OES = 0x8d61

  return {
    canvas,
    ctx: context,
    HALF_FLOAT_OES,
  }
}
