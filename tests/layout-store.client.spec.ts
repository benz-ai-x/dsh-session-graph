import { describe, expect, it } from 'vitest'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { deriveSessionGraph, resolveWorkspaceScope } from '../src/client/graph-model.ts'
import { applyPositions, layoutSessionGraph } from '../src/client/layout.ts'
import { loadLayout, saveLayout } from '../src/client/layout-store.ts'

const id = (value: string): SessionId => value as SessionId

function session(value: string, over: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: id(value),
    displayTitle: over.displayTitle ?? `Session ${value}`,
    running: over.running ?? false,
    blank: over.blank ?? false,
    updatedAt: over.updatedAt ?? 1_000,
    cwd: '/w',
    ...over,
  }
}

function laidFor(byId: Record<string, SessionSummary>) {
  const list: SessionListState = {
    ids: Object.keys(byId).map(id),
    byId,
    current: undefined,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
    currentAddress: undefined,
  }
  const scope = resolveWorkspaceScope(id(Object.keys(byId)[0] ?? ''), list, {
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
  })
  return layoutSessionGraph(deriveSessionGraph(list, scope, undefined, new Map()))
}

/** In-memory Storage double for the layout persistence tests. */
function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length(): number { return map.size },
    clear: () => { map.clear() },
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => { map.delete(key) },
    setItem: (key: string, value: string) => { map.set(key, value) },
  }
}

describe('applyPositions', () => {
  it('overrides node positions, redraws the edge paths, and recomputes the bounds', () => {
    const laid = laidFor({
      parent: session('parent', { updatedAt: 300 }),
      child: session('child', { parentId: id('parent'), updatedAt: 200 }),
    })
    const moved = applyPositions(laid, { child: { x: 0, y: 500 } })
    expect(moved.nodes.find(node => node.key === 'child')).toMatchObject({ x: 0, y: 500 })
    expect(moved.nodes.find(node => node.key === 'parent')).toMatchObject({ x: 0, y: 0 })
    // The fork edge curves down to the moved child's top edge: the 456px
    // vertical gap bends each control arm by half of it (228px).
    expect(moved.edges[0]?.path).toBe('M 120 44 C 120 272, 120 272, 120 500')
    expect(moved.height).toBeGreaterThanOrEqual(544)
  })

  it('tracks the complete bounds when a node moves left and up', () => {
    const laid = laidFor({
      parent: session('parent', { updatedAt: 300 }),
      child: session('child', { parentId: id('parent'), updatedAt: 200 }),
    })
    const moved = applyPositions(laid, { child: { x: -300, y: -200 } })
    expect(moved).toMatchObject({ x: -300, y: -200, width: 540, height: 244 })
  })

  it('floors the curve bend on short vertical gaps', () => {
    const laid = laidFor({
      parent: session('parent', { updatedAt: 300 }),
      child: session('child', { parentId: id('parent'), updatedAt: 200 }),
    })
    // A 16px gap bends by the 40px floor instead of the half-gap (8px).
    const moved = applyPositions(laid, { child: { x: 300, y: 60 } })
    expect(moved.edges[0]?.path).toBe('M 120 44 C 120 84, 420 20, 420 60')
  })

  it('keeps unknown ids out of the result', () => {
    const laid = laidFor({ solo: session('solo') })
    const moved = applyPositions(laid, { ghost: { x: 99, y: 99 } })
    expect(moved.nodes).toHaveLength(1)
    expect(moved.width).toBe(laid.width)
  })

  it('passes an edge through untouched when an endpoint is not in the node set', () => {
    const handBuilt = {
      nodes: [{ node: {} as never, key: 'a', x: 0, y: 0 }],
      edges: [{ edge: { id: 'e1', from: 'a', to: 'ghost' }, path: 'M 0 0 H 1' }],
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    }
    const moved = applyPositions(handBuilt, { a: { x: 40, y: 40 } })
    expect(moved.edges[0]?.path).toBe('M 0 0 H 1')
  })
})

describe('layout persistence', () => {
  it('round-trips positions, collapsed clusters, and cluster offsets under the scope key', () => {
    const storage = memoryStorage()
    saveLayout('/w', {
      positions: { a: { x: 10, y: 20 } },
      collapsed: ['root'],
      offsets: { root: { dx: 40, dy: -8 } },
    }, storage)
    expect(storage.getItem('dsh.session-graph.layout./w')).toBeTruthy()
    expect(loadLayout('/w', storage)).toEqual({
      positions: { a: { x: 10, y: 20 } },
      collapsed: ['root'],
      offsets: { root: { dx: 40, dy: -8 } },
    })
    // A different scope key never crosses.
    expect(loadLayout('/other', storage)).toBeUndefined()
  })

  it('loads a pre-offsets record with an empty offset map', () => {
    const storage = memoryStorage()
    storage.setItem('dsh.session-graph.layout./w', '{"v":1,"positions":{"a":{"x":1,"y":2}}}')
    expect(loadLayout('/w', storage)).toEqual({
      positions: { a: { x: 1, y: 2 } },
      collapsed: [],
      offsets: {},
    })
  })

  it('fails soft on corrupt payloads', () => {
    const storage = memoryStorage()
    storage.setItem('dsh.session-graph.layout./w', '{not json')
    expect(loadLayout('/w', storage)).toBeUndefined()
    storage.setItem('dsh.session-graph.layout./w', '"a string"')
    expect(loadLayout('/w', storage)).toBeUndefined()
    storage.setItem('dsh.session-graph.layout./w', '{"nope":1}')
    expect(loadLayout('/w', storage)).toBeUndefined()
    storage.setItem('dsh.session-graph.layout./w', '{"v":1,"positions":null}')
    expect(loadLayout('/w', storage)).toBeUndefined()
    storage.setItem('dsh.session-graph.layout./w', '{"v":1,"positions":{"a":"str","b":{"x":1},"c":{"x":1,"y":2}}}')
    expect(loadLayout('/w', storage)).toEqual({ positions: { c: { x: 1, y: 2 } }, collapsed: [], offsets: {} })
    storage.setItem('dsh.session-graph.layout./w', '{"v":1,"positions":{},"offsets":"str"}')
    expect(loadLayout('/w', storage)).toEqual({ positions: {}, collapsed: [], offsets: {} })
    storage.setItem('dsh.session-graph.layout./w', '{"v":1,"positions":{},"offsets":{"a":{"dx":1},"b":{"dx":2,"dy":3}}}')
    expect(loadLayout('/w', storage)).toEqual({
      positions: {},
      collapsed: [],
      offsets: { b: { dx: 2, dy: 3 } },
    })
    storage.setItem('dsh.session-graph.layout./w', '{"v":1,"positions":{},"offsets":{"a":null,"b":"str","c":{"dx":4,"dy":5}}}')
    expect(loadLayout('/w', storage)).toEqual({
      positions: {},
      collapsed: [],
      offsets: { c: { dx: 4, dy: 5 } },
    })
    storage.setItem('dsh.session-graph.layout./w', '{"v":1,"positions":{"a":{"x":1e400,"y":0},"b":{"x":1,"y":2}},"offsets":{"a":{"dx":0,"dy":-1e400},"b":{"dx":3,"dy":4}}}')
    expect(loadLayout('/w', storage)).toEqual({
      positions: { b: { x: 1, y: 2 } },
      collapsed: [],
      offsets: { b: { dx: 3, dy: 4 } },
    })
  })
})
