/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare module 'virtual:svg-sprite' {
  /**
   * The raw SVG sprite content as a string.
   */
  const svgSpriteContent: string
  export default svgSpriteContent
}
