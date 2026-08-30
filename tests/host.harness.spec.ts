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
    await apply(ctx)
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
    await apply(ctx)
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

  it('aborts and joins Session Digest work before Host disposal completes', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    let releaseModel: (() => void) | undefined
    const modelBarrier = new Promise<void>((resolve) => { releaseModel = resolve })
    let modelSignal: AbortSignal | undefined
    ctx.provide('sessionPersistence', {
      inspect: async (sessionId: SessionId) => ({
        meta: { id: sessionId },
        events: [{
          type: 'user/message',
          seq: 0,
          time: 1,
          data: {
            source: { kind: 'user' },
            content: [{ type: 'text', text: 'Wait for plugin disposal.' }],
          },
        }],
      }),
    })
    ctx.provide('llm', {
      async *stream(options: Readonly<Record<string, unknown>>) {
        modelSignal = options.signal as AbortSignal
        await modelBarrier
        modelSignal.throwIfAborted()
      },
    })
    await apply(ctx, { provider: 'provider', model: 'model' })
    const service = ctx.get('sessionGraphDigest') as {
      generate: (
        request: { readonly sessionId: string; readonly refresh: boolean },
        signal: AbortSignal,
      ) => Promise<unknown>
    }
    const result = service.generate(
      { sessionId: 'dispose-session', refresh: false },
      new AbortController().signal,
    ).then(value => value, error => error)
    while (modelSignal === undefined) await Promise.resolve()

    let disposed = false
    const disposal = ctx.fiber.dispose().then(() => { disposed = true })
    await new Promise(resolve => setImmediate(resolve))
    const modelAbortedDuringDisposal = modelSignal.aborted
    const disposalSettledBeforeModel = disposed
    const disposalService = ctx.get('sessionGraphDigest') as typeof service | undefined
    const servicePublishedDuringDisposal = disposalService !== undefined
    const lateRequest = disposalService?.generate(
      { sessionId: 'late-session', refresh: false },
      new AbortController().signal,
    ).then(value => value, error => error) ?? Promise.resolve(undefined)

    releaseModel?.()
    await disposal
    expect(modelAbortedDuringDisposal).toBe(true)
    expect(disposalSettledBeforeModel).toBe(false)
    expect(servicePublishedDuringDisposal).toBe(true)
    expect(await lateRequest).toMatchObject({ failure: { code: 'disposed' } })
    expect(await result).toMatchObject({ failure: { code: 'disposed' } })
    expect(ctx.get('sessionGraphDigest')).toBeUndefined()
  })

  it('registers the durable Session Merge projection with the Harness registry', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    ctx.provide('sessionPersistence', { inspect: async () => ({ meta: {}, events: [] }) })
    ctx.provide('llm', { async *stream() {} })

    await apply(ctx)
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
    const targetSession = { header: { cwd: '/workspace' }, events: [] }
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
      inspect: async (sessionId: SessionId) => ({
        meta: { id: sessionId, cwd: '/workspace' },
        events: [{ type: 'turn/start', data: { turn: 1 } }],
      }),
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
    ctx.provide('workspaceRegistry', { archivedSessionIds: [] })

    await apply(ctx)
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

  it('aborts pre-commit Merge work and stays published until Host-owned commit settles', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    const capture = {
      operationId: 'operation-1',
      contextEventSeq: 8,
      sources: [
        { sessionId: 'source-a', capturedThroughSeq: 3 },
        { sessionId: 'source-b', capturedThroughSeq: 4 },
      ],
    }
    let projection: typeof capture | null = null
    const targetSession = { header: { cwd: '/workspace' }, events: [] }
    const waitingTargetSession = { header: { cwd: '/workspace' }, events: [] }
    const agent = {
      id: id('target-session'),
      session: targetSession,
      inject: () => {},
      steer: () => { projection = capture },
    }
    const waitingAgent = {
      id: id('waiting-target'),
      session: waitingTargetSession,
      inject: () => {},
      steer: () => {},
    }
    let startCaptureWait: (() => void) | undefined
    const captureWaitStarted = new Promise<void>((resolve) => { startCaptureWait = resolve })
    let captureListenerDisposed = false
    let startCommit: (() => void) | undefined
    const commitStarted = new Promise<void>((resolve) => { startCommit = resolve })
    let releaseCommit: (() => void) | undefined
    const commitBarrier = new Promise<void>((resolve) => { releaseCommit = resolve })
    ctx.provide('sessionPersistence', { inspect: async () => ({ meta: {}, events: [] }) })
    ctx.provide('llm', { async *stream() {} })
    ctx.provide('sessionController', {
      resolveAgent: async (sessionId: SessionId) => ({
        agent: sessionId === id('waiting-target') ? waitingAgent : agent,
      }),
      inspect: async (sessionId: SessionId) => ({
        meta: { id: sessionId, cwd: '/workspace' },
        events: [{ type: 'turn/start', data: { turn: 1 } }],
      }),
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
      stateOf: (session: unknown) => session !== targetSession || projection === null
        ? { inStep: false, marker: null, value: null }
        : { inStep: true, marker: null, value: projection },
      onChanged: () => {
        startCaptureWait?.()
        return () => { captureListenerDisposed = true }
      },
    })
    ctx.provide('sessionProjectionCache', {
      write: async () => {
        startCommit?.()
        await commitBarrier
      },
    })
    ctx.provide('workspaceRegistry', { archivedSessionIds: [] })

    await apply(ctx)
    await new Promise(resolve => setImmediate(resolve))
    const service = ctx.get('sessionGraphMerge') as {
      submit: (request: Readonly<Record<string, unknown>>, signal: AbortSignal) => Promise<unknown>
    }
    const request = {
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-b'],
      instruction: 'Compare conclusions.',
      operationId: 'operation-1',
    }
    const waitingController = new AbortController()
    let waitingSettled = false
    let waitingOutcome: unknown
    const waitingResult = service.submit({
      ...request,
      targetSessionId: 'waiting-target',
      operationId: 'waiting-operation',
    }, waitingController.signal).then(
      value => {
        waitingSettled = true
        waitingOutcome = value
      },
      error => {
        waitingSettled = true
        waitingOutcome = error
      },
    )
    await captureWaitStarted
    const result = service.submit(request, new AbortController().signal)
    await commitStarted

    let disposed = false
    const disposal = ctx.fiber.dispose().then(() => { disposed = true })
    await new Promise(resolve => setImmediate(resolve))
    const disposalSettledBeforeCommit = disposed
    const preCommitAbortedDuringDisposal = waitingSettled
    const captureListenerRemovedDuringDisposal = captureListenerDisposed
    const disposalService = ctx.get('sessionGraphMerge') as typeof service | undefined
    const servicePublishedDuringCommit = disposalService !== undefined
    const lateRequest = disposalService?.submit({ ...request, operationId: 'late-operation' },
      new AbortController().signal).then(value => value, error => error)
      ?? Promise.resolve(undefined)

    waitingController.abort(new Error('test cleanup'))
    releaseCommit?.()
    await expect(result).resolves.toEqual(capture)
    await waitingResult
    await disposal
    expect(disposalSettledBeforeCommit).toBe(false)
    expect(preCommitAbortedDuringDisposal).toBe(true)
    expect(captureListenerRemovedDuringDisposal).toBe(true)
    expect(servicePublishedDuringCommit).toBe(true)
    expect(waitingOutcome).toMatchObject({ failure: { code: 'disposed' } })
    expect(await lateRequest).toMatchObject({ failure: { code: 'disposed' } })
    expect(ctx.get('sessionGraphMerge')).toBeUndefined()
  })

  it('derives source qualification from Host Session and Workspace truth', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    ctx.provide('sessionController', {
      resolveAgent: async () => ({ error: { message: 'unused' } }),
      inspect: async (sessionId: SessionId) => ({
        meta: {
          id: sessionId,
          cwd: '/workspace',
          origin: 'subagent' as const,
        },
        events: [],
      }),
    })
    ctx.provide('sessionReferenceResolver', {
      remoteExportCandidates: async (_agent: unknown, query: string) => [{
        sessionId: id(query),
        cwd: '/workspace',
        mention: `@[${query}](dsh-session:${query})`,
      }],
    })
    ctx.provide('workspaceRegistry', { archivedSessionIds: [id('source-a')] })
    const dependencies = sessionMergeDependenciesFromHarness(ctx)

    const source = await dependencies.resolveSource({
      targetSessionId: 'target-session',
      cwd: '/workspace',
      archived: false,
      events: [],
      handle: {
        id: id('target-session'),
        session: { header: { cwd: '/workspace' }, events: [] },
        inject: () => {},
        steer: () => {},
      },
    }, 'source-a', new AbortController().signal)

    expect(source).toEqual({
      sessionId: 'source-a',
      cwd: '/workspace',
      mention: '@[source-a](dsh-session:source-a)',
      origin: 'subagent',
      archived: true,
      blank: true,
    })
  })

  it('derives target lineage qualification from the Host Session header', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    const targetSession = {
      header: {
        cwd: '/workspace',
        parentSession: id('parent-session'),
      },
      events: [{ type: 'turn/start', data: { turn: 1 } }],
    }
    const agent = {
      id: id('target-session'),
      session: targetSession,
      inject: () => {},
      steer: () => {},
    }
    ctx.provide('sessionController', {
      resolveAgent: async () => ({ agent }),
    })
    ctx.provide('workspaceRegistry', { archivedSessionIds: [] })
    const dependencies = sessionMergeDependenciesFromHarness(ctx)

    const target = await dependencies.resolveTarget(
      'target-session',
      new AbortController().signal,
    )

    expect(target).toMatchObject({
      targetSessionId: 'target-session',
      cwd: '/workspace',
      parentSessionId: 'parent-session',
      archived: false,
      events: targetSession.events,
    })
    expect(target.handle).toBe(agent)
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
      archived: false,
      events: [],
      handle: {
        id: id('target-session'),
        session: { header: { cwd: '/workspace' }, events: [] },
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
      archived: false,
      events: [],
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
