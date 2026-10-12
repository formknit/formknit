import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url))

// The adapter is shipped as source that imports your project's shadcn components from "@/components/ui".
// The tests point that alias at small stand-ins with the same props.
export default defineConfig({
  resolve: {
    alias: {
      '@formknit/core': at('../core/src/index.ts'),
      '@formknit/react': at('../react/src/index.ts'),
      '@': at('./tests/stubs'),
    },
  },
  test: { include: ['tests/**/*.test.tsx'], environment: 'jsdom' },
})
