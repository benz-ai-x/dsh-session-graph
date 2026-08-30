/** Pure presentation pipeline from automatic layout plus one Session Arrangement. */

import { applyCollapse, applyOffsets, clusterFrames, contentBounds } from './clusters.ts'
import type { ClusterInfo } from './graph-model.ts'
import { applyPositions } from './layout.ts'
import type { ContentBounds, LaidOutGraph } from './layout.ts'
import type { ClusterOffset, NodePosition } from './layout-store.ts'
import type { LaidOutFrame } from './clusters.ts'

/** All inputs needed to project one automatic graph into its current presentation. */
export interface CanvasPresentationInput {
  readonly laid: LaidOutGraph
  readonly clusters: readonly ClusterInfo[]
  readonly positions: Readonly<Record<string, NodePosition>>
  readonly collapsed: ReadonlySet<string>
  readonly offsets: Readonly<Record<string, ClusterOffset>>
}

/** Current visible geometry plus the untouched automatic fit target. */
export interface CanvasPresentation {
  readonly shown: LaidOutGraph
  readonly frames: readonly LaidOutFrame[]
  readonly bounds: ContentBounds
  readonly automaticBounds: ContentBounds
}

/**
 * Apply the Session Arrangement in its domain order: node positions, cluster
 * collapse, then whole-cluster offsets. Frame and fit bounds are derived only
 * after the visible geometry is complete.
 */
export function deriveCanvasPresentation({
  laid,
  clusters,
  positions,
  collapsed,
  offsets,
}: CanvasPresentationInput): CanvasPresentation {
  const positioned = applyPositions(laid, positions)
  const compacted = applyCollapse(positioned, clusters, collapsed)
  const shown = applyOffsets(compacted, offsets)
  const frames = clusterFrames(shown, clusters, collapsed)
  const automaticFrames = clusterFrames(laid, clusters)
  return {
    shown,
    frames,
    bounds: contentBounds(shown, frames),
    automaticBounds: contentBounds(laid, automaticFrames),
  }
}
