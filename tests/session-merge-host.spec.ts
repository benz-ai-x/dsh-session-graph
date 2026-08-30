import { describe, expect, it } from 'vitest'
import {
  createSessionMergeHostModule,
  type SessionMergeHostDependencies,
  type SessionMergeHostTarget,
} from '../src/session-merge-host.ts'

function dependencies(calls: string[]): SessionMergeHostDependencies {
  return {
    resolveTarget: async targetSessionId => ({
      targetSessionId,
      cwd: '/workspace',
      archived: false,
      events: [],
      handle: { targetSessionId },
    }),
    currentCapture: () => null,
    resolveSource: async (_target, sourceId) => ({
      sessionId: sourceId,
      cwd: '/workspace',
      mention: `@[${sourceId}](dsh-session:${sourceId})`,
      archived: false,
      blank: false,
    }),
    enqueue: (_target, input) => {
      calls.push(`enqueue:${JSON.stringify(input)}`)
    },
    waitForCapture: async (_target, operationId, sourceIds) => {
      calls.push(`capture:${operationId}`)
      return {
        operationId,
        contextEventSeq: 8,
        sources: sourceIds.map((sessionId, index) => ({
          sessionId,
          capturedThroughSeq: index + 3,
        })),
      }
    },
    commitCapture: async target => {
      calls.push(`commit:${target.targetSessionId}`)
    },
  }
}

