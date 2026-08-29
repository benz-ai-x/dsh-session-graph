/**
 * Pure free-viewport math: screen = content × scale + pan, with anchored
 * zoom, screen-space panning, and content fitting. React-free; GraphCanvas
 * owns the interaction handlers and feeds every gesture through these
 * functions so the geometry is pinned by unit tests.
 * @module @benz-ai-x/dsh-client-ui-session-graph/src/client/viewport
 */
import type { ContentBounds } from './layout.ts'

/** Zoom-out floor as a fraction of 1. */
export const SCALE_MIN = 0.2
/** Zoom-in ceiling as a fraction of 1. */
export const SCALE_MAX = 3

/** One viewport state: content-to-screen scale plus screen-space translation. */
export interface Viewport {
  readonly scale: number
  readonly panX: number
  readonly panY: number
}

/** The identity viewport: 100% at the origin.
 * @returns the initial viewport.
 */
export function initialViewport(): Viewport {
  return { scale: 1, panX: 0, panY: 0 }
}

/**
 * Clamp one scale into the fixed bounds.
 * @param scale - requested scale.
 * @returns the clamped scale.
 */
export function clampScale(scale: number): number {
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale))
}

/**
 * Zoom by a multiplicative factor while keeping the content point under the
 * anchor fixed (the content under the cursor does not drift).
 * @param viewport - the current viewport.
 * @param anchorX - anchor position in screen px.
 * @param anchorY - anchor position in screen px.
 * @param factor - multiplicative zoom factor (>1 zooms in).
 * @returns the next viewport.
 */
export function zoomAt(
  viewport: Viewport,
  anchorX: number,
  anchorY: number,
  factor: number,
): Viewport {
  const scale = clampScale(viewport.scale * factor)
  const contentX = (anchorX - viewport.panX) / viewport.scale
  const contentY = (anchorY - viewport.panY) / viewport.scale
  return {
    scale,
    panX: anchorX - contentX * scale,
    panY: anchorY - contentY * scale,
  }
}

/**
 * Pan by screen-space deltas; the scale is untouched.
 * @param viewport - the current viewport.
 * @param dx - horizontal screen delta in px.
 * @param dy - vertical screen delta in px.
 * @returns the next viewport.
 */
export function panBy(viewport: Viewport, dx: number, dy: number): Viewport {
  return { scale: viewport.scale, panX: viewport.panX + dx, panY: viewport.panY + dy }
}

/** One measured viewport surface extent in screen px. */
export interface ViewportSize {
  readonly width: number
  readonly height: number
}

/**
 * Preserve the content point at the viewport center while its surface changes
 * size. Scale stays untouched; pan moves by half the screen-size delta.
 * @param viewport - the current viewport.
 * @param previous - the previous surface size.
 * @param next - the next surface size.
 * @returns the center-preserving viewport.
 */
export function resizeViewport(
  viewport: Viewport,
  previous: ViewportSize,
  next: ViewportSize,
): Viewport {
  return {
    scale: viewport.scale,
    panX: viewport.panX + (next.width - previous.width) / 2,
    panY: viewport.panY + (next.height - previous.height) / 2,
  }
}

/**
 * Fit the content box into the view box with symmetric padding, centered.
 * The fit scale is clamped to the floor and to 100% (tiny content never
 * zooms past identity).
 * @param content - complete content bounds in canvas coordinates.
 * @param viewWidth - viewport element extent in px.
 * @param viewHeight - viewport element extent in px.
 * @param padding - symmetric inset in px.
 * @returns the fitted viewport.
 */
export function fitViewport(
  content: ContentBounds,
  viewWidth: number,
  viewHeight: number,
  padding: number,
): Viewport {
  const roomWidth = Math.max(1, viewWidth - 2 * padding)
  const roomHeight = Math.max(1, viewHeight - 2 * padding)
  const scale = clampScale(Math.min(
    roomWidth / Math.max(1, content.width),
    roomHeight / Math.max(1, content.height),
    1,
  ))
  return {
    scale,
    panX: (viewWidth - content.width * scale) / 2 - content.x * scale,
    panY: (viewHeight - content.height * scale) / 2 - content.y * scale,
  }
}

/** The content-to-minimap projection: scale plus centering offsets. */
export interface MinimapProjection {
  readonly scale: number
  readonly offsetX: number
  readonly offsetY: number
}

/**
 * Project the content box into the minimap room, contain-fit and centered,
 * capped at 100%. Empty content centers the identity projection.
 * @param content - complete content bounds in canvas coordinates.
 * @param roomWidth - minimap drawing room in px.
 * @param roomHeight - minimap drawing room in px.
 * @returns the projection applied to content coordinates.
 */
export function minimapProjection(
  content: ContentBounds,
  roomWidth: number,
  roomHeight: number,
): MinimapProjection {
  if (content.width <= 0 || content.height <= 0) {
    return {
      scale: 1,
      offsetX: roomWidth / 2 - content.x,
      offsetY: roomHeight / 2 - content.y,
    }
  }
  const scale = Math.min(roomWidth / content.width, roomHeight / content.height, 1)
  return {
    scale,
    offsetX: (roomWidth - content.width * scale) / 2 - content.x * scale,
    offsetY: (roomHeight - content.height * scale) / 2 - content.y * scale,
  }
}
