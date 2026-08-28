/**
 * Drag-alignment snapping: while a node is dragged, its left and top edges
 * snap to the left and top edges of nearby nodes, and the canvas shows the
 * corresponding alignment guides. React-free; GraphCanvas feeds every drag
 * move through {@link snapPosition} so the threshold behavior is pinned by
 * unit tests.
 * @module @benz-ai-x/dsh-client-ui-session-graph/src/client/snap
 */

/** The snapped position plus the alignment guides to display. */
export interface SnapResult {
  readonly x: number
  readonly y: number
  /** Vertical guide position (the snapped left edge), or null when unsnapped. */
  readonly guideX: number | null
  /** Horizontal guide position (the snapped top edge), or null when unsnapped. */
  readonly guideY: number | null
}

/**
 * Snap one dragged top-left to the nearest node edges, each axis
 * independently: a candidate within the threshold snaps and reports its
 * guide, the nearest candidate wins, and an axis with no candidate in range
 * keeps the raw coordinate.
 * @param dragged - the raw dragged top-left in content px.
 * @param others - the other nodes' top-left positions in content px.
 * @param threshold - the snap distance in content px.
 * @returns the snapped position and active guides.
 */
export function snapPosition(
  dragged: { x: number; y: number },
  others: readonly { x: number; y: number }[],
  threshold: number,
): SnapResult {
  let x = dragged.x
  let y = dragged.y
  let guideX: number | null = null
  let guideY: number | null = null
  let bestX = threshold
  let bestY = threshold
  for (const other of others) {
    const dx = Math.abs(other.x - dragged.x)
    if (dx <= bestX) {
      bestX = dx
      x = other.x
      guideX = other.x
    }
    const dy = Math.abs(other.y - dragged.y)
    if (dy <= bestY) {
      bestY = dy
      y = other.y
      guideY = other.y
    }
  }
  return { x, y, guideX, guideY }
}
