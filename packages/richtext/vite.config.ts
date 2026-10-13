import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const src = (pkg: string) => fileURLToPath(new URL(`../${pkg}/src/index.ts`, import.meta.url))

export default defineConfig(({ command }) => ({
  // In development and tests, use the other packages' source directly so they do not need building first.
  resolve: command === 'build' ? {} : { alias: { '@formknit/core': src('core'), '@formknit/react': src('react') } },
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    rollupOptions: { external: [/^react($|\/)/, /^react-dom($|\/)/, /^@formknit\//, /^@tiptap\//] },
  },
  test: { include: ['tests/**/*.test.tsx'], environment: 'jsdom', testTimeout: 30000 },
}))
