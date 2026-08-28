/**
 * Manual layout persistence for the session graph, scoped by workspace path
 * and stored in localStorage: dragged node positions, dragged cluster
 * offsets, and collapsed cluster roots as one record. Reads fail soft — a
 * corrupt or foreign payload yields undefined and the view falls back to
 * the auto layout — while writes replace the whole scope record (removed
 * sessions and expanded clusters drop out on the next save).
 * @module @benz-ai-x/dsh-client-ui-session-graph/src/client/layout-store
 */

/** One manually dragged node position in content px. */
export interface NodePosition {
  readonly x: number
  readonly y: number
}

/** One whole-cluster drag delta in content px. */
export interface ClusterOffset {
  readonly dx: number
  readonly dy: number
}

/** The persisted layout state of one workspace scope. */
export interface LayoutState {
  readonly positions: Record<string, NodePosition>
  readonly collapsed: readonly string[]
  readonly offsets: Record<string, ClusterOffset>
}

/** Persisted layout payload; `v` guards future format changes. */
interface LayoutRecord {
  readonly v: 1
  readonly positions: Record<string, NodePosition>
  readonly collapsed?: readonly string[]
  readonly offsets?: Record<string, ClusterOffset>
}

/** localStorage key prefix shared by every scope. */
const KEY_PREFIX = 'dsh.session-graph.layout.'

function storageKey(scopeKey: string): string {
  return `${KEY_PREFIX}${scopeKey}`
}

/**
 * Load the layout state of one workspace scope.
 * @param scopeKey - the workspace scope key (its canonical path).
 * @param storage - the storage backend (localStorage in the app).
 * @returns the layout state, or undefined when absent or corrupt (the
 *   caller falls back to the auto layout). Malformed entries and coordinates
 *   that are not finite numbers are omitted from an otherwise valid record.
 */
export function loadLayout(
  scopeKey: string,
  storage: Storage = globalThis.localStorage,
): LayoutState | undefined {
  const raw = storage.getItem(storageKey(scopeKey))
  if (raw === null) return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return undefined
    const { v, positions: rawPositions, collapsed, offsets: rawOffsets } = parsed as {
      v?: unknown
      positions?: unknown
      collapsed?: unknown
      offsets?: unknown
    }
    if (v !== 1 || typeof rawPositions !== 'object' || rawPositions === null) {
      return undefined
    }
    const positions: Record<string, NodePosition> = {}
    for (const [key, value] of Object.entries(rawPositions)) {
      if (typeof value !== 'object' || value === null) continue
      const { x, y } = value as { x?: unknown; y?: unknown }
      if (typeof x !== 'number' || !Number.isFinite(x)
        || typeof y !== 'number' || !Number.isFinite(y)) continue
      positions[key] = { x, y }
    }
    const collapsedIds = Array.isArray(collapsed)
      ? collapsed.filter((entry): entry is string => typeof entry === 'string')
      : []
    // Offsets joined the record later: an absent or malformed field is an
    // empty map, never a corrupt record.
    const offsets: Record<string, ClusterOffset> = {}
    if (typeof rawOffsets === 'object' && rawOffsets !== null) {
      for (const [key, value] of Object.entries(rawOffsets)) {
        if (typeof value !== 'object' || value === null) continue
        const { dx, dy } = value as { dx?: unknown; dy?: unknown }
        if (typeof dx !== 'number' || !Number.isFinite(dx)
          || typeof dy !== 'number' || !Number.isFinite(dy)) continue
        offsets[key] = { dx, dy }
      }
    }
    return { positions, collapsed: collapsedIds, offsets }
  } catch {
    // A corrupt payload is display data, not authority: the auto layout
    // replaces it on the next save.
    return undefined
  }
}

/**
 * Replace the layout state of one workspace scope.
 * @param scopeKey - the workspace scope key (its canonical path).
 * @param state - the complete layout state to persist.
 * @param storage - the storage backend (localStorage in the app).
 */
export function saveLayout(
  scopeKey: string,
  state: LayoutState,
  storage: Storage = globalThis.localStorage,
): void {
  const record: LayoutRecord = {
    v: 1,
    positions: { ...state.positions },
    collapsed: [...state.collapsed],
    offsets: { ...state.offsets },
  }
  storage.setItem(storageKey(scopeKey), JSON.stringify(record))
}
