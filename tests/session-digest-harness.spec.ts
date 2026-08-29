import { describe, expect, it } from 'vitest'
import {
  sessionDigestInspectionFromHarness,
  type SessionDigestRouteFallback,
} from '../src/session-digest-harness.ts'

describe('Session Digest Harness source adapter', () => {
  it('folds title, running state, and the latest logged model route from the addressed Session', () => {
    const result = sessionDigestInspectionFromHarness({
      meta: { id: 'selected-session' },
      events: [
        { type: 'session/title', seq: 0, time: 1, data: { title: 'Earlier title' } },
        {
          type: 'request/header', seq: 1, time: 2,
          data: { header: { config: { provider: 'old-provider', model: 'old-model' } } },
        },
        { type: 'session/title', seq: 2, time: 3, data: { title: 'Selected title' } },
        { type: 'turn/start', seq: 3, time: 4, data: { turn: 2 } },
        {
          type: 'request/context', seq: 4, time: 5,
          data: { provider: 'selected-provider', model: 'selected-model' },
        },
      ],
    })

    expect(result).toMatchObject({
      title: 'Selected title',
      running: true,
      modelRoute: { provider: 'selected-provider', model: 'selected-model' },
    })
    expect(result.events).toHaveLength(5)
  })

  it('uses the configured route only when the Session has no logged route', () => {
    const fallback: SessionDigestRouteFallback = {
      provider: 'fallback-provider',
      model: 'fallback-model',
    }
    const result = sessionDigestInspectionFromHarness({
      meta: { id: 'unrouted-session' },
      events: [
        { type: 'turn/start', seq: 0, time: 1, data: { turn: 1 } },
        { type: 'turn/end', seq: 1, time: 2, data: { turn: 1 } },
      ],
    }, fallback)

    expect(result).toMatchObject({
      title: 'unrouted-session',
      running: false,
      modelRoute: fallback,
    })
  })
})
