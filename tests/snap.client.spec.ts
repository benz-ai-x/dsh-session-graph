import { describe, expect, it } from 'vitest'
import { snapPosition } from '../src/client/snap.ts'

describe('snapPosition', () => {
  it('snaps each axis independently to the node edge within the threshold', () => {
    const result = snapPosition({ x: 5, y: 94 }, [{ x: 0, y: 100 }], 6)
    expect(result).toEqual({ x: 0, y: 100, guideX: 0, guideY: 100 })
  })

  it('leaves axes beyond the threshold untouched and guideless', () => {
    const result = snapPosition({ x: 80, y: 200 }, [{ x: 0, y: 100 }], 6)
    expect(result).toEqual({ x: 80, y: 200, guideX: null, guideY: null })
  })

  it('snaps at the exact threshold boundary', () => {
    const result = snapPosition({ x: 6, y: 106 }, [{ x: 0, y: 100 }], 6)
    expect(result).toEqual({ x: 0, y: 100, guideX: 0, guideY: 100 })
  })

  it('prefers the nearest candidate when several edges are in range', () => {
    const result = snapPosition({ x: 104, y: 0 }, [{ x: 100, y: 40 }, { x: 98, y: 50 }], 6)
    expect(result.x).toBe(100)
    expect(result.guideX).toBe(100)
  })
})
