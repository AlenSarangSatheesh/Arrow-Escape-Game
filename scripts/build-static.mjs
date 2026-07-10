// Turns the Vite build (dist/dev.html + dist/assets/*) into a single self-contained index.html at
// the repo root. GitHub Pages serves that root file directly in "deploy from a branch" mode, so no
// server-side build or separate asset files are needed.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')

const htmlName = readdirSync(dist).find((f) => f.endsWith('.html'))
if (!htmlName) throw new Error('no built .html found in dist/')

let html = readFileSync(resolve(dist, htmlName), 'utf8')

// Inline every built stylesheet: <link rel="stylesheet" ... href="./assets/x.css"> -> <style>…</style>
html = html.replace(
  /<link\b[^>]*\bhref="\.?\/?(assets\/[^"]+\.css)"[^>]*>/g,
  (_m, href) => `<style>${readFileSync(resolve(dist, href), 'utf8')}</style>`,
)

// Inline every built module script: <script type="module" ... src="./assets/x.js"></script>
html = html.replace(
  /<script\b[^>]*\bsrc="\.?\/?(assets\/[^"]+\.js)"[^>]*><\/script>/g,
  (_m, src) => `<script type="module">${readFileSync(resolve(dist, src), 'utf8')}</script>`,
)

writeFileSync(resolve(root, 'index.html'), html)
console.log(`build-static: wrote self-contained index.html (${(html.length / 1024).toFixed(1)} kB)`)
