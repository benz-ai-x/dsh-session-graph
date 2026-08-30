/** Pure projection of one explicit Session Merge from durable Session events. */

/** Structurally readable Session event consumed by the projection. */
export interface SessionMergeProjectionEvent {
  readonly type: string
  readonly seq: number
  readonly data: unknown
}

/** One immutable source snapshot captured for a Merge Session. */
export interface SessionMergeProjectionSource {
  readonly sessionId: string
  readonly capturedThroughSeq: number | null
}

/** Client-visible Merge Relation facts for one target Session. */
export interface SessionMergeProjection {
  readonly operationId: string
  readonly contextEventSeq: number
  readonly sources: readonly SessionMergeProjectionSource[]
}

export interface SessionMergeMarker {
  readonly operationId: string
  readonly sourceIds: readonly string[]
}

/** Plain-JSON fold state persisted by the Harness Projection Cache. */
export interface SessionMergeProjectionState {
  readonly inStep: boolean
  readonly marker: SessionMergeMarker | null
  readonly value: SessionMergeProjection | null
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    sessionGraphMerge: SessionMergeProjectionState
  }
  interface SessionProjectionMap {
    /** Immutable provenance of an explicit Merge Session, or null until captured. */
    sessionGraphMerge: SessionMergeProjection | null
  }
}

function recordOf(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined
}

function hasOnlyKeys(record: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(record)
  return actual.length === keys.length && actual.every(key => keys.includes(key))
}

