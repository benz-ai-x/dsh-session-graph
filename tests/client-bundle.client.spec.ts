// @vitest-environment jsdom
/** Executes the packed browser-module format against a minimal dsh Client context. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const PLUGIN_ID = '@benz-ai-x/dsh-client-ui-session-graph'

interface Handoff {
  readonly id: string
  readonly factory: (require: (specifier: string) => unknown) => Record<string, unknown>
}

interface ClientPlugin {
  readonly inject: readonly string[]
  readonly apply: (ctx: FakeContext) => void
}

interface ViewDefinition {
  readonly name: string
  readonly id: string
  readonly label: () => string
  readonly inject: () => {
    readonly openSession: (id: string) => void
    readonly branchSession: (id: string) => Promise<void>
  }
}

interface FakeContext {
  effect: (install: () => unknown, label: string) => void
  locale: {
    register: (namespace: string, dictionaries: Readonly<Record<string, object>>) => () => void
    bind: (namespace: string) => (key: string) => string
  }
  slots: {
    inject: (name: string, install: () => unknown) => void
    register: (definition: ViewDefinition, component: unknown) => () => void
  }
  sessions: {
    open: (id: string) => void
    fork: (request: { readonly sessionId: string; readonly increaseTitle: boolean }) => Promise<string>
  }
}

type BrowserWindow = Window & typeof globalThis & {
  __ModuleLoader__?: { load: (handoff: Handoff) => void }
}

async function loadArtifact(): Promise<{ readonly handoff: Handoff; readonly plugin: ClientPlugin }> {
  const code = readFileSync(resolve('lib/client.js'), 'utf8')
  let handoff: Handoff | undefined
  const browserWindow = window as BrowserWindow
  browserWindow.__ModuleLoader__ = { load: value => { handoff = value } }
  // The built artifact is deliberately evaluated in its target window scope.
  new Function(code)()
  expect(handoff).toBeDefined()
  const shared = new Map<string, unknown>([
    ['react', await import('react')],
    ['react/jsx-runtime', await import('react/jsx-runtime')],
  ])
  const plugin = handoff!.factory((specifier) => {
    if (!shared.has(specifier)) throw new Error(`unexpected client-module request: ${specifier}`)
    return shared.get(specifier)
  }) as unknown as ClientPlugin
  return { handoff: handoff!, plugin }
}

afterEach(() => {
  delete (window as BrowserWindow).__ModuleLoader__
  for (const element of document.querySelectorAll('style')) element.remove()
})

describe('tsdown client artifact', () => {
  it('registers its lazy module factory under the published package name', async () => {
    const { handoff, plugin } = await loadArtifact()
    expect(handoff.id).toBe(PLUGIN_ID)
    expect(plugin.apply).toBeTypeOf('function')
    expect(plugin.inject).toEqual(['slots', 'sessions', 'locale'])
  })

  it('registers and disposes the Graph view through the dsh Client services', async () => {
    const { plugin } = await loadArtifact()
    const views: ViewDefinition[] = []
    const disposers: (() => void)[] = []
    const forkRequests: { readonly sessionId: string; readonly increaseTitle: boolean }[] = []
    const ctx: FakeContext = {
      effect: (install) => {
        const disposer = install()
        if (typeof disposer === 'function') disposers.push(disposer as () => void)
      },
      locale: {
        register: () => () => {},
        bind: () => key => key === 'view.graph' ? 'Graph' : key,
      },
      slots: {
        inject: (name, install) => {
          expect(name).toBe('conversation.view')
          const disposer = install()
          if (typeof disposer === 'function') disposers.push(disposer as () => void)
        },
        register: (definition) => {
          views.push(definition)
          return () => { views.splice(views.indexOf(definition), 1) }
        },
      },
      sessions: {
        open: () => {},
        fork: async (request) => {
          forkRequests.push(request)
          return 'child'
        },
      },
    }

    plugin.apply(ctx)
    expect(views).toHaveLength(1)
    expect(views[0]).toMatchObject({ name: 'conversation.view', id: 'graph' })
    expect(views[0]?.label()).toBe('Graph')
    await views[0]?.inject().branchSession('source')
    expect(forkRequests).toEqual([{ sessionId: 'source', increaseTitle: true }])
    for (const dispose of disposers.reverse()) dispose()
    expect(views).toHaveLength(0)
  })

  it('injects package-tagged CSS when the factory materializes', async () => {
    await loadArtifact()
    expect(document.querySelectorAll(`style[data-plugin=${JSON.stringify(PLUGIN_ID)}]`))
      .toHaveLength(1)
  })
})
