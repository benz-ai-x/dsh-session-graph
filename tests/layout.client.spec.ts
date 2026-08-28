import { describe, expect, it } from 'vitest'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { deriveSessionGraph, resolveWorkspaceScope } from '../src/client/graph-model.ts'
import {
  CARD_H,
  CLUSTER_GAP,
  COLLAPSED_ROW,
  COL_PITCH,
  DEPTH_PITCH,
  NODE_W,
  layoutSessionGraph,
} from '../src/client/layout.ts'

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

function listStateFor(byId: Record<string, SessionSummary>): SessionListState {
  return {
    ids: Object.keys(byId).map(id),
    byId,
    current: undefined,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
    currentAddress: undefined,
  }
}

function graphFor(byId: Record<string, SessionSummary>) {
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
  return deriveSessionGraph(list, scope, undefined, new Map())
}

describe('layoutSessionGraph', () => {
  it('places a single node at the origin sized to one card', () => {
    const laid = layoutSessionGraph(graphFor({ solo: session('solo') }))
    expect(laid.nodes).toHaveLength(1)
    expect(laid.nodes[0]).toMatchObject({ key: 'solo', x: 0, y: 0 })
    expect(laid.x).toBe(0)
    expect(laid.y).toBe(0)
    expect(laid.width).toBe(NODE_W)
    expect(laid.height).toBe(CARD_H)
  })

  it('folds subagent chains into badges without adding canvas rows', () => {
    const laid = layoutSessionGraph(graphFor({
      root: session('root'),
      sub1: session('sub1', { parentId: id('root'), origin: 'subagent', updatedAt: 200 }),
      sub2: session('sub2', { parentId: id('root'), origin: 'subagent', updatedAt: 100 }),
    }))
    expect(laid.nodes).toHaveLength(1)
    expect(laid.height).toBe(CARD_H)
  })

  it('separates siblings by at least one column pitch and keeps them on the next depth row', () => {
    const laid = layoutSessionGraph(graphFor({
      parent: session('parent', { updatedAt: 300 }),
      a: session('a', { parentId: id('parent'), updatedAt: 200 }),
      b: session('b', { parentId: id('parent'), updatedAt: 100 }),
    }))
    const a = laid.nodes.find(node => node.key === 'a')
    const b = laid.nodes.find(node => node.key === 'b')
    expect(a?.y).toBe(DEPTH_PITCH)
    expect(b?.y).toBe(DEPTH_PITCH)
    expect(Math.abs((a?.x ?? 0) - (b?.x ?? 0))).toBeGreaterThanOrEqual(COL_PITCH)
  })

  it('centers a parent on the midpoint of its first and last child columns', () => {
    const laid = layoutSessionGraph(graphFor({
      parent: session('parent', { updatedAt: 400 }),
      a: session('a', { parentId: id('parent'), updatedAt: 300 }),
      b: session('b', { parentId: id('parent'), updatedAt: 200 }),
      c: session('c', { parentId: id('parent'), updatedAt: 100 }),
    }))
    const xOf = (key: string): number => laid.nodes.find(node => node.key === key)?.x ?? -1
    expect(xOf('parent')).toBeCloseTo((xOf('a') + xOf('c')) / 2)
  })

  it('draws bezier edges from the parent bottom edge to the child top edge', () => {
    const laid = layoutSessionGraph(graphFor({
      parent: session('parent', { updatedAt: 400 }),
      a: session('a', { parentId: id('parent'), updatedAt: 300 }),
      b: session('b', { parentId: id('parent'), updatedAt: 200 }),
    }))
    // a takes column 0 and b column 1, so the parent centers at x=140
    // (midpoint); the 76px vertical gap bends each control arm by the 40px
    // floor (half of it, 38px, is below the floor).
    const edgeA = laid.edges.find(entry => entry.edge.to === 'a')
    expect(edgeA?.path).toBe('M 260 44 C 260 84, 120 80, 120 120')
    const edgeB = laid.edges.find(entry => entry.edge.to === 'b')
    expect(edgeB?.path).toBe('M 260 44 C 260 84, 400 80, 400 120')
  })

  it('grows bounds with depth and column count', () => {
    const laid = layoutSessionGraph(graphFor({
      root: session('root', { updatedAt: 400 }),
      mid: session('mid', { parentId: id('root'), updatedAt: 300 }),
      leaf: session('leaf', { parentId: id('mid'), updatedAt: 200 }),
    }))
    expect(laid.height).toBe(2 * DEPTH_PITCH + CARD_H)
    expect(laid.width).toBe(NODE_W)
    const wide = layoutSessionGraph(graphFor({
      root: session('root', { updatedAt: 500 }),
      a: session('a', { parentId: id('root'), updatedAt: 400 }),
      b: session('b', { parentId: id('root'), updatedAt: 300 }),
      c: session('c', { parentId: id('root'), updatedAt: 200 }),
    }))
    expect(wide.width).toBeGreaterThan(laid.width)
  })
})