describe('Session Merge Host submit', () => {
  it('queues one explicit marker and canonical-reference prompt before persisting capture', async () => {
    const calls: string[] = []
    const merges = createSessionMergeHostModule(dependencies(calls))

    const result = await merges.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-b'],
      instruction: 'Compare conclusions and preserve disagreements.',
      operationId: 'operation-1',
    }, new AbortController().signal)

    expect(result).toEqual({
      operationId: 'operation-1',
      contextEventSeq: 8,
      sources: [
        { sessionId: 'source-a', capturedThroughSeq: 3 },
        { sessionId: 'source-b', capturedThroughSeq: 4 },
      ],
    })
    expect(calls).toEqual([
      'enqueue:{"marker":{"kind":"session-graph-merge","version":1,"operationId":"operation-1","sourceIds":["source-a","source-b"]},"directText":"Compare conclusions and preserve disagreements.\\n\\n@[source-a](dsh-session:source-a)\\n@[source-b](dsh-session:source-b)"}',
      'capture:operation-1',
      'commit:target-session',
    ])
  })

  it('rejects an invalid source count before resolving the target', async () => {
    let targetResolved = false
    const base = dependencies([])
    const merges = createSessionMergeHostModule({
      ...base,
      resolveTarget: async (targetSessionId, signal) => {
        targetResolved = true
        return await base.resolveTarget(targetSessionId, signal)
      },
    })

    const result = merges.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-a'],
      instruction: 'Compare conclusions.',
      operationId: 'operation-1',
    }, new AbortController().signal)

    await expect(result).rejects.toMatchObject({
      code: 'invalid-source-count',
      stage: 'resolving',
    })
    expect(targetResolved).toBe(false)
  })

  it('rejects duplicate source identities before resolving the target', async () => {
    let targetResolved = false
    const base = dependencies([])
    const merges = createSessionMergeHostModule({
      ...base,
      resolveTarget: async (targetSessionId, signal) => {
        targetResolved = true
        return await base.resolveTarget(targetSessionId, signal)
      },
    })

    const result = merges.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-a'],
      instruction: 'Compare conclusions.',
      operationId: 'operation-1',
    }, new AbortController().signal)

    await expect(result).rejects.toMatchObject({ code: 'duplicate-source' })
    expect(targetResolved).toBe(false)
  })

  it('rejects an established non-Merge Session as a Merge target', async () => {
    let sourceResolved = false
    const base = dependencies([])
    const merges = createSessionMergeHostModule({
      ...base,
      resolveTarget: async (targetSessionId, signal) => ({
        ...await base.resolveTarget(targetSessionId, signal),
        archived: false,
        events: [{ type: 'turn/start', data: { turn: 1 } }],
      }) as SessionMergeHostTarget & {
        readonly archived: boolean
        readonly events: readonly { readonly type: string; readonly data: unknown }[]
      },
      resolveSource: async (target, sourceId, signal) => {
        sourceResolved = true
        return await base.resolveSource(target, sourceId, signal)
      },
    })

    const result = merges.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-b'],
      instruction: 'Compare conclusions.',
      operationId: 'operation-1',
    }, new AbortController().signal)

    await expect(result).rejects.toMatchObject({
      code: 'invalid-target',
      stage: 'resolving',
    })
    expect(sourceResolved).toBe(false)
  })

  it('rejects a Session with a parent as an independent Merge target', async () => {
    const base = dependencies([])
    const merges = createSessionMergeHostModule({
      ...base,
      resolveTarget: async (targetSessionId, signal) => ({
        ...await base.resolveTarget(targetSessionId, signal),
        parentSessionId: 'parent-session',
      }),
    })

    await expect(merges.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-b'],
      instruction: 'Compare conclusions.',
      operationId: 'operation-1',
    }, new AbortController().signal)).rejects.toMatchObject({
      code: 'invalid-target',
      stage: 'resolving',
    })
  })

  it('allows a failed Merge target to retry only with its originally bound sources', async () => {
    const calls: string[] = []
    const base = dependencies(calls)
    const merges = createSessionMergeHostModule({
      ...base,
      resolveTarget: async (targetSessionId, signal) => ({
        ...await base.resolveTarget(targetSessionId, signal),
        events: [
          {
            type: 'user/message',
            data: {
              source: {
                kind: 'session-graph-merge',
                version: 1,
                operationId: 'previous-operation',
                sourceIds: ['source-a', 'source-b'],
              },
            },
          },
        ],
      }),
    })

    await merges.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-b'],
      instruction: 'Compare conclusions.',
      operationId: 'retry-operation',
    }, new AbortController().signal)

    expect(calls[0]).toContain('enqueue:')
  })

  it('rejects retrying a bound Merge target with a different ordered source set', async () => {
    const base = dependencies([])
    const merges = createSessionMergeHostModule({
      ...base,
      resolveTarget: async (targetSessionId, signal) => ({
        ...await base.resolveTarget(targetSessionId, signal),
        events: [
          {
            type: 'user/message',
            data: {
              source: {
                kind: 'session-graph-merge',
                version: 1,
                operationId: 'previous-operation',
                sourceIds: ['source-a', 'source-b'],
              },
            },
          },
        ],
      }),
    })

    await expect(merges.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-b', 'source-a'],
      instruction: 'Compare conclusions.',
      operationId: 'retry-operation',
    }, new AbortController().signal)).rejects.toMatchObject({
      code: 'invalid-target',
      stage: 'resolving',
    })
  })

  it.each([
    { label: 'subagent', facts: { origin: 'subagent' as const, archived: false } },
    { label: 'archived', facts: { archived: true } },
  ])('rejects a $label Session as a Merge target', async ({ facts }) => {
    const base = dependencies([])
    const merges = createSessionMergeHostModule({
      ...base,
      resolveTarget: async (targetSessionId, signal) => ({
        ...await base.resolveTarget(targetSessionId, signal),
        ...facts,
      }),
    })

    await expect(merges.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-b'],
      instruction: 'Compare conclusions.',
      operationId: 'operation-1',
    }, new AbortController().signal)).rejects.toMatchObject({ code: 'invalid-target' })
  })

  it('rejects a canonical source outside the target working directory', async () => {
    let enqueued = false
    const merges = createSessionMergeHostModule({
      ...dependencies([]),
      resolveSource: async (_target, sourceId) => ({
        sessionId: sourceId,
        cwd: sourceId === 'source-a' ? '/workspace' : '/other-workspace',
        mention: `@[${sourceId}](dsh-session:${sourceId})`,
        archived: false,
        blank: false,
      }),
      enqueue: () => {
        enqueued = true
      },
    })

    const result = merges.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-b'],
      instruction: 'Compare conclusions.',
      operationId: 'operation-1',
    }, new AbortController().signal)

    await expect(result).rejects.toMatchObject({
      code: 'cross-workspace-source',
      stage: 'resolving',
    })
    expect(enqueued).toBe(false)
  })

  it('rejects a subagent source at the authoritative Host boundary', async () => {
    let enqueued = false
    const merges = createSessionMergeHostModule({
      ...dependencies([]),
      resolveSource: async (_target, sourceId) => ({
        sessionId: sourceId,
        cwd: '/workspace',
        mention: `@[${sourceId}](dsh-session:${sourceId})`,
        ...(sourceId === 'source-b' ? { origin: 'subagent' as const } : {}),
        archived: false,
        blank: false,
      }),
      enqueue: () => {
        enqueued = true
      },
    })

    const result = merges.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-b'],
      instruction: 'Compare conclusions.',
      operationId: 'operation-1',
    }, new AbortController().signal)

    await expect(result).rejects.toMatchObject({
      code: 'invalid-source',
      stage: 'resolving',
    })
    expect(enqueued).toBe(false)
  })

  it.each([
    { label: 'blank', facts: { blank: true, archived: false } },
    { label: 'archived', facts: { blank: false, archived: true } },
  ])('rejects a $label source at the authoritative Host boundary', async ({ facts }) => {
    const merges = createSessionMergeHostModule({
      ...dependencies([]),
      resolveSource: async (_target, sourceId) => ({
        sessionId: sourceId,
        cwd: '/workspace',
        mention: `@[${sourceId}](dsh-session:${sourceId})`,
        ...facts,
      }),
    })

    await expect(merges.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-b'],
      instruction: 'Compare conclusions.',
      operationId: 'operation-1',
    }, new AbortController().signal)).rejects.toMatchObject({ code: 'invalid-source' })
  })

  it('rejects a resolver result whose identity does not exactly match the request', async () => {
    const merges = createSessionMergeHostModule({
      ...dependencies([]),
      resolveSource: async (_target, sourceId) => ({
        sessionId: `${sourceId}-lookalike`,
        cwd: '/workspace',
        mention: `@[lookalike](dsh-session:${sourceId}-lookalike)`,
        archived: false,
        blank: false,
      }),
    })

    const result = merges.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-b'],
      instruction: 'Compare conclusions.',
      operationId: 'operation-1',
    }, new AbortController().signal)

    await expect(result).rejects.toMatchObject({ code: 'source-resolution-mismatch' })
  })

  it('rejects a blank instruction before resolving the target', async () => {
    let targetResolved = false
    const base = dependencies([])
    const merges = createSessionMergeHostModule({
      ...base,
      resolveTarget: async (targetSessionId, signal) => {
        targetResolved = true
        return await base.resolveTarget(targetSessionId, signal)
      },
    })

    const result = merges.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-b'],
      instruction: '   ',
      operationId: 'operation-1',
    }, new AbortController().signal)

    await expect(result).rejects.toMatchObject({ code: 'invalid-instruction' })
    expect(targetResolved).toBe(false)
  })

  it('rejects Session reference URIs in instructions before resolving the target', async () => {
    let targetResolved = false
    const base = dependencies([])
    const merges = createSessionMergeHostModule({
      ...base,
      resolveTarget: async (targetSessionId, signal) => {
        targetResolved = true
        return await base.resolveTarget(targetSessionId, signal)
      },
    })

    const result = merges.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-b'],
      instruction: 'Compare with dsh-session:source-c as well.',
      operationId: 'operation-1',
    }, new AbortController().signal)

    await expect(result).rejects.toMatchObject({
      code: 'invalid-instruction',
      stage: 'resolving',
    })
    expect(targetResolved).toBe(false)
  })

  it('rejects a blank operation identity before resolving the target', async () => {
    let targetResolved = false
    const base = dependencies([])
    const merges = createSessionMergeHostModule({
      ...base,
      resolveTarget: async (targetSessionId, signal) => {
        targetResolved = true
        return await base.resolveTarget(targetSessionId, signal)
      },
    })

    const result = merges.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-b'],
      instruction: 'Compare conclusions.',
      operationId: '   ',
    }, new AbortController().signal)

    await expect(result).rejects.toMatchObject({ code: 'invalid-operation' })
    expect(targetResolved).toBe(false)
  })

  it('rejects a mismatched capture and does not persist it as success', async () => {
    let persisted = false
    const merges = createSessionMergeHostModule({
      ...dependencies([]),
      waitForCapture: async () => ({
        operationId: 'operation-1',
        contextEventSeq: 8,
        sources: [
          { sessionId: 'source-a', capturedThroughSeq: 3 },
          { sessionId: 'source-c', capturedThroughSeq: 4 },
        ],
      }),
      commitCapture: async () => {
        persisted = true
      },
    })

    const result = merges.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-b'],
      instruction: 'Compare conclusions.',
      operationId: 'operation-1',
    }, new AbortController().signal)

    await expect(result).rejects.toMatchObject({
      code: 'capture-mismatch',
      stage: 'capturing',
    })
    expect(persisted).toBe(false)
  })

  it('accepts a late prior-operation capture with the exact requested sources', async () => {
    const calls: string[] = []
    const merges = createSessionMergeHostModule({
      ...dependencies(calls),
      waitForCapture: async () => ({
        operationId: 'operation-before-timeout',
        contextEventSeq: 8,
        sources: [
          { sessionId: 'source-a', capturedThroughSeq: 3 },
          { sessionId: 'source-b', capturedThroughSeq: 4 },
        ],
      }),
    })

    const result = await merges.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-b'],
      instruction: 'Compare conclusions.',
      operationId: 'retry-operation',
    }, new AbortController().signal)

    expect(result.operationId).toBe('operation-before-timeout')
    expect(calls).toContain('commit:target-session')
  })

  it('reports durability-barrier failure instead of claiming success', async () => {
    const merges = createSessionMergeHostModule({
      ...dependencies([]),
      commitCapture: async () => {
        throw new Error('projection cache write failed')
      },
    })

    const result = merges.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-b'],
      instruction: 'Compare conclusions.',
      operationId: 'operation-1',
    }, new AbortController().signal)

    await expect(result).rejects.toMatchObject({
      code: 'persistence-failed',
      stage: 'persisting',
      message: 'projection cache write failed',
    })
  })

  it('keeps commit ownership after caller cancellation reaches the durability barrier', async () => {
    let startCommit: (() => void) | undefined
    const commitStarted = new Promise<void>((resolve) => { startCommit = resolve })
    let failCommit: ((error: Error) => void) | undefined
    const merges = createSessionMergeHostModule({
      ...dependencies([]),
      commitCapture: async () => await new Promise<void>((_resolve, reject) => {
        failCommit = reject
        startCommit?.()
      }),
    })
    const controller = new AbortController()
    const result = merges.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-b'],
      instruction: 'Compare conclusions.',
      operationId: 'operation-1',
    }, controller.signal)
    await commitStarted

    controller.abort(new Error('caller disconnected after capture'))
    failCommit?.(new Error('projection cache write failed'))

    await expect(result).rejects.toMatchObject({
      code: 'persistence-failed',
      stage: 'persisting',
      message: 'projection cache write failed',
    })
  })

  it('reports synchronous inbox admission failure before waiting for capture', async () => {
    let waited = false
    const merges = createSessionMergeHostModule({
      ...dependencies([]),
      enqueue: () => {
        throw new Error('target inbox disposed')
      },
      waitForCapture: async (...args) => {
        waited = true
        return await dependencies([]).waitForCapture(...args)
      },
    })

    const result = merges.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-b'],
      instruction: 'Compare conclusions.',
      operationId: 'operation-1',
    }, new AbortController().signal)

    await expect(result).rejects.toMatchObject({
      code: 'queue-failed',
      stage: 'queueing',
      message: 'target inbox disposed',
    })
    expect(waited).toBe(false)
  })

  it('reports source capture failure after the messages were queued', async () => {
    const merges = createSessionMergeHostModule({
      ...dependencies([]),
      waitForCapture: async () => {
        throw new Error('reference budget exceeded')
      },
    })

    const result = merges.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-b'],
      instruction: 'Compare conclusions.',
      operationId: 'operation-1',
    }, new AbortController().signal)

    await expect(result).rejects.toMatchObject({
      code: 'capture-failed',
      stage: 'capturing',
      message: 'reference budget exceeded',
    })
  })

  it('reports canonical source resolution failure before touching the inbox', async () => {
    let enqueued = false
    const merges = createSessionMergeHostModule({
      ...dependencies([]),
      resolveSource: async () => {
        throw new Error('source is unavailable')
      },
      enqueue: () => {
        enqueued = true
      },
    })

    const result = merges.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-b'],
      instruction: 'Compare conclusions.',
      operationId: 'operation-1',
    }, new AbortController().signal)

    await expect(result).rejects.toMatchObject({
      code: 'source-resolution-failed',
      stage: 'resolving',
      message: 'source is unavailable',
    })
    expect(enqueued).toBe(false)
  })

  it('reports target resolution failure at the Host boundary', async () => {
    const merges = createSessionMergeHostModule({
      ...dependencies([]),
      resolveTarget: async () => {
        throw new Error('target session not found')
      },
    })

    const result = merges.submit({
      targetSessionId: 'missing-target',
      sourceIds: ['source-a', 'source-b'],
      instruction: 'Compare conclusions.',
      operationId: 'operation-1',
    }, new AbortController().signal)

    await expect(result).rejects.toMatchObject({
      code: 'target-resolution-failed',
      stage: 'resolving',
      message: 'target session not found',
    })
  })

  it('keeps caller ownership until an existing capture is validated', async () => {
    const base = dependencies([])
    let releaseTarget: (() => void) | undefined
    const targetBarrier = new Promise<void>((resolve) => { releaseTarget = resolve })
    let committed = false
    const merges = createSessionMergeHostModule({
      ...base,
      resolveTarget: async (targetSessionId, signal) => {
        await targetBarrier
        return await base.resolveTarget(targetSessionId, signal)
      },
      currentCapture: () => ({
        operationId: 'existing-operation',
        contextEventSeq: 8,
        sources: [
          { sessionId: 'source-a', capturedThroughSeq: 3 },
          { sessionId: 'source-b', capturedThroughSeq: 4 },
        ],
      }),
      commitCapture: async () => { committed = true },
    })
    const controller = new AbortController()
    const reason = new Error('caller left during target resolution')
    const result = merges.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-b'],
      instruction: 'Compare conclusions.',
      operationId: 'retry-operation',
    }, controller.signal)

    controller.abort(reason)
    releaseTarget?.()

    await expect(result).rejects.toBe(reason)
    expect(committed).toBe(false)
  })

  it('reuses an already captured Merge and only retries its durability barrier', async () => {
    const calls: string[] = []
    const base = dependencies(calls)
    const merges = createSessionMergeHostModule({
      ...base,
      currentCapture: () => ({
        operationId: 'operation-before-network-loss',
        contextEventSeq: 8,
        sources: [
          { sessionId: 'source-a', capturedThroughSeq: 3 },
          { sessionId: 'source-b', capturedThroughSeq: 4 },
        ],
      }),
    })

    const result = await merges.submit({
      targetSessionId: 'target-session',
      sourceIds: ['source-a', 'source-b'],
      instruction: 'Compare conclusions.',
      operationId: 'new-retry-operation',
    }, new AbortController().signal)

    expect(result.operationId).toBe('operation-before-network-loss')
    expect(calls).toEqual(['commit:target-session'])
  })
})
