import { describe, expect, it } from 'vitest'
import { placePreview } from '../src/client/preview-placement.ts'

describe('preview placement', () => {
  it('places the preview to the right of its Canvas Session when space is available', () => {
    expect(placePreview({
      anchor: { x: 100, y: 80, width: 240, height: 56 },
      preview: { width: 240, height: 112 },
      surface: { width: 900, height: 600 },
    })).toEqual({ x: 352, y: 80, side: 'right' })
  })

  it('flips the preview to the left when the right side would overflow', () => {
    expect(placePreview({
      anchor: { x: 400, y: 80, width: 240, height: 56 },
      preview: { width: 240, height: 112 },
      surface: { width: 700, height: 600 },
    })).toEqual({ x: 148, y: 80, side: 'left' })
  })

  it('keeps the preview inside the vertical canvas padding', () => {
    expect(placePreview({
      anchor: { x: 100, y: 540, width: 240, height: 56 },
      preview: { width: 240, height: 112 },
      surface: { width: 900, height: 600 },
    })).toEqual({ x: 352, y: 476, side: 'right' })
  })

  it('treats the Selected Session inspector as reserved canvas space', () => {
    expect(placePreview({
      anchor: { x: 400, y: 80, width: 240, height: 56 },
      preview: { width: 240, height: 112 },
      surface: { width: 900, height: 600 },
      insets: { right: 300 },
    })).toEqual({ x: 148, y: 80, side: 'left' })
  })

  it('uses the space below when neither horizontal side can fit', () => {
    expect(placePreview({
      anchor: { x: 130, y: 100, width: 240, height: 56 },
      preview: { width: 240, height: 112 },
      surface: { width: 500, height: 600 },
    })).toEqual({ x: 130, y: 168, side: 'bottom' })
  })

  it('flips above when horizontal sides and the space below are unavailable', () => {
    expect(placePreview({
      anchor: { x: 130, y: 430, width: 240, height: 56 },
      preview: { width: 240, height: 112 },
      surface: { width: 500, height: 600 },
    })).toEqual({ x: 130, y: 306, side: 'top' })
  })
})