describe('empty graph', () => {
  it('lays out to zero extents with no nodes', () => {
    const list = listStateFor({ hidden: { ...session('hidden'), blank: true } })
    const scope = resolveWorkspaceScope(id('hidden'), list, {
      items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    })
    const laid = layoutSessionGraph(deriveSessionGraph(list, scope, undefined, new Map()))
    expect(laid.nodes).toHaveLength(0)
    expect(laid.x).toBe(0)
    expect(laid.y).toBe(0)
    expect(laid.width).toBe(0)
    expect(laid.height).toBe(0)
  })
})

describe('cluster vertical stacking', () => {
  it('stacks clusters top to bottom in display order without overlap', () => {
    const laid = layoutSessionGraph(graphFor({
      aRoot: session('aRoot', { updatedAt: 900 }),
      aChild: session('aChild', { parentId: id('aRoot'), updatedAt: 800 }),
      bRoot: session('bRoot', { updatedAt: 700 }),
      cRoot: session('cRoot', { updatedAt: 600 }),
    }))
    const xOf = (key: string): number => laid.nodes.find(node => node.key === key)?.x ?? -1
    const yOf = (key: string): number => laid.nodes.find(node => node.key === key)?.y ?? -1
    // Cluster a (root plus one child) occupies the first 164px; b and c
    // follow with one gap each, all sharing the left column.
    expect(xOf('aRoot')).toBe(0)
    expect(yOf('aRoot')).toBe(0)
    expect(yOf('aChild')).toBe(DEPTH_PITCH)
    expect(xOf('bRoot')).toBe(0)
    expect(yOf('bRoot')).toBe(DEPTH_PITCH + CARD_H + CLUSTER_GAP)
    expect(yOf('cRoot')).toBeGreaterThan(yOf('bRoot') + CARD_H)
    expect(laid.width).toBe(NODE_W)
  })

  it('reserves enough vertical room for a wide cluster compacted into one column', () => {
    const graph = graphFor({
      root: session('root', { updatedAt: 900 }),
      a: session('a', { parentId: id('root'), updatedAt: 800 }),
      b: session('b', { parentId: id('root'), updatedAt: 700 }),
      c: session('c', { parentId: id('root'), updatedAt: 600 }),
      lone: session('lone', { updatedAt: 500 }),
    })
    const laid = layoutSessionGraph(graph)
    const rootY = laid.nodes.find(node => node.key === 'root')?.y ?? -1
    const loneY = laid.nodes.find(node => node.key === 'lone')?.y ?? -1
    expect(loneY - rootY).toBeGreaterThanOrEqual(3 * COLLAPSED_ROW + CARD_H + CLUSTER_GAP)
  })
})

describe('layoutSessionGraph fail-loud guards', () => {
  const emptyGraph = {
    clusters: [], nodes: new Map(), children: new Map(), edges: [],
    workspaceLabel: undefined, sessionCount: 0,
  }

  it('throws when a cluster root references an underived node', () => {
    const graph = { ...emptyGraph, clusters: [{ rootId: 'ghost', label: 'ghost', memberIds: [] }] }
    expect(() => layoutSessionGraph(graph as never)).toThrow('node "ghost" referenced but not derived')
  })

  it('throws when a child key references an underived node', () => {
    const graph = {
      ...emptyGraph,
      clusters: [{ rootId: 'root', label: 'root', memberIds: ['root'] }],
      nodes: new Map([['root', {}]]),
      children: new Map([['root', ['ghost']]]),
    }
    expect(() => layoutSessionGraph(graph as never)).toThrow('node "ghost" referenced but not derived')
  })

  it('throws when an edge endpoint is not laid out', () => {
    const graph = {
      ...emptyGraph,
      clusters: [{ rootId: 'root', label: 'root', memberIds: ['root'] }],
      nodes: new Map([['root', {} as never]]),
      edges: [{ id: 'e1', from: 'root', to: 'ghost' }],
    }
    expect(() => layoutSessionGraph(graph as never)).toThrow('edge "e1" endpoint not laid out')
  })
})
