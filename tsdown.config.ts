/** Standalone build for the dsh lazy-CJS browser module and its Node loader entries. */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transform } from 'lightningcss'
import { defineConfig } from 'tsdown'

const PACKAGE_NAME = '@benz-ai-x/dsh-client-ui-session-graph'
const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url))
const CSS_PREFIX = '\0dsh-session-graph-css:'
const CSS_SUFFIX = '.mjs'

const packageManifest = JSON.parse(
  readFileSync(resolve(PROJECT_ROOT, 'package.json'), 'utf8'),
) as { readonly name?: unknown; readonly version?: unknown }
if (packageManifest.name !== PACKAGE_NAME || typeof packageManifest.version !== 'string') {
  throw new Error(`package.json must declare ${PACKAGE_NAME} with a string version`)
}

/** Recursively collect stable build inputs for the local content fingerprint. */
function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap(entry => {
      const path = resolve(directory, entry.name)
      return entry.isDirectory() ? filesUnder(path) : [path]
    })
    .sort()
}

/** A reproducible Build ID that changes whenever browser build inputs change. */
function localBuildId(): string {
  const hash = createHash('sha256')
  const inputs = [
    resolve(PROJECT_ROOT, 'package.json'),
    resolve(PROJECT_ROOT, 'tsdown.config.ts'),
    ...filesUnder(resolve(PROJECT_ROOT, 'src')),
  ]
  for (const file of inputs) {
    hash.update(relative(PROJECT_ROOT, file))
    hash.update('\0')
    hash.update(readFileSync(file))
    hash.update('\0')
  }
  return `local-${hash.digest('hex').slice(0, 8)}`
}

const buildIdOverride = process.env.DSH_SESSION_GRAPH_BUILD_ID?.trim()
const BUILD_ID = buildIdOverride === undefined || buildIdOverride === ''
  ? localBuildId()
  : buildIdOverride

const SHARED_MODULES = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
])

/** Emit a lazy module body that installs one package-owned stylesheet on materialization. */
function styleModule(file: string, css: string, classMap: Readonly<Record<string, string>>): string {
  const tagId = `${PACKAGE_NAME}/${file.split('/').at(-1) ?? file}`
  return [
    `const css = ${JSON.stringify(css)};`,
    `const tagId = ${JSON.stringify(tagId)};`,
    'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css=\' + JSON.stringify(tagId) + \']\') === null) {',
    '  const tag = document.createElement(\'style\');',
    `  tag.dataset.plugin = ${JSON.stringify(PACKAGE_NAME)};`,
    '  tag.dataset.pluginCss = tagId;',
    '  tag.textContent = css;',
    '  document.head.appendChild(tag);',
    '}',
    `export default ${JSON.stringify(classMap)};`,
  ].join('\n')
}

const cssModulesPlugin = {
  name: 'dsh-session-graph-css-modules',
  resolveId(source: string, importer: string | undefined): string | null {
    if (!source.endsWith('.module.css') || importer === undefined) return null
    return CSS_PREFIX + resolve(dirname(importer), source) + CSS_SUFFIX
  },
  async load(this: { addWatchFile: (file: string) => void }, id: string): Promise<string | null> {
    if (!id.startsWith(CSS_PREFIX)) return null
    const file = id.slice(CSS_PREFIX.length, -CSS_SUFFIX.length)
    this.addWatchFile(file)
    const source = await readFile(file)
    const { code, exports: cssExports } = transform({
      filename: file,
      code: source,
      cssModules: { pattern: '[hash]_[local]' },
      minify: true,
    })
    const classMap: Record<string, string> = {}
    for (const [local, value] of Object.entries(cssExports ?? {}).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0)) {
      classMap[local] = value.name
    }
    return styleModule(file, code.toString(), classMap)
  },
}

const nodeEntry = (entry: string) => ({
  entry: [entry],
  outDir: 'lib',
  format: ['esm'] as const,
  platform: 'node' as const,
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
})

export default defineConfig([
  { ...nodeEntry('src/index.ts'), clean: true },
  nodeEntry('src/invariant.ts'),
  {
    name: `${PACKAGE_NAME}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    dts: false,
    sourcemap: true,
    clean: false,
    deps: {
      neverBundle: (specifier: string) => SHARED_MODULES.has(specifier),
      alwaysBundle: (specifier: string) => !SHARED_MODULES.has(specifier),
      onlyBundle: ['clsx'],
    },
    define: {
      __SESSION_GRAPH_VERSION__: JSON.stringify(packageManifest.version),
      __SESSION_GRAPH_BUILD_ID__: JSON.stringify(BUILD_ID),
      'process.env': '{}',
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    plugins: [cssModulesPlugin],
    outputOptions: {
      entryFileNames: 'client.js',
      sourcemapExcludeSources: false,
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_NAME)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
