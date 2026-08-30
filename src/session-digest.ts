/** Host-side Session Digest domain interface and orchestration. */

/** Structurally readable Session event used by the digest module. */
export interface SessionDigestEvent {
  readonly type: string
  readonly seq: number
  readonly time: number
  readonly data: unknown
}

/** Exact provider route reconstructed from the addressed Session log. */
export interface SessionDigestModelRoute {
  readonly provider: string
  readonly model: string
}

/** Immutable source observed for one addressed Session. */
export interface SessionDigestInspection {
  readonly title: string
  readonly running: boolean
  readonly modelRoute?: SessionDigestModelRoute
  readonly events: readonly SessionDigestEvent[]
}

/** Explicit user request to generate or refresh one Session Digest. */
export interface SessionDigestRequest {
  readonly sessionId: string
  readonly refresh: boolean
}

/** Model input owned by the Session Digest module. */
export interface SessionDigestModelRequest {
  readonly sessionId: string
  readonly title: string
  readonly modelRoute?: SessionDigestModelRoute
  readonly source: string
}

/** Successful digest payload. */
export interface SessionDigest {
  readonly sessionId: string
  readonly sourceRevision: string
  readonly sourceTurnCount: number
  readonly generatedAt: number
  readonly generatedWhileRunning: boolean
  readonly overview: string
  readonly keyOutcomes: readonly string[]
  readonly openItems: readonly string[]
}

/** Every non-transport outcome exposed by the Host interface. */
export type SessionDigestResult =
  | { readonly kind: 'empty' }
  | { readonly kind: 'ready'; readonly digest: SessionDigest; readonly cached: boolean }

/** Stable failure categories consumed by the browser UI. */
export type SessionDigestErrorCode =
  | 'disposed'
  | 'invalid-model-output'
  | 'model-route-unavailable'
  | 'generation-failed'

/** Domain error whose code is safe to transport across the Remote boundary. */
export class SessionDigestError extends Error {
  readonly code: SessionDigestErrorCode

  constructor(code: SessionDigestErrorCode, message: string) {
    super(message)
    this.name = 'SessionDigestError'
    this.code = code
  }
}

/** System-boundary adapters accepted by the deep digest module. */
export interface SessionDigestDependencies {
  readonly inspect: (
    sessionId: string,
    signal: AbortSignal,
  ) => Promise<SessionDigestInspection>
  readonly generate: (
    request: SessionDigestModelRequest,
    signal: AbortSignal,
  ) => Promise<string>
  readonly now: () => number
}

/** Public Host seam exercised by Remote and tests alike. */
export interface SessionDigestModule {
  generate(request: SessionDigestRequest, signal: AbortSignal): Promise<SessionDigestResult>
  dispose(): Promise<void>
}

interface DigestShape {
  readonly overview: string
  readonly keyOutcomes: readonly string[]
  readonly openItems: readonly string[]
}

interface InflightDigest {
  readonly controller: AbortController
  readonly promise: Promise<SessionDigestResult>
  waiters: number
  settled: boolean
}

const MAX_SOURCE_BYTES = 32_768
const MAX_PRIORITY_SEGMENT_BYTES = 4_096
const SOURCE_SEPARATOR = '\n\n'

function recordOf(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined
}

function textBlocks(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value
    .flatMap((block) => {
      const candidate = recordOf(block)
      return candidate?.type === 'text' && typeof candidate.text === 'string'
        ? [candidate.text.trim()]
        : []
    })
    .filter(text => text !== '')
    .join('\n')
}

function messageText(event: SessionDigestEvent): { readonly role: 'user' | 'assistant'; readonly text: string } | undefined {
  const data = recordOf(event.data)
  if (event.type === 'user/message') {
    const source = recordOf(data?.source)
    if (source?.kind !== 'user') return undefined
    const text = textBlocks(data?.content)
    return text === '' ? undefined : { role: 'user', text }
  }
  if (event.type !== 'assistant/message') return undefined
  const message = recordOf(data?.message)
  const text = textBlocks(message?.content)
  return text === '' ? undefined : { role: 'assistant', text }
}

