import { createHash } from 'node:crypto'
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, join, relative, resolve } from 'node:path'
import type { PluginOption, ResolvedConfig, ViteDevServer } from 'vite'

let internalSvgoOptimizeFn: SvgoOptimizeFunction | null = null
let isSvgoEnabledAndLoaded = false
let finalSvgoConfig: SvgoConfig | undefined = undefined

/**
 * Vite plugin to generate SVG sprites with optional optimization and TypeScript definition generation.
 * @param options - The plugin configuration options.
 * @returns A Vite plugin object.
 */
export default function spriteIconPlugin(options: Options): PluginOption {
  if (!options.inputDir) {
    throw new Error("[svgSpritePlugin] Missing required option: 'inputDir'")
  }

  const {
    inputDir,
    virtualModuleId = 'virtual:svg-sprite',
    symbolIdPrefix = 'icon-',
    outputDir = '',
    outputFileName,
    dtsOutputFile = 'svg-sprite',
    dtsTypeName = 'SvgIconId',
  } = options

  const resolvedVirtualModuleId = `\0${virtualModuleId}`
  const useSvgoInternal = options.useSvgo ?? false
  const svgoConfig = options.useSvgo ? options.svgoConfig : undefined
  const svgoOptimizeFn = options.useSvgo
    ? options.svgoOptimizeFunction
    : undefined

  if (!useSvgoInternal) {
    if (svgoConfig) {
      console.warn(
        `[svgSpritePlugin] 'svgoConfig' provided but 'useSvgo' is false. SVGO will not be used.`
      )
    }
    if (svgoOptimizeFn) {
      console.warn(
        `[svgSpritePlugin] 'svgoOptimizeFunction' provided but 'useSvgo' is false. It will not be used.`
      )
    }
  }

  let resolvedInputDir: string = ''
  let resolvedDtsOutputPath: string | undefined
  let viteConfig: ResolvedConfig
  let svgSpriteContent: string | null = null
  let currentSymbolIds: string[] = []
  let lastSpriteHash: string | null = null

  internalSvgoOptimizeFn = null
  isSvgoEnabledAndLoaded = false
  finalSvgoConfig = undefined

  return {
    name: 'vite-plugin-svg-sprite',
    async buildStart() {
      await updateSpriteAndDts()

      if (svgSpriteContent === null && outputFileName) {
        this.warn(
          `[svgSpritePlugin] Failed to generate SVG sprite content. File '${outputFileName}' will not be emitted.`
        )
      }
      if (svgSpriteContent === null && resolvedDtsOutputPath) {
        this.warn(
          `[svgSpritePlugin] Failed to generate SVG sprite content. DTS file '${relative(viteConfig.root, resolvedDtsOutputPath)}' may be empty or inaccurate.`
        )
      }
    },
    async configResolved(config) {
      viteConfig = config
      resolvedInputDir = resolve(config.root, inputDir)
      if (dtsOutputFile) {
        resolvedDtsOutputPath = resolve(config.root, dtsOutputFile)
        console.log(
          `[svgSpritePlugin] Will generate TS definitions to: ${relative(config.root, resolvedDtsOutputPath)}`
        )
      }

      isSvgoEnabledAndLoaded = false
      internalSvgoOptimizeFn = null
      finalSvgoConfig = undefined

      if (useSvgoInternal) {
        if (svgoOptimizeFn) {
          if (typeof svgoOptimizeFn === 'function') {
            internalSvgoOptimizeFn = svgoOptimizeFn
            isSvgoEnabledAndLoaded = true
            console.log(
              `[svgSpritePlugin] Using user-provided SVGO optimize function.`
            )
          } else {
            console.warn(
              `[svgSpritePlugin] Warning: 'svgoOptimizeFunction' was provided but is not a function. SVGO optimization disabled.`
            )
          }
        } else {
          try {
            // @ts-expect-error - Dynamic import for SVGO module
            const svgoModule = await import('svgo')
            internalSvgoOptimizeFn = svgoModule.optimize
            isSvgoEnabledAndLoaded = true
            console.log(
              `[svgSpritePlugin] SVGO module loaded dynamically. Optimization enabled.`
            )
          } catch (e: any) {
            if (
              e.code === 'ERR_MODULE_NOT_FOUND' ||
              e.code === 'MODULE_NOT_FOUND'
            ) {
              console.warn(
                `[svgSpritePlugin] Warning: 'useSvgo' is true, but 'svgo' is not installed and no 'svgoOptimizeFunction' was provided. Please run 'npm install -D svgo'. Skipping SVG optimization.`
              )
            } else {
              console.error(
                `[svgSpritePlugin] Error loading SVGO module:`,
                e.message
              )
            }
          }
        }

        if (isSvgoEnabledAndLoaded) {
          finalSvgoConfig = svgoConfig ?? {
            plugins: [
              {
                name: 'preset-default',
                params: { overrides: { removeViewBox: false } },
              },
              { name: 'removeDimensions', active: true },
            ],
          }
        }
      } else {
        console.log(
          `[svgSpritePlugin] SVGO optimization disabled ('useSvgo' is false or undefined).`
        )
      }

      if (!isSvgoEnabledAndLoaded && useSvgoInternal) {
        console.warn(
          `[svgSpritePlugin] SVGO optimization was requested but could not be enabled (check warnings above).`
        )
      }

      if (outputFileName) {
        console.log(
          `[svgSpritePlugin] Will emit sprite file during build to: ${join(outputDir, outputFileName)}`
        )
      }

      console.log(
        `[svgSpritePlugin] Watching SVG directory: ${resolvedInputDir}`
      )
    },
    configureServer(server) {
      server.httpServer?.once('listening', async () => {
        await updateSpriteAndDts(server)

        server.watcher.add(resolvedInputDir)

        server.watcher.on('add', handleChange)
        server.watcher.on('change', handleChange)
        server.watcher.on('unlink', handleChange)

        async function handleChange(filePath: string) {
          if (
            !filePath.startsWith(resolvedInputDir) &&
            !filePath.endsWith('.svg')
          )
            return

          console.log(
            `[svgSpritePlugin] Change detected: ${relative(viteConfig.root, filePath)}`
          )
          await updateSpriteAndDts(server)
        }
      })
    },
    async generateBundle(_options) {
      if (!outputFileName || !svgSpriteContent) return

      const finalOutputPath = join(outputDir, outputFileName)
      const errorContent =
        '<svg xmlns="http://www.w3.org/2000/svg" style="display: none;"></svg>'
      if (svgSpriteContent === errorContent) {
        this.warn(
          `[svgSpritePlugin] Skipping emission of '${finalOutputPath}' due to empty or error state sprite content.`
        )
        return
      }

      console.log(
        `[svgSpritePlugin] Emitting sprite asset file to: ${finalOutputPath}`
      )
      this.emitFile({
        type: 'asset',
        fileName: finalOutputPath,
        source: svgSpriteContent,
      })
    },
    async load(id) {
      if (id !== resolvedVirtualModuleId) return null

      if (svgSpriteContent === null) await updateSpriteAndDts()
      return { code: svgSpriteContent ?? '', map: null }
    },
    resolveId(id) {
      return id === resolvedVirtualModuleId ? resolvedVirtualModuleId : null
    },
  }

  /**
   * Reads SVG files from the input directory, processes them (optionally with SVGO),
   * and generates the combined SVG sprite content and symbol IDs.
   * @returns A promise resolving to an object with spriteContent and symbolIds, or null on error.
   */
  async function generateSprite() {
    const symbols: string[] = []
    const symbolIds: string[] = []

    try {
      const files = await readdir(resolvedInputDir)
      const svgFiles = files.filter(file => file.endsWith('.svg'))

      for (const file of svgFiles) {
        const filePath = join(resolvedInputDir, file)

        try {
          const fileStat = await stat(filePath)
          if (!fileStat.isFile()) continue

          let svgFileContent = await readFile(filePath, 'utf-8')

          if (isSvgoEnabledAndLoaded && internalSvgoOptimizeFn) {
            try {
              svgFileContent = internalSvgoOptimizeFn(
                svgFileContent,
                finalSvgoConfig
              ).data
            } catch (svgoError: any) {
              console.warn(
                `[svgSpritePlugin] SVGO optimization failed for ${file}: ${svgoError.message}. Using raw content.`
              )
            }
          }

          const symbolId = symbolIdPrefix + basename(file, '.svg')
          const processedSymbol = processSvg(svgFileContent, symbolId)

          if (processedSymbol) {
            symbols.push(processedSymbol)
            symbolIds.push(symbolId)
          } else {
            console.warn(
              `[svgSpritePlugin] Skipping invalid or empty SVG file after processing: ${file}`
            )
          }
        } catch (readError: any) {
          console.error(
            `[svgSpritePlugin] Error reading SVG file ${file}:`,
            readError.message
          )
        }
      }

      const generatedSpriteContent =
        symbols.length === 0
          ? '<svg xmlns="http://www.w3.org/2000/svg" style="display: none;"></svg>'
          : `<svg xmlns="http://www.w3.org/2000/svg" style="display: none;">\n${symbols.join('\n')}\n</svg>`

      if (symbols.length === 0) {
        console.warn(
          `[svgSpritePlugin] No valid SVG files found in: ${resolvedInputDir}`
        )
      }

      return { spriteContent: generatedSpriteContent, symbolIds }
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        console.error(
          `[svgSpritePlugin] Error: Input directory not found: ${resolvedInputDir}`
        )
      } else {
        console.error(
          `[svgSpritePlugin] Error reading input directory ${resolvedInputDir}:`,
          err.message
        )
      }
      return null
    }
  }
  /**
   * Regenerates the sprite, updates symbol IDs, optionally writes the DTS file,
   * and triggers HMR updates if applicable.
   * @param server - The ViteDevServer instance (only available in dev mode).
   * @returns A promise resolving to true if an update occurred, false otherwise.
   */
  async function updateSpriteAndDts(server?: ViteDevServer): Promise<boolean> {
    const generationResult = await generateSprite()

    if (generationResult === null) {
      svgSpriteContent =
        '<svg xmlns="http://www.w3.org/2000/svg" style="display: none;"></svg>'
      currentSymbolIds = []
      lastSpriteHash = null
      if (resolvedDtsOutputPath) {
        const dtsContent = generateDtsContent([], dtsTypeName)
        await writeDtsFile(dtsContent, resolvedDtsOutputPath, viteConfig.root)
      }
      return false
    }

    const { spriteContent: newSpriteContent, symbolIds: newSymbolIds } =
      generationResult
    const newHash = createHash('sha256').update(newSpriteContent).digest('hex')

    if (newHash === lastSpriteHash) return false

    console.log(`[svgSpritePlugin] SVG sprite content updated.`)
    svgSpriteContent = newSpriteContent
    currentSymbolIds = newSymbolIds
    lastSpriteHash = newHash

    if (resolvedDtsOutputPath) {
      const dtsContent = generateDtsContent(currentSymbolIds, dtsTypeName)
      await writeDtsFile(dtsContent, resolvedDtsOutputPath, viteConfig.root)
    }

    if (server) {
      const mod = server.moduleGraph.getModuleById(resolvedVirtualModuleId)

      if (mod) {
        server.moduleGraph.invalidateModule(mod)
        server.ws.send({
          type: 'update',
          updates: [
            {
              type: 'js-update',
              path: mod.url,
              acceptedPath: mod.url,
              timestamp: Date.now(),
            },
          ],
        })

        console.log(`[svgSpritePlugin] HMR update sent for ${virtualModuleId}`)
      }
    }

    return true
  }
}

