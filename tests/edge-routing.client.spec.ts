import { describe, expect, it } from 'vitest'
import type { GraphEdge, GraphNode, SessionGraph } from '../src/client/graph-model.ts'
import { CARD_H, NODE_W, layoutSessionGraph } from '../src/client/layout.ts'
import { layoutResearchGraph } from '../src/client/research-layout.ts'
import { deriveCanvasPresentation } from '../src/client/canvas-presentation.ts'
import type { CanvasPresentation, CanvasPresentationInput } from '../src/client/canvas-presentation.ts'

function graph(ids: readonly string[], pairs: readonly (readonly [string, string])[]): SessionGraph {
  return { nodes: new Map(ids.map(id => [id, { id, clusterId: id, title: id } as GraphNode])),
    children: new Map(ids.map(id => [id, []])), clusters: ids.map(id => ({ rootId: id, label: id, memberIds: [id] })),
    sessionCount: ids.length, edges: pairs.map(([from, to], index): GraphEdge => ({ id: `e${index}`, kind: 'merge', from, to })) }
}
function present(input: SessionGraph, options: Partial<CanvasPresentationInput> = {}): CanvasPresentation {
  return deriveCanvasPresentation({ laid: layoutSessionGraph(input), clusters: input.clusters, positions: {}, collapsed: new Set(), offsets: {}, ...options })
}
function assertClear(presentation: CanvasPresentation): void {
  const { shown, frames, bounds } = presentation
  const obstacles = [
    ...shown.nodes.map(node => ({ id: node.key, x: node.x, y: node.y, width: NODE_W, height: CARD_H })),
    ...frames.filter(frame => shown.nodes.filter(node => node.node.clusterId === frame.clusterId).length > 1)
      .map(frame => ({ ...frame, id: `header:${frame.clusterId}`, height: 32 })),
  ]
  for (const edge of shown.edges) {
    for (let index = 1; index < edge.points.length; index += 1) {
      const a = edge.points[index - 1]!, b = edge.points[index]!
      expect(a.x === b.x || a.y === b.y).toBe(true)
      for (const box of obstacles) {
        const hits = a.x === b.x
          ? a.x > box.x && a.x < box.x + box.width && Math.max(a.y, b.y) > box.y && Math.min(a.y, b.y) < box.y + box.height
          : a.y > box.y && a.y < box.y + box.height && Math.max(a.x, b.x) > box.x && Math.min(a.x, b.x) < box.x + box.width
        expect(hits, `${edge.edge.id} segment ${index} crosses ${box.id}`).toBe(false)
      }
    }
    for (const point of edge.points) {
      expect(point.x).toBeGreaterThanOrEqual(bounds.x)
      expect(point.y).toBeGreaterThanOrEqual(bounds.y)
      expect(point.x).toBeLessThanOrEqual(bounds.x + bounds.width)
      expect(point.y).toBeLessThanOrEqual(bounds.y + bounds.height)
    }
    const tip = edge.points.at(-1)!
    expect(edge.arrowPath).toContain(`L ${tip.x} ${tip.y} L`)
    expect(shown.ports.get(edge.edge.to)).toContainEqual(expect.objectContaining({ direction: 'input', x: tip.x, y: tip.y }))
  }
}
function sharedLength(presentation: CanvasPresentation): number {
  let overlap = 0
  const edges = presentation.shown.edges
  for (let left = 0; left < edges.length; left += 1) {
    for (let right = left + 1; right < edges.length; right += 1) {
      const a = edges[left]!.points, b = edges[right]!.points
      for (let i = 1; i < a.length; i += 1) for (let j = 1; j < b.length; j += 1) {
        const p = a[i - 1]!, q = a[i]!, r = b[j - 1]!, s = b[j]!
        if (p.x === q.x && r.x === s.x && Math.abs(p.x - r.x) < 0.01) overlap += Math.max(0, Math.min(Math.max(p.y, q.y), Math.max(r.y, s.y)) - Math.max(Math.min(p.y, q.y), Math.min(r.y, s.y)))
        if (p.y === q.y && r.y === s.y && Math.abs(p.y - r.y) < 0.01) overlap += Math.max(0, Math.min(Math.max(p.x, q.x), Math.max(r.x, s.x)) - Math.max(Math.min(p.x, q.x), Math.min(r.x, s.x)))
      }
    }
  }
  return overlap
}

