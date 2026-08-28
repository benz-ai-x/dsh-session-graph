import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

interface PackageMetadata {
  name: string
  files: string[]
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
})