/**
 * Generates the content for the TypeScript declaration file (.d.ts).
 * @param ids - An array of symbol IDs generated for the sprite.
 * @param typeName - The name for the exported TypeScript type.
 * @returns A string containing the TypeScript type definition.
 */
function generateDtsContent(ids: string[], typeName: string) {
  const header = `// Generated by vite-plugin-svg-sprite-generator ${new Date().toISOString()}\n// Do not edit this file directly.\n`
  if (ids.length === 0) {
    return `${header}export type ${typeName} = never;\n`
  }

  const sortedIds = [...ids].sort()
  const typeEntries = sortedIds.map(id => `  | '${id}'`).join('\n')
  return `${header}export type ${typeName} =\n${typeEntries};\n`
}

/**
 * Basic SVG processing: Cleans and wraps SVG content within a <symbol> tag.
 * @param content - The raw SVG string content.
 * @param id - The ID to assign to the generated <symbol>.
 * @returns The SVG content wrapped in a <symbol> tag, or null if processing fails.
 */
function processSvg(content: string, id: string) {
  const svgTagMatch = content.match(/<svg([^>]*)>/)
  if (!svgTagMatch) return null

  let viewBoxMatch = svgTagMatch[1].match(/viewBox="([^"]+)"/)
  let viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24'
  const innerContentMatch = content.match(/<svg[^>]*>(.*?)<\/svg>/s)
  const innerContent = innerContentMatch ? innerContentMatch[1].trim() : ''
  if (!innerContent) return null
  if (!viewBoxMatch) {
    console.warn(
      `[svgSpritePlugin] SVG ${id} missing viewBox. Defaulting to "0 0 24 24".`
    )
  }

  return `<symbol id="${id}" viewBox="${viewBox}">${innerContent}</symbol>`
}

