import { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply } from '../src/index.ts'

const id = (value: string): SessionId => value as SessionId

describe('Session Digest Host integration', () => {
  const contexts: Context[] = []

  afterEach(async () => {
    for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  })

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
})
