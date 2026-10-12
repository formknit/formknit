import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const core = fileURLToPath(new URL('../core/src/index.ts', import.meta.url))

export default defineConfig(({ command }) => ({
  // In development and tests, use the core source directly so it does not need building first.
  resolve: command === 'build' ? {} : { alias: { '@formknit/core': core } },
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    rollupOptions: { external: ['react', 'react-dom', 'react/jsx-runtime', '@formknit/core'] },
  },
  test: { include: ['tests/**/*.test.tsx'], environment: 'jsdom', testTimeout: 30000 },
}))
