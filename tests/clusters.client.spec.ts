import { describe, expect, it } from 'vitest'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { deriveSessionGraph, resolveWorkspaceScope } from '../src/client/graph-model.ts'
import { layoutSessionGraph } from '../src/client/layout.ts'
import {
  applyCollapse, applyOffsets, CLUSTER_COLORS, clusterFrames, contentBounds,
} from '../src/client/clusters.ts'

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
  const graph = deriveSessionGraph(list, scope, undefined, new Map())
  return { clusters: graph.clusters, laid: layoutSessionGraph(graph) }
}

describe('clusterFrames', () => {
  it('wraps every cluster around its nodes with padding and a title band', () => {
    const { laid, clusters } = graphFor({
      root: session('root', { updatedAt: 500 }),
      child: session('child', { parentId: id('root'), updatedAt: 400 }),
      lone: session('lone', { updatedAt: 300 }),
    })
    // Both clusters frame — the derivation tree and the isolated singleton.
    const frames = clusterFrames(laid, clusters)
    expect(frames).toHaveLength(2)
    const frame = frames[0]!
    expect(frame.clusterId).toBe('root')
    expect(frame.label).toBe('Session root')
    // Node geometry: root (0,0), child (0,120) → frame encloses both plus padding.
    expect(frame.x).toBe(-16)
    expect(frame.y).toBe(-16 - 32)
    expect(frame.width).toBe(240 + 32)
    expect(frame.height).toBe(164 + 32 + 32)
    expect(frame.collapsed).toBe(false)
    expect(frames[1]?.clusterId).toBe('lone')
  })

  it('frames an isolated node without subagents', () => {
    const { laid, clusters } = graphFor({ lone: session('lone') })
    const frames = clusterFrames(laid, clusters)
    expect(frames).toHaveLength(1)
    expect(frames[0]?.clusterId).toBe('lone')
  })

  it('skips a cluster whose root matches no laid-out node', () => {
    const { laid, clusters } = graphFor({ lone: session('lone') })
    const phantom = [{ rootId: 'ghost' as never, label: 'ghost', memberIds: [] }]
    expect(clusterFrames(laid, [...clusters, ...phantom])).toHaveLength(1)
  })

  it('assignes palette colors by cluster order', () => {
    const { laid, clusters } = graphFor({
      a: session('a'),
      b: session('b', { updatedAt: 900 }),
      c: session('c', { updatedAt: 100 }),
    })
    const frames = clusterFrames(laid, clusters)
    expect(frames.map(frame => frame.colorIndex)).toEqual([0, 1, 2])
  })
})

describe('applyCollapse', () => {
  const CLUSTERED: Record<string, SessionSummary> = {
    root: session('root', { updatedAt: 500 }),
    child: session('child', { parentId: id('root'), updatedAt: 400 }),
    lone: session('lone', { updatedAt: 300 }),
  }

  it('keeps each cluster frame at its previous origin without overlapping another frame', () => {
    const { laid, clusters } = graphFor({
      root: session('root', { updatedAt: 700 }),
      a: session('a', { parentId: id('root'), updatedAt: 600 }),
      b: session('b', { parentId: id('root'), updatedAt: 500 }),
      c: session('c', { parentId: id('root'), updatedAt: 400 }),
      lone: session('lone', { updatedAt: 300 }),
    })
    const before = clusterFrames(laid, clusters)
    const collapsed = new Set(clusters.map(cluster => cluster.rootId))
    const after = clusterFrames(applyCollapse(laid, clusters, collapsed), clusters, collapsed)

    expect(after.map(({ clusterId, x, y }) => ({ clusterId, x, y }))).toEqual(
      before.map(({ clusterId, x, y }) => ({ clusterId, x, y })),
    )
    const [first, second] = after
    expect(first === undefined || second === undefined || (
      first.x + first.width <= second.x
      || second.x + second.width <= first.x
      || first.y + first.height <= second.y
      || second.y + second.height <= first.y
    )).toBe(true)
  })

  it('recomputes the compacted bounds instead of retaining the expanded tree extent', () => {
    const { laid, clusters } = graphFor({
      root: session('root', { updatedAt: 500 }),
      a: session('a', { parentId: id('root'), updatedAt: 400 }),
      b: session('b', { parentId: id('root'), updatedAt: 300 }),
      c: session('c', { parentId: id('root'), updatedAt: 200 }),
    })
    const collapsed = applyCollapse(laid, clusters, new Set(['root']))
    expect(collapsed).toMatchObject({ x: 0, y: 0, width: 240, height: 200 })
  })

  it('stacks collapsed members into one compact column and leaves others in place', () => {
    const { laid, clusters } = graphFor(CLUSTERED)
    const collapsedGraph = applyCollapse(laid, clusters, new Set(['root']))
    const child = collapsedGraph.nodes.find(node => node.key === 'child')!
    const root = collapsedGraph.nodes.find(node => node.key === 'root')!
    const previousRoot = laid.nodes.find(node => node.key === 'root')!
    // Both members share the cluster's previous compact-column x with stacked rows.
    expect(child.x).toBe(previousRoot.x)
    expect(root.x).toBe(previousRoot.x)
    expect(child.y - root.y).toBe(52)
    const lone = collapsedGraph.nodes.find(node => node.key === 'lone')!
    expect(lone.x).toBe(laid.nodes.find(node => node.key === 'lone')!.x)
  })

  it('drops the edges of a collapsed cluster', () => {
    const { laid, clusters } = graphFor(CLUSTERED)
    expect(laid.edges).toHaveLength(1)
    expect(applyCollapse(laid, clusters, new Set(['root'])).edges).toHaveLength(0)
  })

  it('returns the input graph when nothing is collapsed', () => {
    const { laid, clusters } = graphFor(CLUSTERED)
    expect(applyCollapse(laid, clusters, new Set())).toBe(laid)
  })

  it('returns the input graph when the collapsed set names no live cluster', () => {
    const { laid, clusters } = graphFor(CLUSTERED)
    expect(applyCollapse(laid, clusters, new Set(['ghost']))).toBe(laid)
  })
})

