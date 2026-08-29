// @vitest-environment jsdom
/** Executes the packed browser-module format against a minimal dsh Client context. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const PLUGIN_ID = '@benz-ai-x/dsh-client-ui-session-graph'

interface Handoff {
  readonly id: string
  readonly factory: (require: (specifier: string) => unknown) => Record<string, unknown>
}

interface ClientPlugin {
  readonly inject: readonly string[]
  readonly apply: (ctx: FakeContext) => void | Promise<void | (() => Promise<void>)>
}

interface ViewDefinition {
  readonly name: string
  readonly id: string
  readonly label: () => string
  readonly inject: () => {
    readonly openSession: (id: string) => void
    readonly branchSession: (id: string) => Promise<void>
    readonly generateSessionDigest: (
      id: string,
      options: { readonly refresh: boolean },
      signal: AbortSignal,
    ) => Promise<unknown>
  }
}

interface FakeContext {
  inject: (
    services: readonly string[],
    apply: (ctx: FakeContext) => void,
  ) => Promise<void> & { dispose: () => Promise<void> }
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
  remote: {
    $mount: (contribution: unknown) => Promise<() => Promise<void>>
    sessionGraphDigest: {
      generate: (request: unknown, signal: AbortSignal) => Promise<unknown>
    }
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
    expect(plugin.inject).toEqual(['slots', 'sessions', 'locale', 'remote'])
  })

  it('registers and disposes the Graph view through the dsh Client services', async () => {
    const { plugin } = await loadArtifact()
    const views: ViewDefinition[] = []
    const rootDisposers: Array<() => void | Promise<void>> = []
    const uiDisposers: Array<() => void | Promise<void>> = []
    const injectedServices: readonly string[][] = []
    const forkRequests: { readonly sessionId: string; readonly increaseTitle: boolean }[] = []
    const digestRequests: { readonly request: unknown; readonly signal: AbortSignal }[] = []
    const disposeRemote = vi.fn(async () => {})
    const mountRemote = vi.fn(async () => disposeRemote)
    const digestRemote = {
      generate: async (request: unknown, signal: AbortSignal) => {
        digestRequests.push({ request, signal })
        return { ok: true, value: { kind: 'empty' } }
      },
    }
    let ctx: FakeContext
    ctx = {
      inject: (services, apply) => {
        injectedServices.push(services)
        const injectedCtx: FakeContext = {
          ...ctx,
          effect: (install) => {
            const disposer = install()
            if (typeof disposer === 'function') uiDisposers.push(disposer as () => void | Promise<void>)
          },
          remote: { $mount: mountRemote, sessionGraphDigest: digestRemote },
        }
        apply(injectedCtx)
        const fiber = Promise.resolve() as Promise<void> & { dispose: () => Promise<void> }
        fiber.dispose = async () => {
          for (const dispose of uiDisposers.reverse()) await dispose()
        }
        return fiber
      },
      effect: (install) => {
        const disposer = install()
        if (typeof disposer === 'function') rootDisposers.push(disposer as () => void | Promise<void>)
      },
      locale: {
        register: () => () => {},
        bind: () => key => key === 'view.graph' ? 'Graph' : key,
      },
      slots: {
        inject: (name, install) => {
          expect(name).toBe('conversation.view')
          const disposer = install()
          if (typeof disposer === 'function') uiDisposers.push(disposer as () => void | Promise<void>)
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
      remote: {
        $mount: mountRemote,
        get sessionGraphDigest() {
          throw new Error('cannot get property "remote.sessionGraphDigest" without inject')
        },
      },
    }

    const disposePlugin = await plugin.apply(ctx)
    expect(mountRemote).toHaveBeenCalledOnce()
    expect(injectedServices).toEqual([[
      'slots', 'sessions', 'locale', 'remote.sessionGraphDigest',
    ]])
    expect(views).toHaveLength(1)
    expect(views[0]).toMatchObject({ name: 'conversation.view', id: 'graph' })
    expect(views[0]?.label()).toBe('Graph')
    await views[0]?.inject().branchSession('source')
    expect(forkRequests).toEqual([{ sessionId: 'source', increaseTitle: true }])
    const controller = new AbortController()
    await expect(views[0]?.inject().generateSessionDigest(
      'source', { refresh: true }, controller.signal,
    )).resolves.toEqual({ kind: 'empty' })
    expect(digestRequests).toEqual([{
      request: { sessionId: 'source', refresh: true },
      signal: controller.signal,
    }])
    expect(disposePlugin).toBeTypeOf('function')
    await disposePlugin?.()
    for (const dispose of rootDisposers.reverse()) await dispose()
    expect(views).toHaveLength(0)
    expect(disposeRemote).toHaveBeenCalledOnce()
  })

  it('injects package-tagged CSS when the factory materializes', async () => {
    await loadArtifact()
    expect(document.querySelectorAll(`style[data-plugin=${JSON.stringify(PLUGIN_ID)}]`))
      .toHaveLength(1)
  })
})
