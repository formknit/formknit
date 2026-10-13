import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const src = (path: string) => fileURLToPath(new URL(`../../packages/${path}`, import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Run the packages from source, so edits show up without a build.
    alias: [
      { find: '@formknit/richtext/styles.css', replacement: src('richtext/src/styles.css') },
      { find: '@formknit/richtext', replacement: src('richtext/src/index.ts') },
      { find: '@formknit/builder/styles.css', replacement: src('builder/src/styles.css') },
      { find: '@formknit/builder', replacement: src('builder/src/index.ts') },
      { find: '@formknit/react/styles.css', replacement: src('react/src/styles.css') },
      { find: '@formknit/react', replacement: src('react/src/index.ts') },
      { find: '@formknit/core', replacement: src('core/src/index.ts') },
    ],
  },
  // The API is served from the same origin as the app, so the session cookie is first-party.
  server: { proxy: { '/api': 'http://localhost:8787' } },
})