describe('applyOffsets', () => {
  const TWO: Record<string, SessionSummary> = {
    root: session('root', { updatedAt: 500 }),
    child: session('child', { parentId: id('root'), updatedAt: 400 }),
    lone: session('lone', { updatedAt: 300 }),
  }

  it('shifts every member of the offset cluster, re-derives its edge paths, and recomputes the bounds', () => {
    const { laid } = graphFor(TWO)
    const moved = applyOffsets(laid, { root: { dx: 50, dy: 30 } })
    expect(moved.nodes.find(node => node.key === 'root')).toMatchObject({ x: 50, y: 30 })
    expect(moved.nodes.find(node => node.key === 'child')).toMatchObject({ x: 50, y: 150 })
    // The untouched cluster keeps its seat.
    const lone = moved.nodes.find(node => node.key === 'lone')!
    expect(lone).toMatchObject(laid.nodes.find(node => node.key === 'lone')!)
    // The edge follows the shifted endpoints (76px vertical gap → 40px floor bend).
    expect(moved.edges[0]?.path).toBe('M 170 74 C 170 114, 170 110, 170 150')
    expect(moved.width).toBeGreaterThanOrEqual(50 + 240)
    expect(moved.height).toBeGreaterThanOrEqual(150 + 44)
  })

  it('tracks the complete bounds when a cluster moves left and up', () => {
    const { laid } = graphFor({
      root: session('root', { updatedAt: 500 }),
      child: session('child', { parentId: id('root'), updatedAt: 400 }),
    })
    const moved = applyOffsets(laid, { root: { dx: -300, dy: -200 } })
    expect(moved).toMatchObject({ x: -300, y: -200, width: 240, height: 164 })
  })

  it('returns the input graph on empty, zero, and unknown offsets', () => {
    const { laid } = graphFor(TWO)
    expect(applyOffsets(laid, {})).toBe(laid)
    expect(applyOffsets(laid, { root: { dx: 0, dy: 0 } })).toBe(laid)
    expect(applyOffsets(laid, { ghost: { dx: 10, dy: 10 } })).toBe(laid)
  })

  it('passes edges through untouched when their cluster is not offset or an endpoint is missing', () => {
    const { laid } = graphFor(TWO)
    // Offsetting only the lone cluster leaves the root cluster's edge as-is.
    const moved = applyOffsets(laid, { lone: { dx: 10, dy: 10 } })
    expect(moved.edges[0]?.path).toBe(laid.edges[0]?.path)
    const handBuilt = {
      nodes: [{ node: { clusterId: 'c1' } as never, key: 'a', x: 0, y: 0 }],
      edges: [
        { edge: { id: 'e1', from: 'a', to: 'ghost' }, path: 'M 0 0 C 1 1' },
        { edge: { id: 'e2', from: 'ghost', to: 'a' }, path: 'M 2 2 C 3 3' },
      ],
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    }
    const shifted = applyOffsets(handBuilt, { c1: { dx: 5, dy: 5 } })
    expect(shifted.edges[0]?.path).toBe('M 0 0 C 1 1')
    expect(shifted.edges[1]?.path).toBe('M 2 2 C 3 3')
  })
})

describe('contentBounds', () => {
  it('includes frame padding and title bands at negative coordinates', () => {
    const { laid, clusters } = graphFor({
      root: session('root', { updatedAt: 500 }),
      child: session('child', { parentId: id('root'), updatedAt: 400 }),
    })
    const moved = applyOffsets(laid, { root: { dx: -300, dy: -200 } })
    expect(contentBounds(moved, clusterFrames(moved, clusters))).toEqual({
      x: -316,
      y: -248,
      width: 272,
      height: 228,
    })
  })
})

describe('CLUSTER_COLORS', () => {
  it('is a non-empty cycle of alias token names', () => {
    expect(CLUSTER_COLORS.length).toBeGreaterThan(2)
    for (const color of CLUSTER_COLORS) expect(color).toMatch(/^--dsw-alias-/)
  })
})