function validSessionId(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function validSequence(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function mergeMarkerFields(value: unknown): SessionMergeMarker | undefined {
  const marker = recordOf(value)
  if (marker === undefined
    || typeof marker.operationId !== 'string' || marker.operationId.trim() === ''
    || !Array.isArray(marker.sourceIds) || marker.sourceIds.length < 2
    || marker.sourceIds.length > 3 || marker.sourceIds.some(id => !validSessionId(id))
    || new Set(marker.sourceIds).size !== marker.sourceIds.length) return undefined
  return {
    operationId: marker.operationId,
    sourceIds: marker.sourceIds as string[],
  }
}

function parseMarker(value: unknown): SessionMergeMarker | null {
  if (value === null) return null
  const marker = recordOf(value)
  const parsed = mergeMarkerFields(marker)
  if (marker === undefined || !hasOnlyKeys(marker, ['operationId', 'sourceIds'])
    || parsed === undefined) {
    throw new Error('Invalid Session Merge projection state')
  }
  return parsed
}

function parseProjection(value: unknown): SessionMergeProjection | null {
  if (value === null) return null
  const projection = recordOf(value)
  if (projection === undefined
    || !hasOnlyKeys(projection, ['operationId', 'contextEventSeq', 'sources'])
    || typeof projection.operationId !== 'string' || projection.operationId.trim() === ''
    || !validSequence(projection.contextEventSeq) || !Array.isArray(projection.sources)
    || projection.sources.length < 2 || projection.sources.length > 3) {
    throw new Error('Invalid Session Merge projection value')
  }
  const sources: SessionMergeProjectionSource[] = []
  for (const value of projection.sources) {
    const source = recordOf(value)
    if (source === undefined || !hasOnlyKeys(source, ['sessionId', 'capturedThroughSeq'])
      || !validSessionId(source.sessionId)
      || !(source.capturedThroughSeq === null || validSequence(source.capturedThroughSeq))) {
      throw new Error('Invalid Session Merge projection value')
    }
    sources.push({
      sessionId: source.sessionId,
      capturedThroughSeq: source.capturedThroughSeq as number | null,
    })
  }
  if (new Set(sources.map(source => source.sessionId)).size !== sources.length) {
    throw new Error('Invalid Session Merge projection value')
  }
  return {
    operationId: projection.operationId,
    contextEventSeq: projection.contextEventSeq,
    sources,
  }
}

function parseProjectionState(value: unknown): SessionMergeProjectionState {
  const state = recordOf(value)
  if (state === undefined || !hasOnlyKeys(state, ['inStep', 'marker', 'value'])
    || typeof state.inStep !== 'boolean') {
    throw new Error('Invalid Session Merge projection state')
  }
  let marker: SessionMergeMarker | null
  let projection: SessionMergeProjection | null
  try {
    marker = parseMarker(state.marker)
    projection = parseProjection(state.value)
  } catch {
    throw new Error('Invalid Session Merge projection state')
  }
  if ((!state.inStep && marker !== null) || (projection !== null && marker !== null)) {
    throw new Error('Invalid Session Merge projection state')
  }
  return { inStep: state.inStep, marker, value: projection }
}

/** Decode the canonical Merge marker fields shared by replay and Host retry validation. */
export function sessionMergeMarkerOfEvent(
  event: Pick<SessionMergeProjectionEvent, 'type' | 'data'>,
): SessionMergeMarker | undefined {
  if (event.type !== 'user/message') return undefined
  const source = recordOf(recordOf(event.data)?.source)
  if (source?.kind !== 'session-graph-merge' || source.version !== 1) return undefined
  return mergeMarkerFields(source)
}

function referenceSources(
  event: SessionMergeProjectionEvent,
): readonly SessionMergeProjectionSource[] | undefined {
  if (event.type !== 'user/message') return undefined
  const source = recordOf(recordOf(event.data)?.source)
  if (source?.kind !== 'session-reference' || source.version !== 1
    || !Array.isArray(source.references)) return undefined
  const projected: Array<SessionMergeProjectionSource & { readonly inputIndex: number }> = []
  for (const value of source.references) {
    const reference = recordOf(value)
    if (reference === undefined || !validSessionId(reference.sessionId)
      || typeof reference.inputIndex !== 'number'
      || !(reference.capturedThroughSeq === null
        || (Number.isSafeInteger(reference.capturedThroughSeq)
          && (reference.capturedThroughSeq as number) >= 0))) return undefined
    projected.push({
      sessionId: reference.sessionId,
      capturedThroughSeq: reference.capturedThroughSeq as number | null,
      inputIndex: reference.inputIndex,
    })
  }
  if (new Set(projected.map(reference => reference.inputIndex)).size !== projected.length) {
    return undefined
  }
  const ordered = projected.sort((left, right) => left.inputIndex - right.inputIndex)
  if (ordered.some((reference, index) => reference.inputIndex !== index)) return undefined
  return ordered
    .map(({ sessionId, capturedThroughSeq }) => ({ sessionId, capturedThroughSeq }))
}

function applySessionMergeProjection(
  state: SessionMergeProjectionState,
  event: SessionMergeProjectionEvent,
): SessionMergeProjectionState {
  if (state.value !== null) return state
  if (event.type === 'step/start') {
    return { inStep: true, marker: null, value: null }
  }
  if (event.type === 'step/end') {
    return state.inStep || state.marker !== null
      ? { inStep: false, marker: null, value: null }
      : state
  }
  if (!state.inStep) return state
  const marker = sessionMergeMarkerOfEvent(event)
  if (marker !== undefined) return { ...state, marker }
  if (state.marker === null) return state
  const sources = referenceSources(event)
  if (sources === undefined
    || sources.length !== state.marker.sourceIds.length
    || sources.some((source, index) => source.sessionId !== state.marker?.sourceIds[index])) {
    return state
  }
  return {
    inStep: true,
    marker: null,
    value: {
      operationId: state.marker.operationId,
      contextEventSeq: event.seq,
      sources,
    },
  }
}

/** Harness-compatible incremental projection definition. */
export const SESSION_MERGE_PROJECTION_DEFINITION = {
  key: 'sessionGraphMerge' as const,
  stateVersion: 1,
  stateSchema: {
    parse: parseProjectionState,
  },
  init: (_header: unknown): SessionMergeProjectionState => ({
    inStep: false,
    marker: null,
    value: null,
  }),
  apply: applySessionMergeProjection,
  wire: {
    viewSchema: {
      parse: parseProjection,
    },
    view: (state: SessionMergeProjectionState): SessionMergeProjection | null => state.value,
  },
}

/**
 * Project the first explicit, successfully captured Merge Relation.
 * @param events - durable target Session events in sequence order.
 * @returns captured Merge facts, or null when no marker/reference pair completed.
 */
export function projectSessionMerge(
  events: readonly SessionMergeProjectionEvent[],
): SessionMergeProjection | null {
  const state = events.reduce(
    applySessionMergeProjection,
    SESSION_MERGE_PROJECTION_DEFINITION.init({}),
  )
  return state.value
}
