import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Tests use the core source directly, so they run without building the packages first.
  resolve: { alias: { '@formknit/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)) } },
  // The embedded PostgreSQL used by `test:postgres` can take half a minute to start, and password
  // hashing makes the role tests slow on busy machines.
  test: { hookTimeout: 120000, testTimeout: 30000 },
})