describe('final canvas routing', () => {
  it.each([layoutSessionGraph, layoutResearchGraph])('keeps screenshot-shaped Merge sources parallel with distinct routes and arrow tips', layout => {
    const input = graph(['unrelated', 'A', 'B', 'C', 'M'], [['A', 'M'], ['B', 'M'], ['C', 'M']])
    const result = present(input, { laid: layout(input) })
    const nodes = new Map(result.shown.nodes.map(node => [node.key, node]))
    expect(new Set(['A', 'B', 'C'].map(id => nodes.get(id)!.y)).size).toBe(1)
    expect(nodes.get('M')!.x).toBe((nodes.get('A')!.x + nodes.get('C')!.x) / 2)
    expect(new Set(result.shown.edges.map(edge => JSON.stringify(edge.points.at(-1)))).size).toBe(3)
    assertClear(result)
    expect(sharedLength(result)).toBe(0)
    expect(result).toEqual(present(input, { laid: layout(input) }))
  })

  it('does not wrap a fifth or later connected source into incoming routes', () => {
    const sources = Array.from({ length: 12 }, (_, i) => `s${i}`)
    const input = graph([...sources, 'M'], sources.map(id => [id, 'M']))
    const result = present(input)
    expect(new Set(result.shown.nodes.filter(node => node.key !== 'M').map(node => node.y)).size).toBe(1)
    assertClear(result)
    expect(sharedLength(result)).toBe(0)
  })

  it('routes skip-level and feedback relations around cards without changing directed facts', () => {
    const input = graph(['A', 'B', 'C', 'D'], [['A', 'B'], ['B', 'C'], ['A', 'C'], ['C', 'A'], ['C', 'D']])
    const result = present(input)
    assertClear(result)
    expect(result.shown.edges.map(edge => edge.edge)).toEqual(input.edges)
    expect(sharedLength(result)).toBe(0)
  })

  it('reroutes every edge after dragging an unrelated card into an existing route', () => {
    const input = graph(['A', 'B', 'C', 'M'], [['A', 'M'], ['B', 'M'], ['C', 'M']])
    const automatic = present(input)
    const moved = present(input, { positions: { A: { x: 0, y: 0 }, B: { x: 0, y: 140 }, C: { x: 0, y: 280 }, M: { x: 0, y: 420 } } })
    assertClear(moved)
    expect(sharedLength(moved)).toBe(0)
    expect(moved.shown.edges[0]!.path).not.toBe(automatic.shown.edges[0]!.path)
    expect(moved.bounds.width).toBeGreaterThan(NODE_W)
  })

  it('avoids visible frame headers and compact rows after collapse and a whole-cluster offset', () => {
    const initial = graph(['root', 'child', 'other', 'target'], [['root', 'child'], ['child', 'target'], ['other', 'root']])
    const input: SessionGraph = { ...initial,
      nodes: new Map([...initial.nodes].map(([id, node]) => [id, id === 'child' ? { ...node, clusterId: 'root' } : node])),
      children: new Map([['root', ['child']], ['child', []], ['other', []], ['target', []]]),
      clusters: [{ rootId: 'root', label: 'Branch cluster', memberIds: ['root', 'child'] }, ...initial.clusters.slice(2)],
      edges: initial.edges.map((edge, index) => index === 0 ? { ...edge, kind: 'branch' } : edge),
    }
    for (const collapsed of [new Set<string>(), new Set(['root'])]) {
      const result = present(input, { collapsed, offsets: { root: { dx: -80, dy: 50 } } })
      assertClear(result)
      expect(result.shown.edges.filter(edge => edge.edge.kind === 'merge')).toHaveLength(2)
    }
  })

  it('keeps dense overlapping research paths outside intermediate cards', () => {
    const ids = Array.from({ length: 30 }, (_, i) => `n${i}`)
    const pairs = ids.flatMap((from, i) => [1, 2, 3, 4].flatMap(step => ids[i + step] === undefined ? [] : [[from, ids[i + step]!] as const]))
    const input = graph(ids, pairs)
    const result = present(input)
    expect(result.shown.edges).toHaveLength(pairs.length)
    assertClear(result)
  })

  it('keeps labels off cards and includes their complete box in Fit', () => {
    const input = graph(['A', 'B', 'C'], [['A', 'C'], ['B', 'C']])
    const result = present(input, { labels: new Map([['e0', 'Synthesized from · 2 cards']]) })
    const label = result.shown.edges[0]!.label!
    expect(label.text).toBe('Synthesized from · 2 cards')
    for (const node of result.shown.nodes) expect(label.x < node.x || label.x > node.x + NODE_W || label.y < node.y || label.y > node.y + CARD_H).toBe(true)
    expect(label.x).toBeGreaterThan(result.bounds.x)
    expect(label.x).toBeLessThan(result.bounds.x + result.bounds.width)
    assertClear(result)
  })

  it('does not allocate an enormous empty grid for far-away manually positioned Branch members', () => {
    const initial = graph(['root', 'child'], [['root', 'child']])
    const input: SessionGraph = { ...initial,
      nodes: new Map([...initial.nodes].map(([id, node]) => [id, { ...node, clusterId: 'root' }])),
      children: new Map([['root', ['child']], ['child', []]]),
      clusters: [{ rootId: 'root', label: 'Wide frame', memberIds: ['root', 'child'] }],
      edges: initial.edges.map(edge => ({ ...edge, kind: 'branch' })),
    }
    const result = present(input, { positions: { child: { x: 1_000_000_000, y: 120 } } })
    expect(result.shown.edges).toHaveLength(1)
    expect(result.bounds.width).toBeGreaterThan(1_000_000_000)
    assertClear(result)
  })

  it('routes a 10,000-node Branch chain without recursion or a dense global grid', () => {
    const count = 10_000
    const input = graph(Array.from({ length: count }, (_, i) => `n${i}`), [])
    const nodes = new Map([...input.nodes].map(([id, node]) => [id, { ...node, clusterId: 'n0' }]))
    const chain: SessionGraph = { ...input, nodes, clusters: [{ rootId: 'n0', label: 'Chain', memberIds: [...nodes.keys()] }],
      children: new Map([...nodes.keys()].map((id, index) => [id, index < count - 1 ? [`n${index + 1}`] : []])),
      edges: Array.from({ length: count - 1 }, (_, i) => ({ id: `e${i}`, kind: 'branch', from: `n${i}`, to: `n${i + 1}` })) }
    const result = present(chain)
    expect(result.shown.edges).toHaveLength(count - 1)
    expect(result.shown.edges.every(edge => edge.points.length === 2)).toBe(true)
  })
})
