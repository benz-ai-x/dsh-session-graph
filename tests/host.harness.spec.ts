import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import SessionStore from '@deepseek-ai/dsh-session'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SessionProjectionCache from '@deepseek-ai/dsh-session-projection-cache'
import Storage from '@deepseek-ai/dsh-storage'
import {
  apply as storageJsonApply,
  Config as storageJsonConfig,
  inject as storageJsonInject,
  name as storageJsonName,
} from '@deepseek-ai/dsh-storage-json'
import {
  apply as storageDomainApply,
  Config as storageDomainConfig,
  inject as storageDomainInject,
  name as storageDomainName,
} from '@deepseek-ai/dsh-storage-domain'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply } from '../src/index.ts'
import { sessionMergeDependenciesFromHarness } from '../src/session-merge-harness.ts'

const id = (value: string): SessionId => value as SessionId

describe('Session Graph Host integration', () => {
  const contexts: Context[] = []
  const roots: string[] = []

  afterEach(async () => {
    for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
    for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
  })

  async function durableContext(root: string): Promise<Context> {
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(Storage)
    await ctx.plugin({
      name: storageJsonName,
      inject: storageJsonInject,
      apply: storageJsonApply,
      Config: storageJsonConfig,
    }, { root })
    await ctx.plugin({
      name: storageDomainName,
      inject: storageDomainInject,
      apply: storageDomainApply,
      Config: storageDomainConfig,
    }, { backend: 'json' })
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    ctx.provide('sessionPersistence', { inspect: async () => ({ meta: {}, events: [] }) })
    ctx.provide('llm', { async *stream() {} })
    apply(ctx)
    await new Promise(resolve => setImmediate(resolve))
    await ctx.plugin(SessionProjectionCache, {
      writeEveryEvents: 100,
      writeIntervalMs: 60_000,
    })
    return ctx
  }

  it('reads the addressed Session and makes a separate routed model call without mutating its log', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    const events = [
      {
        type: 'user/message', seq: 0, time: 1,
        data: {
          source: { kind: 'user' },
          content: [{ type: 'text', text: 'Choose the cache architecture.' }],
        },
      },
      {
        type: 'request/context', seq: 1, time: 2,
        data: { provider: 'session-provider', model: 'session-model' },
      },
      { type: 'turn/end', seq: 2, time: 3, data: { turn: 1 } },
      { type: 'session/title', seq: 3, time: 4, data: { title: 'Cache architecture' } },
    ]
    const before = structuredClone(events)
    const inspect = vi.fn(async (sessionId: SessionId) => ({
      meta: { id: sessionId },
      events,
    }))
    const calls: Readonly<Record<string, unknown>>[] = []
    ctx.provide('sessionPersistence', { inspect })
    ctx.provide('llm', {
      async *stream(options: Readonly<Record<string, unknown>>) {
        calls.push(options)
        yield {
          type: 'text-delta', index: 0,
          text: '{"overview":"A cache strategy was chosen.","keyOutcomes":["Use memory first."],"openItems":["Evaluate persistence."]}',
        }
        yield { type: 'finish', reason: { kind: 'stop' } }
      },
    })
    apply(ctx)
    const service = ctx.get('sessionGraphDigest') as {
      generate: (
        request: { readonly sessionId: string; readonly refresh: boolean },
        signal: AbortSignal,
      ) => Promise<unknown>
    }

    const result = await service.generate(
      { sessionId: 'selected-session', refresh: false },
      new AbortController().signal,
    )

    expect(inspect).toHaveBeenCalledWith(id('selected-session'), expect.any(AbortSignal))
    expect(result).toMatchObject({
      kind: 'ready',
      digest: {
        sessionId: 'selected-session',
        sourceRevision: '3',
        overview: 'A cache strategy was chosen.',
        generatedWhileRunning: false,
      },
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      provider: 'session-provider',
      model: 'session-model',
      purpose: 'session-graph-summary',
      maxTokens: 800,
    })
    expect(calls[0]).not.toHaveProperty('tools')
    expect(events).toEqual(before)

    await service.generate(
      { sessionId: 'selected-session', refresh: false },
      new AbortController().signal,
    )
    expect(calls).toHaveLength(1)
  })

  it('registers the durable Session Merge projection with the Harness registry', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    ctx.provide('sessionPersistence', { inspect: async () => ({ meta: {}, events: [] }) })
    ctx.provide('llm', { async *stream() {} })

    apply(ctx)
    await Promise.resolve()
    const session = ctx.sessions.create()
    session.append('step/start', { turn: 1, step: 1 })
    session.append('user/message', {
      id: 'marker',
      role: 'user',
      source: {
        kind: 'session-graph-merge', version: 1,
        operationId: 'operation-1', sourceIds: ['source-a', 'source-b'],
      },
      content: [{ type: 'text', text: 'Merge sources.' }],
    } as never, { surfaceOp: 'append' })
    session.append('user/message', {
      id: 'references',
      role: 'user',
      source: {
        kind: 'session-reference', version: 1,
        references: [
          { sessionId: 'source-a', capturedThroughSeq: 3, inputIndex: 0 },
          { sessionId: 'source-b', capturedThroughSeq: 4, inputIndex: 1 },
        ],
      },
      content: [{ type: 'text', text: 'snapshots' }],
    } as never, { surfaceOp: 'append' })

    expect(ctx.sessionProjections.snapshot(session).values.sessionGraphMerge).toEqual({
      operationId: 'operation-1',
      contextEventSeq: 2,
      sources: [
        { sessionId: 'source-a', capturedThroughSeq: 3 },
        { sessionId: 'source-b', capturedThroughSeq: 4 },
      ],
    })
  })

  it('restores a Merge relation from the durable Projection Cache after restart and log replay', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-session-merge-'))
    roots.push(root)
    const first = await durableContext(root)
    const targetId = id('merge-target')
    const target = first.sessions.create(targetId, {
      meta: { cwd: '/workspace', createdAt: 1_000 },
    })
    target.append('step/start', { turn: 1, step: 1 })
    target.append('user/message', {
      id: 'marker',
      role: 'user',
      source: {
        kind: 'session-graph-merge', version: 1,
        operationId: 'operation-1', sourceIds: ['source-a', 'source-b'],
      },
      content: [{ type: 'text', text: 'Merge sources.' }],
    } as never, { surfaceOp: 'append' })
    target.append('user/message', {
      id: 'references',
      role: 'user',
      source: {
        kind: 'session-reference', version: 1,
        references: [
          { sessionId: 'source-a', capturedThroughSeq: 3, inputIndex: 0 },
          { sessionId: 'source-b', capturedThroughSeq: 4, inputIndex: 1 },
        ],
      },
      content: [{ type: 'text', text: 'snapshots' }],
    } as never, { surfaceOp: 'append' })
    const header = structuredClone(target.header)
    const events = structuredClone(target.events)
    await first.sessionProjectionCache.write(target)
    expect(first.sessionProjectionCache.cachedSnapshot(header)?.values.sessionGraphMerge)
      .toMatchObject({ operationId: 'operation-1', contextEventSeq: 2 })

    await first.fiber.dispose()
    contexts.splice(contexts.indexOf(first), 1)

    const restarted = await durableContext(root)
    expect(restarted.sessionProjectionCache.cachedSnapshot(header)?.values.sessionGraphMerge)
      .toEqual({
        operationId: 'operation-1',
        contextEventSeq: 2,
        sources: [
          { sessionId: 'source-a', capturedThroughSeq: 3 },
          { sessionId: 'source-b', capturedThroughSeq: 4 },
        ],
      })
    expect(restarted.sessionProjectionCache.coldSnapshot(header, events).values.sessionGraphMerge)
      .toEqual({
        operationId: 'operation-1',
        contextEventSeq: 2,
        sources: [
          { sessionId: 'source-a', capturedThroughSeq: 3 },
          { sessionId: 'source-b', capturedThroughSeq: 4 },
        ],
      })
  })

  it('submits marker and canonical mentions through the package Host Remote', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    const queued: Array<Readonly<Record<string, unknown>>> = []
    const capture = {
      operationId: 'operation-1',
      contextEventSeq: 8,
      sources: [
        { sessionId: 'source-a', capturedThroughSeq: 3 },
        { sessionId: 'source-b', capturedThroughSeq: 4 },
      ],
    }
    let projection: typeof capture | null = null
    const targetSession = { header: { cwd: '/workspace' } }
    const agent = {
      id: id('target-session'),
      session: targetSession,
      inject: (message: Readonly<Record<string, unknown>>) => {
        queued.push(message)
      },
      steer: (message: Readonly<Record<string, unknown>>) => {
        queued.push(message)
        projection = capture
      },
    }
    const write = vi.fn(async () => {})
    ctx.provide('sessionPersistence', { inspect: async () => ({ meta: {}, events: [] }) })
    ctx.provide('llm', { async *stream() {} })
    ctx.provide('sessionController', {
      resolveAgent: async () => ({ agent }),
    })
    ctx.provide('sessionReferenceResolver', {
      remoteExportCandidates: async (_agent: unknown, query: string) => [{
        sessionId: query,
        label: query,
        cwd: '/workspace',
        sameWorkspace: true,
        createdAt: 0,
        mention: `@[${query}](dsh-session:${query})`,
      }],
    })
    ctx.provide('sessionProjections', {
      register: () => () => {},
      stateOf: () => projection === null
        ? { inStep: false, marker: null, value: null }
        : { inStep: true, marker: null, value: projection },
      onChanged: () => () => {},
    })
    ctx.provide('sessionProjectionCache', { write })

    apply(ctx)
    await new Promise(resolve => setImmediate(resolve))
    const service = ctx.get('sessionGraphMerge') as {
      submit: (request: Readonly<Record<string, unknown>>, signal: AbortSignal) => Promise<unknown>
    }
    const result = await service.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-b'],
      instruction: 'Compare conclusions.',
      operationId: 'operation-1',
    }, new AbortController().signal)

    expect(result).toEqual(capture)
    expect(queued).toHaveLength(2)
    expect(queued[0]).toMatchObject({
      role: 'user',
      source: {
        kind: 'session-graph-merge',
        version: 1,
        operationId: 'operation-1',
        sourceIds: ['source-a', 'source-b'],
      },
    })
    expect(queued[1]).toMatchObject({
      role: 'user',
      source: { kind: 'user' },
      content: [{
        type: 'text',
        text: 'Compare conclusions.\n\n@[source-a](dsh-session:source-a)\n@[source-b](dsh-session:source-b)',
      }],
    })
    expect(write).toHaveBeenCalledWith(targetSession)
  })

  it('bounds capture waiting when the target produces neither a projection nor an error', async () => {
    vi.useFakeTimers()
    const ctx = new Context()
    contexts.push(ctx)
    ctx.provide('sessionProjections', {
      stateOf: () => ({ inStep: false, marker: null, value: null }),
      onChanged: () => () => {},
    })
    const dependencies = sessionMergeDependenciesFromHarness(ctx, { captureTimeoutMs: 25 })
    const controller = new AbortController()
    let failure: unknown
    void dependencies.waitForCapture({
      targetSessionId: 'target-session',
      cwd: '/workspace',
      handle: {
        id: id('target-session'),
        session: { header: { cwd: '/workspace' } },
        inject: () => {},
        steer: () => {},
      },
    }, 'operation-1', ['source-a', 'source-b'], controller.signal)
      .catch(error => { failure = error })

    try {
      await vi.advanceTimersByTimeAsync(25)
      expect(failure).toMatchObject({
        code: 'capture-timeout',
        message: 'Session Merge capture timed out after 25ms',
      })
    } finally {
      controller.abort()
      vi.useRealTimers()
    }
  })

  it('accepts a late capture from a previous retry operation when sources match exactly', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    let notifyProjection: ((session: unknown, key: string, value: unknown) => void) | undefined
    let projection: Readonly<Record<string, unknown>> | null = null
    const targetSession = { header: { cwd: '/workspace' } }
    ctx.provide('sessionProjections', {
      stateOf: () => ({ inStep: false, marker: null, value: projection }),
      onChanged: (listener: (session: unknown, key: string, value: unknown) => void) => {
        notifyProjection = listener
        return () => {}
      },
    })
    const dependencies = sessionMergeDependenciesFromHarness(ctx, { captureTimeoutMs: 100 })
    const controller = new AbortController()
    let outcome: unknown
    void dependencies.waitForCapture({
      targetSessionId: 'target-session',
      cwd: '/workspace',
      handle: {
        id: id('target-session'),
        session: targetSession,
        inject: () => {},
        steer: () => {},
      },
    }, 'retry-operation', ['source-a', 'source-b'], controller.signal)
      .then(value => { outcome = { value } }, error => { outcome = { error } })

    projection = {
      operationId: 'previous-operation',
      contextEventSeq: 8,
      sources: [
        { sessionId: 'source-a', capturedThroughSeq: 3 },
        { sessionId: 'source-b', capturedThroughSeq: 4 },
      ],
    }
    notifyProjection?.(targetSession, 'sessionGraphMerge', projection)
    await new Promise(resolve => setImmediate(resolve))

    try {
      expect(outcome).toEqual({ value: projection })
    } finally {
      controller.abort()
    }
  })
})
