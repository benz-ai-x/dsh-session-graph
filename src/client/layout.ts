/**
 * Deterministic top-to-bottom forest layout over the derived session graph.
 * Fixed metrics only — no measurement or graph-layout dependency: leaves consume
 * columns in depth-first display order and each parent centers on the
 * midpoint of its first and last child column, so identical graphs lay out
 * identically.
 * @module @benz-ai-x/dsh-client-ui-session-graph/src/client/layout
 */
import type { GraphEdge, GraphNode, SessionGraph } from './graph-model.ts'

/** Node card width in px. */
export const NODE_W = 240
/** Node card height in px. */
export const CARD_H = 56
/** Horizontal distance between consecutive leaf columns in px. */
export const COL_PITCH = 280
/** Vertical distance between consecutive depth rows in px. */
export const DEPTH_PITCH = 120
/** Vertical gap between stacked cluster frames in px. */
export const CLUSTER_GAP = 72
/** Vertical distance between rows of a collapsed cluster in content px. */
export const COLLAPSED_ROW = 64

/** One positioned node card. */
export interface LaidOutNode {
  readonly node: GraphNode
  readonly key: string
  readonly x: number
  readonly y: number
}

/** One positioned edge with its bezier path. */
export interface LaidOutEdge {
  readonly edge: GraphEdge
  readonly path: string
}

