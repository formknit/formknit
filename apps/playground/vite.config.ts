import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const src = (path: string) => fileURLToPath(new URL(`../../packages/${path}`, import.meta.url))

// The playground runs the packages from source, so edits show up without a build.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@formknit/react/styles.css', replacement: src('react/src/styles.css') },
      { find: '@formknit/react', replacement: src('react/src/index.ts') },
      { find: '@formknit/core', replacement: src('core/src/index.ts') },
    ],
  },
})