function utf8Prefix(value: string, maxBytes: number): string {
  if (maxBytes <= 0) return ''
  if (Buffer.byteLength(value, 'utf8') <= maxBytes) return value
  const characters: string[] = []
  let bytes = 0
  for (const character of value) {
    const next = Buffer.byteLength(character, 'utf8')
    if (bytes + next > maxBytes) break
    characters.push(character)
    bytes += next
  }
  return characters.join('')
}

function prioritySegment(label: string, value: string): string {
  return `${label}: ${utf8Prefix(value, MAX_PRIORITY_SEGMENT_BYTES)}`
}

function latestCheckpoint(events: readonly SessionDigestEvent[]): string | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event?.type !== 'compaction/summary') continue
    const summary = textBlocks(recordOf(event.data)?.summary)
    if (summary !== '') return summary
  }
  return undefined
}

function digestSource(inspection: SessionDigestInspection): string {
  const messages = inspection.events.flatMap((event) => {
    const message = messageText(event)
    return message === undefined ? [] : [{ event, message }]
  })
  if (messages.length === 0) return ''
  const firstUser = messages.find(entry => entry.message.role === 'user')
  const checkpoint = latestCheckpoint(inspection.events)
  const priority = [prioritySegment('TITLE', inspection.title)]
  if (firstUser !== undefined) priority.push(prioritySegment('INITIAL USER', firstUser.message.text))
  if (checkpoint !== undefined) priority.push(prioritySegment('LATEST CHECKPOINT', checkpoint))

  const recent: string[] = []
  let used = Buffer.byteLength(priority.join(SOURCE_SEPARATOR), 'utf8')
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const entry = messages[index]
    if (entry === undefined || entry === firstUser) continue
    const prefix = `${entry.message.role.toUpperCase()}: `
    const separatorBytes = Buffer.byteLength(SOURCE_SEPARATOR, 'utf8')
    const available = MAX_SOURCE_BYTES - used - separatorBytes - Buffer.byteLength(prefix, 'utf8')
    if (available <= 0) break
    const text = utf8Prefix(entry.message.text, available)
    if (text === '') continue
    recent.unshift(`${prefix}${text}`)
    used += separatorBytes + Buffer.byteLength(prefix + text, 'utf8')
  }
  return [...priority, ...recent].join(SOURCE_SEPARATOR)
}

function stringList(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new SessionDigestError(
      'invalid-model-output',
      `Session Digest model output has invalid ${field}`,
    )
  }
  return value.map(item => item.trim()).filter(item => item !== '')
}

function digestShape(output: string): DigestShape {
  let value: unknown
  try {
    value = JSON.parse(output)
  } catch {
    throw new SessionDigestError(
      'invalid-model-output',
      'Session Digest model output is not valid JSON',
    )
  }
  const record = recordOf(value)
  if (record === undefined || typeof record.overview !== 'string' || record.overview.trim() === '') {
    throw new SessionDigestError(
      'invalid-model-output',
      'Session Digest model output has invalid overview',
    )
  }
  return {
    overview: record.overview.trim(),
    keyOutcomes: stringList(record.keyOutcomes, 'keyOutcomes'),
    openItems: stringList(record.openItems, 'openItems'),
  }
}

async function waitForDigest(
  active: InflightDigest,
  signal: AbortSignal,
): Promise<SessionDigestResult> {
  signal.throwIfAborted()
  active.waiters += 1
  return await new Promise<SessionDigestResult>((resolve, reject) => {
    let waiting = true
    const release = (): void => {
      if (!waiting) return
      waiting = false
      signal.removeEventListener('abort', onAbort)
      active.waiters -= 1
      if (active.waiters === 0 && !active.settled) {
        active.controller.abort(signal.reason)
      }
    }
    const onAbort = (): void => {
      release()
      reject(signal.reason)
    }
    signal.addEventListener('abort', onAbort, { once: true })
    // Abort may race between the initial check and listener registration.
    if (signal.aborted) onAbort()
    void active.promise.then(
      (result) => {
        release()
        resolve(result)
      },
      (error: unknown) => {
        release()
        reject(error)
      },
    )
  })
}

