/** Screen-space rectangle used to anchor a hover preview. */
export interface PreviewAnchor {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Screen-space size in CSS pixels. */
export interface PreviewSize {
  readonly width: number
  readonly height: number
}

/** One resolved preview position and the side it occupies. */
export interface PreviewPlacement {
  readonly x: number
  readonly y: number
  readonly side: 'right' | 'left' | 'bottom' | 'top'
}

/** Canvas edges unavailable to a preview, in screen px. */
export interface PreviewInsets {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

/** Inputs for placing a Canvas Session hover preview. */
export interface PreviewPlacementInput {
  readonly anchor: PreviewAnchor
  readonly preview: PreviewSize
  readonly surface: PreviewSize
  readonly insets?: Partial<PreviewInsets>
}

/** Place a hover preview beside its Canvas Session in screen space. */
export function placePreview({
  anchor, preview, surface, insets = {},
}: PreviewPlacementInput): PreviewPlacement {
  const topBound = insets.top ?? 12
  const leftBound = insets.left ?? 12
  const rightBound = surface.width - (insets.right ?? 12)
  const bottomBound = surface.height - (insets.bottom ?? 12)
  const right = anchor.x + anchor.width + 12
  const y = Math.min(
    Math.max(anchor.y, topBound),
    Math.max(topBound, bottomBound - preview.height),
  )
  if (right + preview.width <= rightBound) {
    return {
      x: right,
      y,
      side: 'right',
    }
  }
  const left = anchor.x - preview.width - 12
  if (left >= leftBound) {
    return {
      x: left,
      y,
      side: 'left',
    }
  }
  const centeredX = anchor.x + (anchor.width - preview.width) / 2
  const x = Math.min(
    Math.max(centeredX, leftBound),
    Math.max(leftBound, rightBound - preview.width),
  )
  const bottom = anchor.y + anchor.height + 12
  if (bottom + preview.height <= bottomBound) {
    return { x, y: bottom, side: 'bottom' }
  }
  return {
    x,
    y: Math.max(topBound, anchor.y - preview.height - 12),
    side: 'top',
  }
}
