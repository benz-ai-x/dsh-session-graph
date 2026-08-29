/** Pure translation from Harness persistence records into Session Digest input. */

import type {
  SessionDigestEvent,
  SessionDigestInspection,
  SessionDigestModelRoute,
} from './session-digest.ts'

/** Optional deployment fallback when an old or blank Session has no logged route. */
export interface SessionDigestRouteFallback extends SessionDigestModelRoute {}

/** Minimal persistence shape used by the adapter without retaining mutable aliases. */
export interface HarnessSessionDigestSource {
  readonly meta: { readonly id: string }
  readonly events: readonly SessionDigestEvent[]
}

function recordOf(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined
}

function routeOf(value: unknown): SessionDigestModelRoute | undefined {
  const record = recordOf(value)
  return typeof record?.provider === 'string' && record.provider !== ''
    && typeof record.model === 'string' && record.model !== ''
    ? { provider: record.provider, model: record.model }
    : undefined
}

function loggedRoute(events: readonly SessionDigestEvent[]): SessionDigestModelRoute | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event?.type === 'request/context') {
      const route = routeOf(event.data)
      if (route !== undefined) return route
    }
    if (event?.type === 'request/header') {
      const data = recordOf(event.data)
      const header = recordOf(data?.header)
      const route = routeOf(recordOf(header?.config))
      if (route !== undefined) return route
    }
  }
  return undefined
}

function sessionTitle(source: HarnessSessionDigestSource): string {
  for (let index = source.events.length - 1; index >= 0; index -= 1) {
    const event = source.events[index]
    if (event?.type !== 'session/title') continue
    const title = recordOf(event.data)?.title
    if (typeof title === 'string' && title.trim() !== '') return title.trim()
  }
  return source.meta.id
}

function sessionRunning(events: readonly SessionDigestEvent[]): boolean {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const type = events[index]?.type
    if (type === 'turn/start') return true
    if (type === 'turn/end') return false
  }
  return false
}

/**
 * Fold one addressed immutable persistence snapshot into digest source facts.
 * Logged model routing always wins over the optional deployment fallback.
 */
export function sessionDigestInspectionFromHarness(
  source: HarnessSessionDigestSource,
  fallback?: SessionDigestRouteFallback,
): SessionDigestInspection {
  const modelRoute = loggedRoute(source.events) ?? fallback
  return {
    title: sessionTitle(source),
    running: sessionRunning(source.events),
    ...(modelRoute === undefined ? {} : { modelRoute: { ...modelRoute } }),
    events: [...source.events],
  }
}
