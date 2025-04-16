import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

import svgSprite from './plugins/vite-plugin-svg-sprite'

// https://astro.build/config
export default defineConfig(
  {
    integrations: [react()],
    vite: {
      plugins: [
        tailwindcss(),
        svgSprite({
          inputDir: 'src/sprites',
          dtsOutputFile: 'src/svg-sprite.d.ts',
          useSvgo: false,
        }),
      ],
    },
  } // ...
)
