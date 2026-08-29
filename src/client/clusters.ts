/**
 * Pure cluster-frame geometry, collapse layout, and whole-cluster offsets
 * over the laid-out graph: the frame box around each cluster's laid-out node
 * positions, the compact column a collapsed cluster stacks into, the offset
 * a dragged cluster carries, and the palette cycle that colors frames by
 * cluster order.
 * @module @benz-ai-x/dsh-client-ui-session-graph/src/client/clusters
 */
import type { ClusterInfo } from './graph-model.ts'
import type { ContentBounds, LaidOutGraph, LaidOutNode } from './layout.ts'
import { CARD_H, COLLAPSED_ROW, NODE_W, nodeBounds, redrawEdges } from './layout.ts'

/** Frame inset around the member nodes in content px. */
export const FRAME_PAD = 16
/** Frame title-band height in content px. */
export const FRAME_TITLE_H = 32
/** Alias token names cycled across clusters for frame accents. */
export const CLUSTER_COLORS: readonly string[] = [
  '--dsw-alias-brand-primary',
  '--dsw-alias-state-business-primary',
  '--dsw-alias-state-success-primary',
  '--dsw-alias-state-warn-primary',
  '--dsw-alias-state-error-primary',
]
/** Dot color for sessions with no cluster (isolated roots). */
export const NEUTRAL_DOT = '--dsw-alias-label-dimmed'

/** One rendered cluster frame box. */
export interface LaidOutFrame {
  readonly clusterId: string
  readonly label: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly collapsed: boolean
  /** Palette index into {@link CLUSTER_COLORS}. */
  readonly colorIndex: number
}

/**
 * Compute the frame boxes for the laid-out clusters from the supplied node
 * positions. Every cluster frames — isolated singletons included — so every
 * session sits inside a named, draggable group; a collapsed cluster frames
 * only its compact column, and a cluster whose root matches no laid-out
 * node (a stale reference) is skipped.
 * @param laid - the laid-out graph (collapse already applied).
 * @param clusters - the derived cluster partitioning.
 * @param collapsed - the collapsed cluster root ids.
 * @returns the frame boxes in cluster order.
 */
export function clusterFrames(
  laid: LaidOutGraph,
  clusters: readonly ClusterInfo[],
  collapsed: ReadonlySet<string> = new Set(),
): LaidOutFrame[] {
  const frames: LaidOutFrame[] = []
  let colorIndex = 0
  for (const cluster of clusters) {
    const members = laid.nodes.filter(node => node.node.clusterId === cluster.rootId)
    if (members.length === 0) continue
    const minX = Math.min(...members.map(node => node.x))
    const maxX = Math.max(...members.map(node => node.x + NODE_W))
    const minY = Math.min(...members.map(node => node.y))
    const maxY = Math.max(...members.map(node => node.y + CARD_H))
    frames.push({
      clusterId: cluster.rootId,
      label: cluster.label,
      x: minX - FRAME_PAD,
      y: minY - FRAME_PAD - FRAME_TITLE_H,
      width: maxX - minX + 2 * FRAME_PAD,
      height: maxY - minY + 2 * FRAME_PAD + FRAME_TITLE_H,
      collapsed: collapsed.has(cluster.rootId),
      colorIndex,
    })
    colorIndex = (colorIndex + 1) % CLUSTER_COLORS.length
  }
  return frames
}

/**
 * Measure the visible canvas content, including node cards and cluster frames.
 * @param laid - the graph's complete node-card bounds.
 * @param frames - the rendered cluster frames.
 * @returns the union bounds used by Fit and the minimap.
 */
export function contentBounds(
  laid: LaidOutGraph,
  frames: readonly LaidOutFrame[],
): ContentBounds {
  const boxes: readonly ContentBounds[] = [laid, ...frames]
  const x = Math.min(...boxes.map(box => box.x))
  const y = Math.min(...boxes.map(box => box.y))
  const right = Math.max(...boxes.map(box => box.x + box.width))
  const bottom = Math.max(...boxes.map(box => box.y + box.height))
  return { x, y, width: right - x, height: bottom - y }
}

