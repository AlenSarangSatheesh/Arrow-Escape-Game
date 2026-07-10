import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// `dev.html` is the source entry (dev server + build input). The build inlines its output into a
// single self-contained `index.html` at the repo root (see scripts/build-static.mjs), which is what
// GitHub Pages serves in "deploy from a branch" mode — no separate assets, no server-side build.
export default defineConfig({
  base: './',
  server: { port: 5173, host: true, open: '/dev.html' },
  build: {
    target: 'es2020',
    rollupOptions: { input: resolve(__dirname, 'dev.html') },
  },
})
