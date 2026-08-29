import { describe, expect, it } from 'vitest'
import {
  SCALE_MAX, SCALE_MIN, clampScale, fitViewport, initialViewport, minimapProjection, panBy,
  resizeViewport, zoomAt,
} from '../src/client/viewport.ts'

describe('initialViewport', () => {
  it('starts at identity', () => {
    expect(initialViewport()).toEqual({ scale: 1, panX: 0, panY: 0 })
  })
})

describe('clampScale', () => {
  it('clamps to the fixed bounds', () => {
    expect(clampScale(0.01)).toBe(SCALE_MIN)
    expect(clampScale(99)).toBe(SCALE_MAX)
    expect(clampScale(0.5)).toBe(0.5)
  })
})

describe('zoomAt', () => {
  it('keeps the content point under the anchor fixed while scaling', () => {
    const before = { scale: 1, panX: 40, panY: -20 }
    const anchorX = 320
    const anchorY = 240
    const after = zoomAt(before, anchorX, anchorY, 1.25)
    const contentXBefore = (anchorX - before.panX) / before.scale
    const contentYBefore = (anchorY - before.panY) / before.scale
    const contentXAfter = (anchorX - after.panX) / after.scale
    const contentYAfter = (anchorY - after.panY) / after.scale
    expect(after.scale).toBeCloseTo(1.25)
    expect(contentXAfter).toBeCloseTo(contentXBefore)
    expect(contentYAfter).toBeCloseTo(contentYBefore)
  })

  it('clamps the resulting scale to the bounds and anchors at the clamped scale', () => {
    const atMax = zoomAt({ scale: 2.8, panX: 0, panY: 0 }, 100, 100, 2)
    expect(atMax.scale).toBe(SCALE_MAX)
    const atMin = zoomAt({ scale: 0.25, panX: 0, panY: 0 }, 100, 100, 0.5)
    expect(atMin.scale).toBe(SCALE_MIN)
  })
})

describe('panBy', () => {
  it('moves the pan by screen-space deltas without touching the scale', () => {
    const after = panBy({ scale: 2, panX: 10, panY: 10 }, -30, 45)
    expect(after).toEqual({ scale: 2, panX: -20, panY: 55 })
  })
})

describe('resizeViewport', () => {
  it('keeps the same content point at the center when the surface resizes', () => {
    const before = { scale: 0.8, panX: 120, panY: -40 }
    const previousSize = { width: 1000, height: 600 }
    const nextSize = { width: 480, height: 700 }
    const after = resizeViewport(before, previousSize, nextSize)

    expect(after.scale).toBe(before.scale)
    expect((nextSize.width / 2 - after.panX) / after.scale)
      .toBeCloseTo((previousSize.width / 2 - before.panX) / before.scale)
    expect((nextSize.height / 2 - after.panY) / after.scale)
      .toBeCloseTo((previousSize.height / 2 - before.panY) / before.scale)
  })
})

describe('fitViewport', () => {
  it('centers the content with padding and never zooms past 100%', () => {
    const fit = fitViewport({ x: 0, y: 0, width: 1000, height: 600 }, 500, 400, 40)
    // Available room: 500-80=420 by 400-80=320 → scale = min(0.42, 0.533).
    expect(fit.scale).toBeCloseTo(0.42)
    expect(fit.panX).toBeCloseTo((500 - 1000 * fit.scale) / 2)
    expect(fit.panY).toBeCloseTo((400 - 600 * fit.scale) / 2)
  })

  it('caps the fit scale at 100% for tiny content', () => {
    const fit = fitViewport({ x: 0, y: 0, width: 100, height: 80 }, 800, 600, 24)
    expect(fit.scale).toBe(1)
    expect(fit.panX).toBeCloseTo((800 - 100) / 2)
    expect(fit.panY).toBeCloseTo((600 - 80) / 2)
  })

  it('never scales below the floor', () => {
    const fit = fitViewport({ x: 0, y: 0, width: 1_000_000, height: 1_000_000 }, 400, 300, 20)
    expect(fit.scale).toBe(SCALE_MIN)
  })

  it('centers bounds whose content origin is left and above zero', () => {
    const bounds = { x: -500, y: -200, width: 700, height: 300 }
    const fit = fitViewport(bounds, 1000, 600, 40)
    expect(bounds.x * fit.scale + fit.panX).toBeCloseTo((1000 - bounds.width * fit.scale) / 2)
    expect(bounds.y * fit.scale + fit.panY).toBeCloseTo((600 - bounds.height * fit.scale) / 2)
  })
})

describe('minimapProjection', () => {
  it('scales content into the map room and centers the remainder', () => {
    const projection = minimapProjection({ x: 0, y: 0, width: 1000, height: 500 }, 160, 120)
    expect(projection.scale).toBeCloseTo(160 / 1000)
    expect(projection.offsetX).toBe(0)
    expect(projection.offsetY).toBeCloseTo((120 - 500 * projection.scale) / 2)
  })

  it('caps the projection at 100% for tiny content', () => {
    const projection = minimapProjection({ x: 0, y: 0, width: 50, height: 20 }, 160, 120)
    expect(projection.scale).toBe(1)
    expect(projection.offsetX).toBeCloseTo((160 - 50) / 2)
    expect(projection.offsetY).toBeCloseTo((120 - 20) / 2)
  })

  it('degenerates to identity for empty content', () => {
    const projection = minimapProjection({ x: 0, y: 0, width: 0, height: 0 }, 160, 120)
    expect(projection.scale).toBe(1)
    expect(projection.offsetX).toBe(80)
    expect(projection.offsetY).toBe(60)
  })

  it('translates negative content coordinates into the map room', () => {
    const bounds = { x: -500, y: -200, width: 700, height: 300 }
    const projection = minimapProjection(bounds, 160, 120)
    const left = bounds.x * projection.scale + projection.offsetX
    const top = bounds.y * projection.scale + projection.offsetY
    expect(left).toBeGreaterThanOrEqual(0)
    expect(top).toBeGreaterThanOrEqual(0)
  })
})
