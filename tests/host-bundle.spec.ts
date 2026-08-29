import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Host bundle', () => {
  it('lowers the Remote decorator while keeping Harness runtime packages external', () => {
    const code = readFileSync('lib/index.js', 'utf8')

    expect(code).not.toContain('@Remote')
    expect(code).toContain('Remote("generate")')
    expect(code).toContain('from "@deepseek-ai/dsh-llm"')
    expect(code).toContain('from "@deepseek-ai/dsh-typert-protocol"')
  })
})
