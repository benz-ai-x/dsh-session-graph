import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import ts from 'typescript'
import { defineConfig } from 'vitest/config'

const harnessRoot = process.env.DSH_HARNESS_ROOT
if (harnessRoot === undefined || harnessRoot === '') {
  throw new Error('DSH_HARNESS_ROOT must point to a prepared deepseek-harness checkout')
}

const configPath = resolve(harnessRoot, 'tsconfig.base.json')
const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic: diagnostic => {
    throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
  },
})
if (parsed === undefined) throw new Error(`cannot load ${configPath}`)
const execArgv = process.allowedNodeEnvironmentFlags.has('--webstorage') ? ['--no-webstorage'] : []
const harnessRequire = createRequire(resolve(harnessRoot, 'apps/web/package.json'))

const harnessPaths = {
  name: 'dsh-harness-paths',
  enforce: 'pre' as const,
  resolveId(source: string, importer: string | undefined): string | null {
    if (source.startsWith('@deepseek-ai/dsh-client-ui-conversation/src/')) {
      return resolve(
        harnessRoot,
        'packages/client/ui-conversation/src',
        source.slice('@deepseek-ai/dsh-client-ui-conversation/src/'.length),
      )
    }
    if (!source.startsWith('@deepseek-ai/')) return null
    const result = ts.resolveModuleName(
      source,
      importer?.split('?')[0] ?? resolve('tests/views.client.spec.tsx'),
      parsed.options,
      ts.sys,
    ).resolvedModule
    return result?.resolvedFileName ?? null
  },
}

export default defineConfig({
  plugins: [harnessPaths],
  resolve: {
    alias: [
      {
        find: '@benz-ai-x/dsh-client-ui-session-graph/client',
        replacement: resolve('src/client/index.ts'),
      },
      {
        find: /^@testing-library\/react$/,
        replacement: harnessRequire.resolve('@testing-library/react'),
      },
      { find: /^react$/, replacement: harnessRequire.resolve('react') },
      { find: /^react\/jsx-runtime$/, replacement: harnessRequire.resolve('react/jsx-runtime') },
      { find: /^react-dom$/, replacement: harnessRequire.resolve('react-dom') },
      { find: /^react-dom\/client$/, replacement: harnessRequire.resolve('react-dom/client') },
      { find: /^react-dom\/test-utils$/, replacement: harnessRequire.resolve('react-dom/test-utils') },
    ],
    dedupe: ['react', 'react-dom', '@deepseek-ai/cordis'],
  },
  test: {
    execArgv,
    include: ['tests/views.client.spec.tsx'],
    pool: 'forks',
    server: {
      deps: {
        inline: true,
      },
    },
  },
})
