import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@formknit/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)) } },
  test: { include: ['tests/**/*.test.ts'] },
})
