import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const src = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url))

export default defineConfig(({ command }) => ({
  // In development and tests, use the sibling packages from source so they do not need building first.
  resolve:
    command === 'build'
      ? {}
      : { alias: { '@formknit/core': src('core/src/index.ts'), '@formknit/react': src('react/src/index.ts') } },
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    rollupOptions: { external: ['react', 'react-dom', 'react/jsx-runtime', '@formknit/core', '@formknit/react'] },
  },
  test: { include: ['tests/**/*.test.{ts,tsx}'], environment: 'jsdom' },
}))
