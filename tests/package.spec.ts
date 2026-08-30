import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

interface PackageMetadata {
  name: string
  files: string[]
  exports: Record<string, string | {
    readonly types: string
    readonly default: string
  }>
  dsh: {
    bundle: { patch: string }
    client: { platform: string }
  }
}

describe('published package metadata', () => {
  it('mounts the browser plugin from its own bundle patch', () => {
    const metadata = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as PackageMetadata
    const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')

    expect(metadata.name).toBe('@benz-ai-x/dsh-client-ui-session-graph')
    expect(metadata.dsh).toMatchObject({
      bundle: { patch: './cordis.patch.yml' },
      client: { platform: 'web' },
    })
    expect(metadata.files).toContain('cordis.patch.yml')
    expect(patch).toContain(`name: '${metadata.name}'`)
  })

  it('ships declarations for every JavaScript package entry', () => {
    const metadata = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as PackageMetadata
    const entries = ['.', './invariant', './client'] as const

    for (const entry of entries) {
      const exported = metadata.exports[entry]
      expect(exported).toEqual(expect.objectContaining({
        types: expect.stringMatching(/^\.\/lib\/types\/.+\.d\.ts$/u),
        default: expect.stringMatching(/^\.\/lib\/.+\.js$/u),
      }))
      if (typeof exported === 'string') throw new Error(`missing types export for ${entry}`)
      expect(readFileSync(new URL(`..${exported.types.slice(1)}`, import.meta.url), 'utf8'))
        .toContain('export')
    }
    expect(metadata.files).toContain('lib/types/**/*.d.ts')
  })
})
