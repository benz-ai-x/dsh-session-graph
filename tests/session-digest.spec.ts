import { describe, expect, it } from 'vitest'
import {
  createSessionDigestModule,
  SessionDigestError,
  type SessionDigestInspection,
} from '../src/session-digest.ts'

describe('Session Digest host interface', () => {
  it('returns empty without calling the model when the Session has no summarizable content', async () => {
    const inspection: SessionDigestInspection = {
      title: 'Blank Session',
      running: false,
      events: [],
    }
    let modelCalls = 0
    const digests = createSessionDigestModule({
      inspect: async () => inspection,
      generate: async () => {
        modelCalls += 1
        return '{"overview":"unused","keyOutcomes":[],"openItems":[]}'
      },
      now: () => 1_000,
    })

    const result = await digests.generate(
      { sessionId: 'blank', refresh: false },
      new AbortController().signal,
    )

    expect({ result, modelCalls }).toEqual({ result: { kind: 'empty' }, modelCalls: 0 })
  })

  it('generates a structured digest from the Session conversation', async () => {
    const inspection: SessionDigestInspection = {
      title: 'Choose a cache',
      running: false,
      modelRoute: { provider: 'selected-session-provider', model: 'selected-session-model' },
      events: [
        { type: 'turn/start', seq: 0, time: 10, data: { turn: 1 } },
        {
          type: 'user/message', seq: 1, time: 11,
          data: {
            role: 'user', source: { kind: 'user' },
            content: [{ type: 'text', text: 'Compare an in-memory cache with SQLite.' }],
          },
        },
        {
          type: 'assistant/message', seq: 2, time: 12,
          data: {
            turn: 1, step: 1,
            message: {
              role: 'assistant',
              content: [{ type: 'text', text: 'Use memory first and add durable storage later.' }],
            },
          },
        },
        { type: 'turn/end', seq: 3, time: 13, data: { turn: 1 } },
      ],
    }
    let modelSource = ''
    let modelRoute: unknown
    const digests = createSessionDigestModule({
      inspect: async () => inspection,
      generate: async (request) => {
        modelSource = request.source
        modelRoute = request.modelRoute
        return JSON.stringify({
          overview: 'The Session selected a staged cache strategy.',
          keyOutcomes: ['Use an in-memory cache in V1.'],
          openItems: ['Evaluate durable storage later.'],
        })
      },
      now: () => 20,
    })

    const result = await digests.generate(
      { sessionId: 'cache-session', refresh: false },
      new AbortController().signal,
    )

    expect(result).toEqual({
      kind: 'ready',
      cached: false,
      digest: {
        sessionId: 'cache-session',
        sourceRevision: '3',
        sourceTurnCount: 1,
        generatedAt: 20,
        generatedWhileRunning: false,
        overview: 'The Session selected a staged cache strategy.',
        keyOutcomes: ['Use an in-memory cache in V1.'],
        openItems: ['Evaluate durable storage later.'],
      },
    })
    expect(modelSource).toContain('Compare an in-memory cache with SQLite.')
    expect(modelSource).toContain('Use memory first and add durable storage later.')
    expect(modelRoute).toEqual({
      provider: 'selected-session-provider',
      model: 'selected-session-model',
    })
  })

  it('excludes injected context, reasoning, and raw tool results from model material', async () => {
    const inspection: SessionDigestInspection = {
      title: 'Safe source',
      running: false,
      events: [
        {
          type: 'user/message', seq: 0, time: 1,
          data: {
            source: { kind: 'plugin', plugin: 'agent-instructions' },
            content: [{ type: 'text', text: 'PRIVATE_INJECTED_CONTEXT' }],
          },
        },
        {
          type: 'user/message', seq: 1, time: 2,
          data: {
            source: { kind: 'user' },
            content: [{ type: 'text', text: 'Summarize the architecture decision.' }],
          },
        },
        {
          type: 'assistant/message', seq: 2, time: 3,
          data: {
            message: {
              content: [
                { type: 'reasoning', text: 'PRIVATE_REASONING' },
                { type: 'text', text: 'The final choice is an on-demand Host module.' },
              ],
            },
          },
        },
        {
          type: 'tool/result', seq: 3, time: 4,
          data: {
            message: { content: [{ type: 'text', text: 'PRIVATE_TOOL_OUTPUT' }] },
          },
        },
      ],
    }
    let modelSource = ''
    const digests = createSessionDigestModule({
      inspect: async () => inspection,
      generate: async (request) => {
        modelSource = request.source
        return '{"overview":"Safe","keyOutcomes":[],"openItems":[]}'
      },
      now: () => 10,
    })

    await digests.generate(
      { sessionId: 'safe', refresh: false },
      new AbortController().signal,
    )

    expect(modelSource).toContain('Summarize the architecture decision.')
    expect(modelSource).toContain('The final choice is an on-demand Host module.')
    expect(modelSource).not.toContain('PRIVATE_INJECTED_CONTEXT')
    expect(modelSource).not.toContain('PRIVATE_REASONING')
    expect(modelSource).not.toContain('PRIVATE_TOOL_OUTPUT')
  })

  it('bounds long model material while retaining the initial goal, latest checkpoint, and recent messages', async () => {
    const inspection: SessionDigestInspection = {
      title: 'Long Session',
      running: false,
      events: [
        {
          type: 'user/message', seq: 0, time: 1,
          data: {
            source: { kind: 'user' },
            content: [{ type: 'text', text: 'INITIAL_GOAL: design the digest feature.' }],
          },
        },
        {
          type: 'compaction/summary', seq: 1, time: 2,
          data: {
            summary: [{ type: 'text', text: 'LATEST_CHECKPOINT: host-side generation was chosen.' }],
          },
        },
        {
          type: 'user/message', seq: 2, time: 3,
          data: {
            source: { kind: 'user' },
            content: [{ type: 'text', text: `OLD_DETAIL:${'x'.repeat(40_000)}` }],
          },
        },
        {
          type: 'assistant/message', seq: 3, time: 4,
          data: {
            message: {
              content: [{ type: 'text', text: 'RECENT_DECISION: summaries stay outside the Session log.' }],
            },
          },
        },
      ],
    }
    let modelSource = ''
    const digests = createSessionDigestModule({
      inspect: async () => inspection,
      generate: async (request) => {
        modelSource = request.source
        return '{"overview":"Bounded","keyOutcomes":[],"openItems":[]}'
      },
      now: () => 10,
    })

    await digests.generate(
      { sessionId: 'long', refresh: false },
      new AbortController().signal,
    )

    expect(Buffer.byteLength(modelSource, 'utf8')).toBeLessThanOrEqual(32_768)
    expect(modelSource).toContain('INITIAL_GOAL')
    expect(modelSource).toContain('LATEST_CHECKPOINT')
    expect(modelSource).toContain('RECENT_DECISION')
  })

  it('reuses a generated digest while the Session source revision is unchanged', async () => {
    const inspection: SessionDigestInspection = {
      title: 'Cached Session',
      running: false,
      events: [{
        type: 'user/message', seq: 7, time: 1,
        data: {
          source: { kind: 'user' },
          content: [{ type: 'text', text: 'Keep this digest.' }],
        },
      }],
    }
    let modelCalls = 0
    const digests = createSessionDigestModule({
      inspect: async () => inspection,
      generate: async () => {
        modelCalls += 1
        return '{"overview":"Cached result","keyOutcomes":[],"openItems":[]}'
      },
      now: () => 100,
    })

    const first = await digests.generate(
      { sessionId: 'cached', refresh: false },
      new AbortController().signal,
    )
    const second = await digests.generate(
      { sessionId: 'cached', refresh: false },
      new AbortController().signal,
    )

    expect({ first, second, modelCalls }).toEqual({
      first: {
        kind: 'ready', cached: false,
        digest: {
          sessionId: 'cached', sourceRevision: '7', sourceTurnCount: 0,
          generatedAt: 100, generatedWhileRunning: false,
          overview: 'Cached result', keyOutcomes: [], openItems: [],
        },
      },
      second: {
        kind: 'ready', cached: true,
        digest: {
          sessionId: 'cached', sourceRevision: '7', sourceTurnCount: 0,
          generatedAt: 100, generatedWhileRunning: false,
          overview: 'Cached result', keyOutcomes: [], openItems: [],
        },
      },
      modelCalls: 1,
    })
  })

  it('single-flights concurrent requests for the same Session revision', async () => {
    const inspection: SessionDigestInspection = {
      title: 'Concurrent Session',
      running: true,
      events: [{
        type: 'user/message', seq: 4, time: 1,
        data: {
          source: { kind: 'user' },
          content: [{ type: 'text', text: 'Generate once.' }],
        },
      }],
    }
    let modelCalls = 0
    let releaseModel: (() => void) | undefined
    const modelBarrier = new Promise<void>((resolve) => { releaseModel = resolve })
    const digests = createSessionDigestModule({
      inspect: async () => inspection,
      generate: async () => {
        modelCalls += 1
        await modelBarrier
        return '{"overview":"One call","keyOutcomes":[],"openItems":[]}'
      },
      now: () => 200,
    })

    const first = digests.generate(
      { sessionId: 'concurrent', refresh: false },
      new AbortController().signal,
    )
    const second = digests.generate(
      { sessionId: 'concurrent', refresh: false },
      new AbortController().signal,
    )
    await Promise.resolve()
    await Promise.resolve()

    expect(modelCalls).toBe(1)
    releaseModel?.()
    const results = await Promise.all([first, second])
    expect(results.map(result => result.kind)).toEqual(['ready', 'ready'])
    expect(results[0]?.kind === 'ready' && results[0].digest.generatedWhileRunning).toBe(true)
  })

  it('reports invalid model output with a stable code and leaves the revision retryable', async () => {
    const inspection: SessionDigestInspection = {
      title: 'Retryable Session',
      running: false,
      events: [{
        type: 'user/message', seq: 9, time: 1,
        data: {
          source: { kind: 'user' },
          content: [{ type: 'text', text: 'Summarize me.' }],
        },
      }],
    }
    let modelCalls = 0
    const digests = createSessionDigestModule({
      inspect: async () => inspection,
      generate: async () => {
        modelCalls += 1
        return modelCalls === 1
          ? 'not JSON'
          : '{"overview":"Recovered","keyOutcomes":[],"openItems":[]}'
      },
      now: () => 300,
    })

    await expect(digests.generate(
      { sessionId: 'retryable', refresh: false },
      new AbortController().signal,
    )).rejects.toEqual(expect.objectContaining<Partial<SessionDigestError>>({
      name: 'SessionDigestError',
      code: 'invalid-model-output',
    }))

    const retry = await digests.generate(
      { sessionId: 'retryable', refresh: false },
      new AbortController().signal,
    )
    expect(retry.kind).toBe('ready')
    expect(modelCalls).toBe(2)
  })
})