/** One axis-aligned content box in canvas coordinates. */
export interface ContentBounds {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** The positioned graph plus its complete node-card bounds. */
export interface LaidOutGraph extends ContentBounds {
  readonly nodes: readonly LaidOutNode[]
  readonly edges: readonly LaidOutEdge[]
}

/** Minimum bezier control-arm length in px, so narrow gaps still curve. */
const EDGE_BEND_MIN = 40

/**
 * Measure the complete node-card bounds, including negative coordinates.
 * @param nodes - the positioned node cards.
 * @returns their axis-aligned bounds, or a zero box when empty.
 */
export function nodeBounds(nodes: readonly LaidOutNode[]): ContentBounds {
  if (nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  const x = Math.min(...nodes.map(node => node.x))
  const y = Math.min(...nodes.map(node => node.y))
  const right = Math.max(...nodes.map(node => node.x + NODE_W))
  const bottom = Math.max(...nodes.map(node => node.y + CARD_H))
  return { x, y, width: right - x, height: bottom - y }
}

/**
 * The branch-edge path from one node's bottom-edge midpoint to the other's
 * top-edge midpoint: a vertical cubic bezier whose control arms reach half
 * the vertical gap, floored at {@link EDGE_BEND_MIN}. The curve arrives at
 * the child vertically, matching the downward arrowhead's orientation.
 * @param from - the parent node's laid position.
 * @param to - the child node's laid position.
 * @returns the SVG path data.
 */
export function edgePath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const startX = from.x + NODE_W / 2
  const startY = from.y + CARD_H
  const endX = to.x + NODE_W / 2
  const endY = to.y
  const bend = Math.max(EDGE_BEND_MIN, Math.abs(endY - startY) / 2)
  return `M ${startX} ${startY} C ${startX} ${startY + bend}, ${endX} ${endY - bend}, ${endX} ${endY}`
}

/**
 * Lay out the session graph.
 *
 * Each Session Cluster's Branch-connected Canvas Sessions are laid out in a local frame (depth
 * rows, leaves on allocated columns, parents centered on their first/last
 * child midpoint), then the cluster frames stack top to bottom in display
 * order. Each vertical allocation reserves the taller of its expanded tree
 * and collapsed column so compaction cannot overlap the following cluster. Edges curve
 * from the parent's bottom-edge midpoint to the child's top-edge midpoint
 * (see {@link edgePath}).
 * @param graph - the derived graph.
 * @returns the positioned nodes, edge paths, and canvas bounds.
 */
export function layoutSessionGraph(graph: SessionGraph): LaidOutGraph {
  const nodes: LaidOutNode[] = []

  const place = (key: string, depth: number, colCursor: { current: number }, local: LaidOutNode[]): number => {
    const y = depth * DEPTH_PITCH
    const node = graph.nodes.get(key)
    if (node === undefined) {
      throw new Error(`session-graph layout: node "${key}" referenced but not derived`)
    }
    // First and last child column as one bounds pair: undefined while the
    // node is a leaf, set on the first recursion, stretched on every later one.
    let bounds: [number, number] | undefined
    for (const child of graph.children.get(key) ?? []) {
      const childX = place(child, depth + 1, colCursor, local)
      bounds = bounds === undefined ? [childX, childX] : [bounds[0], childX]
    }
    let x: number
    if (bounds === undefined) {
      x = colCursor.current * COL_PITCH
      colCursor.current += 1
    } else {
      x = (bounds[0] + bounds[1]) / 2
    }
    local.push({ node, key, x, y })
    return x
  }

  // Lay out every cluster in its own local frame, measuring each extent.
  const frames = graph.clusters.map((cluster) => {
    const colCursor = { current: 0 }
    const local: LaidOutNode[] = []
    place(cluster.rootId, 0, colCursor, local)
    // place() pushes at least the root or throws, so local is never empty.
    const expandedHeight = Math.max(...local.map(entry => entry.y)) + CARD_H
    const compactHeight = (cluster.memberIds.length - 1) * COLLAPSED_ROW + CARD_H
    return { local, stackHeight: Math.max(expandedHeight, compactHeight) }
  })

  // Stack the cluster frames top to bottom in display order.
  let offsetY = 0
  for (const frame of frames) {
    for (const entry of frame.local) {
      nodes.push({ ...entry, y: entry.y + offsetY })
    }
    offsetY += frame.stackHeight + CLUSTER_GAP
  }

  const byKey = new Map(nodes.map(laid => [laid.key, laid]))
  const edges: LaidOutEdge[] = []
  for (const edge of graph.edges) {
    const from = byKey.get(edge.from)
    const to = byKey.get(edge.to)
    if (from === undefined || to === undefined) {
      throw new Error(`session-graph layout: edge "${edge.id}" endpoint not laid out`)
    }
    edges.push({ edge, path: edgePath(from, to) })
  }

  return { nodes, edges, ...nodeBounds(nodes) }
}

/**
 * Re-derive every edge path from the supplied node positions. An edge whose
 * endpoint is not in the node set, or that the caller flags to keep, passes
 * through with its path untouched.
 * @param edges - the edges to redraw.
 * @param byKey - the supplied node positions keyed by node id.
 * @param keepPath - predicate marking edges to pass through untouched.
 * @returns the edges with redrawn paths.
 */
export function redrawEdges(
  edges: readonly LaidOutEdge[],
  byKey: ReadonlyMap<string, LaidOutNode>,
  keepPath: (from: LaidOutNode, to: LaidOutNode) => boolean,
): LaidOutEdge[] {
  return edges.map(({ edge, path }): LaidOutEdge => {
    const from = byKey.get(edge.from)
    const to = byKey.get(edge.to)
    if (from === undefined || to === undefined || keepPath(from, to)) {
      return { edge, path }
    }
    return { edge, path: edgePath(from, to) }
  })
}

/**
 * Overlay manually dragged positions onto an auto layout: every node with a
 * stored position moves there, the edge paths re-derive from the new
 * endpoints, and the node-card bounds re-derive from the complete result.
 * Unknown ids in the stored map are ignored (their sessions left the scope).
 * @param laid - the auto-laid-out graph.
 * @param positions - manually dragged positions keyed by session id.
 * @returns the laid-out graph with the manual positions applied.
 */
export function applyPositions(
  laid: LaidOutGraph,
  positions: Readonly<Record<string, { x: number; y: number }>>,
): LaidOutGraph {
  const known = new Set(laid.nodes.map(node => node.key))
  const overrides = new Map(
    Object.entries(positions).filter(([key]) => known.has(key)),
  )
  if (overrides.size === 0) return laid
  const nodes = laid.nodes.map((laidNode) => {
    const moved = overrides.get(laidNode.key)
    return moved === undefined ? laidNode : { ...laidNode, x: moved.x, y: moved.y }
  })
  const byKey = new Map(nodes.map(node => [node.key, node]))
  const edges = redrawEdges(laid.edges, byKey, () => false)
  return {
    nodes,
    edges,
    ...nodeBounds(nodes),
  }
}
