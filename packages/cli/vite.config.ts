import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const core = fileURLToPath(new URL('../core/src/index.ts', import.meta.url))

export default defineConfig(({ command }) => ({
  resolve: command === 'build' ? {} : { alias: { '@formknit/core': core } },
  build: {
    target: 'node20',
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: () => 'index.js' },
    rollupOptions: { external: [/^node:/, '@formknit/core'] },
  },
  test: { include: ['tests/**/*.test.ts'] },
}))
