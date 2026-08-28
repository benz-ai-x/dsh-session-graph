import { describe, expect, it, vi } from 'vitest'
import { apply as nodeApply } from '@benz-ai-x/dsh-client-ui-session-graph'
import * as SessionGraphInvariant from '@benz-ai-x/dsh-client-ui-session-graph/invariant'

describe('invariant companion', () => {
  it('reserves the published package name with an empty installer', async () => {
    const dispose = vi.fn()
    const register = vi.fn(() => dispose)
    const result = await SessionGraphInvariant.apply({ invariants: { register } } as never)
    expect(register).toHaveBeenCalledWith(
      '@benz-ai-x/dsh-client-ui-session-graph',
      expect.any(Function),
    )
    expect(result).toBe(dispose)
  })

  it('keeps the Node loader entry free of Host behavior', () => {
    expect(() => { nodeApply() }).not.toThrow()
  })
})
