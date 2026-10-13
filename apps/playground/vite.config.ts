import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const src = (path: string) => fileURLToPath(new URL(`../../packages/${path}`, import.meta.url))

// The playground runs the packages from source, so edits show up without a build.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@formknit/adapter-mui', replacement: src('adapter-mui/src/index.tsx') },
      { find: '@formknit/richtext/styles.css', replacement: src('richtext/src/styles.css') },
      { find: '@formknit/richtext', replacement: src('richtext/src/index.ts') },
      { find: '@formknit/builder/styles.css', replacement: src('builder/src/styles.css') },
      { find: '@formknit/builder', replacement: src('builder/src/index.ts') },
      { find: '@formknit/react/styles.css', replacement: src('react/src/styles.css') },
      { find: '@formknit/react', replacement: src('react/src/index.ts') },
      { find: '@formknit/core', replacement: src('core/src/index.ts') },
    ],
  },
})
