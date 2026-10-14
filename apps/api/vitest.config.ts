import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Tests use the core source directly, so they run without building the packages first.
  resolve: { alias: { '@formknit/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)) } },
  // The embedded PostgreSQL used by `test:postgres` can take half a minute to start.
  test: { hookTimeout: 120000 },
})
