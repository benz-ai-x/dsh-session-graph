import { describe, expect, it } from 'vitest'
import {
  createSessionMergeHostModule,
  type SessionMergeHostDependencies,
} from '../src/session-merge-host.ts'

function dependencies(calls: string[]): SessionMergeHostDependencies {
  return {
    resolveTarget: async targetSessionId => ({
      targetSessionId,
      cwd: '/workspace',
      handle: { targetSessionId },
    }),
    currentCapture: () => null,
    resolveSource: async (_target, sourceId) => ({
      sessionId: sourceId,
      cwd: '/workspace',
      mention: `@[${sourceId}](dsh-session:${sourceId})`,
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
    persist: async target => {
      calls.push(`persist:${target.targetSessionId}`)
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
      'persist:target-session',
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

  it('rejects a canonical source outside the target working directory', async () => {
    let enqueued = false
    const merges = createSessionMergeHostModule({
      ...dependencies([]),
      resolveSource: async (_target, sourceId) => ({
        sessionId: sourceId,
        cwd: sourceId === 'source-a' ? '/workspace' : '/other-workspace',
        mention: `@[${sourceId}](dsh-session:${sourceId})`,
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

  it('rejects a resolver result whose identity does not exactly match the request', async () => {
    const merges = createSessionMergeHostModule({
      ...dependencies([]),
      resolveSource: async (_target, sourceId) => ({
        sessionId: `${sourceId}-lookalike`,
        cwd: '/workspace',
        mention: `@[lookalike](dsh-session:${sourceId}-lookalike)`,
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
      persist: async () => {
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
    expect(calls).toContain('persist:target-session')
  })

  it('reports durability-barrier failure instead of claiming success', async () => {
    const merges = createSessionMergeHostModule({
      ...dependencies([]),
      persist: async () => {
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
    expect(calls).toEqual(['persist:target-session'])
  })
})
