import { defineConfig } from 'vitest/config'

export default defineConfig({
  // The embedded PostgreSQL used by `test:postgres` can take half a minute to start.
  test: { hookTimeout: 120000 },
})