/**
 * Create the Host-side Session Digest module.
 * @param dependencies - persistence, model, and clock system boundaries.
 * @returns one session-addressed digest interface.
 */
export function createSessionDigestModule(
  dependencies: SessionDigestDependencies,
): SessionDigestModule {
  const cache = new Map<string, SessionDigest>()
  const inflight = new Map<string, InflightDigest>()
  const activeCalls = new Set<Promise<SessionDigestResult>>()
  const ownedOperations = new Set<Promise<SessionDigestResult>>()
  const lifecycle = new AbortController()
  let disposed = false
  let disposal: Promise<void> | undefined

  const disposedError = (): SessionDigestError => new SessionDigestError(
    'disposed',
    'Session Digest module is disposed',
  )

  const generate = async (
    request: SessionDigestRequest,
    signal: AbortSignal,
  ): Promise<SessionDigestResult> => {
    signal.throwIfAborted()
    const inspection = await dependencies.inspect(request.sessionId, signal)
    signal.throwIfAborted()
    const sourceRevision = String(inspection.events.at(-1)?.seq ?? -1)
    const cached = cache.get(request.sessionId)
    if (!request.refresh && cached?.sourceRevision === sourceRevision) {
      return { kind: 'ready', digest: cached, cached: true }
    }
    const source = digestSource(inspection)
    if (source === '') return { kind: 'empty' }
    const inflightKey = `${request.sessionId}\0${sourceRevision}`
    const active = inflight.get(inflightKey)
    if (active !== undefined && !active.controller.signal.aborted) {
      return await waitForDigest(active, signal)
    }
    const controller = new AbortController()
    let created: InflightDigest
    const operation = (async (): Promise<SessionDigestResult> => {
      const output = await dependencies.generate({
        sessionId: request.sessionId,
        title: inspection.title,
        ...inspection.modelRoute === undefined ? {} : { modelRoute: inspection.modelRoute },
        source,
      }, controller.signal)
      controller.signal.throwIfAborted()
      const shape = digestShape(output)
      const digest: SessionDigest = {
        sessionId: request.sessionId,
        sourceRevision,
        sourceTurnCount: inspection.events.filter(event => event.type === 'turn/end').length,
        generatedAt: dependencies.now(),
        generatedWhileRunning: inspection.running,
        ...shape,
      }
      cache.set(request.sessionId, digest)
      return { kind: 'ready', cached: false, digest }
    })().finally(() => {
      created.settled = true
      ownedOperations.delete(created.promise)
      if (inflight.get(inflightKey) === created) inflight.delete(inflightKey)
    })
    created = {
      controller,
      promise: operation,
      waiters: 0,
      settled: false,
    }
    inflight.set(inflightKey, created)
    ownedOperations.add(operation)
    return await waitForDigest(created, signal)
  }

  return {
    generate(request, callerSignal) {
      if (disposed) return Promise.reject(disposedError())
      const signal = AbortSignal.any([callerSignal, lifecycle.signal])
      const call = generate(request, signal)
      activeCalls.add(call)
      void call.then(
        () => { activeCalls.delete(call) },
        () => { activeCalls.delete(call) },
      )
      return call
    },
    dispose() {
      if (disposal !== undefined) return disposal
      disposed = true
      const error = disposedError()
      lifecycle.abort(error)
      for (const active of inflight.values()) active.controller.abort(error)
      const admitted = [...activeCalls, ...ownedOperations]
      disposal = Promise.allSettled(admitted).then(() => {})
      return disposal
    },
  }
}
