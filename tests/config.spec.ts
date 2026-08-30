import { describe, expect, it } from 'vitest'
import { Config, resolveConfig } from '../src/config.ts'

describe('Session Graph configuration', () => {
  it('publishes Loader defaults through one runtime Standard Schema', () => {
    expect(Config).toHaveProperty('~standard')
    expect(Config({})).toEqual({
      maxOutputTokens: 800,
      timeoutMs: 60_000,
    })
  })

  it('rejects partial routes and non-positive integer limits at the schema boundary', () => {
    expect(() => Config({ provider: 'deepseek' })).toThrow()
    expect(() => Config({ provider: '   ', model: 'chat' })).toThrow()
    expect(() => Config({ maxOutputTokens: 1.5 })).toThrow()
    expect(() => Config({ timeoutMs: 0 })).toThrow()
  })

  it('normalizes the validated route before runtime use', () => {
    expect(resolveConfig(Config({
      provider: '  deepseek  ',
      model: '  chat  ',
      maxOutputTokens: 1_200,
      timeoutMs: 45_000,
    }))).toEqual({
      route: { provider: 'deepseek', model: 'chat' },
      maxOutputTokens: 1_200,
      timeoutMs: 45_000,
    })
  })
})
