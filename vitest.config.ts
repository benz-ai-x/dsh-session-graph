import { defineConfig } from 'vitest/config'

const execArgv = process.allowedNodeEnvironmentFlags.has('--webstorage') ? ['--no-webstorage'] : []

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.{ts,tsx}'],
    exclude: ['tests/views.client.spec.tsx'],
    execArgv,
    pool: 'forks',
  },
})