/**
 * Overlay whole-cluster drag offsets onto a laid-out graph: every member of
 * an offset cluster shifts by the delta, the intra-cluster edge paths
 * re-derive from the shifted endpoints, and the node-card bounds re-derive
 * from the complete result. Unknown cluster ids and zero deltas are ignored;
 * the input graph is returned untouched when nothing moves.
 * @param laid - the laid-out graph (positions and collapse already applied).
 * @param offsets - whole-cluster drag deltas keyed by cluster root id.
 * @returns the laid-out graph with the cluster offsets applied.
 */
export function applyOffsets(
  laid: LaidOutGraph,
  offsets: Readonly<Record<string, { dx: number; dy: number }>>,
): LaidOutGraph {
  const active = new Map(
    Object.entries(offsets).filter(([, offset]) => offset.dx !== 0 || offset.dy !== 0),
  )
  if (active.size === 0) return laid
  if (!laid.nodes.some(node => active.has(node.node.clusterId))) return laid
  const nodes = laid.nodes.map((node): LaidOutNode => {
    const offset = active.get(node.node.clusterId)
    if (offset === undefined) return node
    return { ...node, x: node.x + offset.dx, y: node.y + offset.dy }
  })
  const byKey = new Map(nodes.map(node => [node.key, node]))
  const edges = redrawEdges(laid.edges, byKey, (from, to) =>
    !active.has(from.node.clusterId) && !active.has(to.node.clusterId))
  return {
    nodes,
    edges,
    ...nodeBounds(nodes),
  }
}

/**
 * Re-lay the members of every collapsed cluster into one compact column at
 * that cluster's laid-out node-bounds origin and drop its intra-cluster edges;
 * uncollapsed clusters keep their positions. The input graph is returned
 * untouched when nothing is collapsed.
 * @param laid - the laid-out graph.
 * @param clusters - the derived cluster partitioning (member order pins the
 *   compact stacking order).
 * @param collapsed - the collapsed cluster root ids.
 * @returns the collapsed layout.
 */
export function applyCollapse(
  laid: LaidOutGraph,
  clusters: readonly ClusterInfo[],
  collapsed: ReadonlySet<string>,
): LaidOutGraph {
  if (collapsed.size === 0) return laid
  // Rows follow the cluster's member order (root first), not the layout's
  // post-order node array.
  const rowOfKey = new Map<string, number>()
  for (const cluster of clusters) {
    if (!collapsed.has(cluster.rootId)) continue
    cluster.memberIds.forEach((memberId, index) => { rowOfKey.set(memberId, index) })
  }
  const origins = new Map<string, { x: number; y: number }>()
  for (const node of laid.nodes) {
    if (!collapsed.has(node.node.clusterId)) continue
    const origin = origins.get(node.node.clusterId)
    origins.set(node.node.clusterId, {
      x: Math.min(origin?.x ?? node.x, node.x),
      y: Math.min(origin?.y ?? node.y, node.y),
    })
  }
  const nodes = laid.nodes.map((node): LaidOutNode => {
    const row = rowOfKey.get(node.key)
    const origin = origins.get(node.node.clusterId)
    if (row === undefined || origin === undefined) return node
    return {
      ...node,
      x: origin.x,
      y: origin.y + row * COLLAPSED_ROW,
    }
  })
  if (!laid.nodes.some(node => rowOfKey.has(node.key))) return laid
  const byKey = new Map(nodes.map(node => [node.key, node]))
  const retained = laid.edges.filter(({ edge }) => {
    const from = byKey.get(edge.from)
    return edge.kind !== 'branch'
      || from === undefined
      || !collapsed.has(from.node.clusterId)
  })
  const edges = redrawEdges(retained, byKey, () => false)
  return { nodes, edges, ...nodeBounds(nodes) }
}