/**
 * Writes the generated DTS content to the specified file path.
 * @param content - The string content to write to the file.
 * @param outputPath - The absolute path where the file should be written.
 * @param viteRoot - The project's root directory path (for logging purposes).
 */
async function writeDtsFile(
  content: string,
  outputPath: string,
  viteRoot: string
) {
  try {
    await writeFile(outputPath, content, 'utf-8')
    console.log(
      `[svgSpritePlugin] TypeScript definition file updated: ${relative(viteRoot, outputPath)}`
    )
  } catch (err: any) {
    console.error(
      `[svgSpritePlugin] Error writing TypeScript definition file to ${outputPath}:`,
      err.message
    )
  }
}

/** Plugin Options Interface */
type Options = OptionsSvgoDisabled | OptionsSvgoEnabled
type OptionsBase = {
  /**
   * REQUIRED: Path to the directory containing source SVG files. Relative to Vite root.
   */
  inputDir: string
  /**
   * Virtual module ID.
   * @default 'virtual:svg-sprite'
   */
  virtualModuleId?: string
  /**
   * Prefix for generated symbol IDs.
   * @default 'icon-'
   */
  symbolIdPrefix?: string
  /**
   * Optional: Output directory for sprite file during build (relative to build.outDir).
   * @default ''
   */
  outputDir?: string
  /**
   * Optional: File name for emitted sprite during build. Enables physical file output.
   * @default undefined
   */
  outputFileName?: string
  /**
   * Optional: Path for the generated TypeScript declaration file (.d.ts). Relative to Vite root.
   * @default undefined
   */
  dtsOutputFile?: string
  /**
   * Optional: Name of the exported type in the generated .d.ts file. Requires `dtsOutputFile`.
   * @default 'SvgIconId'
   */
  dtsTypeName?: string
}
type OptionsSvgoDisabled = OptionsBase & {
  /**
   * Disable SVGO optimization (or leave undefined for default behavior).
   */
  useSvgo: false
}
type OptionsSvgoEnabled = OptionsBase & {
  /**
   * Enable SVGO optimization. Requires either 'svgo' to be installed
   * OR `svgoOptimizeFunction` to be provided.
   */
  useSvgo: true
  /**
   * **Optional:** Configuration object passed to the SVGO optimize function.
   * See SVGO documentation for options.
   * @default (built-in defaults)
   */
  svgoConfig?: SvgoConfig
  /**
   * **Optional:** Provide the SVGO `optimize` function directly.
   * If provided, this function will be used instead of dynamically importing 'svgo'.
   * The function should match the signature: `(input: string, config?: object) => { data: string }`.
   */
  svgoOptimizeFunction?: SvgoOptimizeFunction
}
/**
 * Function signature expected for SVGO's optimize function or a compatible replacement.
 * @param input - The SVG string input.
 * @param config - Optional configuration object for optimization.
 * @returns An object containing the optimized SVG string in the 'data' property.
 */
type SvgoOptimizeFunction = (
  input: string,
  config?: SvgoConfig
) => { data: string }

/**
 * Represents the SVGO configuration object.
 * For type safety, if 'svgo' is installed, this should conform to the 'Config' type exported by 'svgo'.
 * See SVGO documentation for options: https://github.com/svg/svgo#configuration
 */
type SvgoConfig = object
