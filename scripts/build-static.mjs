// Turns the Vite build (dist/dev.html + dist/assets/*) into a single self-contained index.html.
// It writes that file to two places:
//   - the repo root, so GitHub Pages "deploy from a branch" serves it directly, and so the file
//     can be opened straight from disk;
//   - dist/index.html (replacing dev.html + assets/), so the GitHub Actions workflow can upload
//     dist/ as the Pages artifact.
// This makes deployment work whichever Pages "source" mode the repo happens to be in.
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
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

// Root copy (branch-mode / open-from-disk).
writeFileSync(resolve(root, 'index.html'), html)

// Clean dist down to a single self-contained index.html (the Actions artifact).
rmSync(resolve(dist, 'assets'), { recursive: true, force: true })
rmSync(resolve(dist, htmlName), { force: true })
writeFileSync(resolve(dist, 'index.html'), html)

console.log(`build-static: wrote self-contained index.html (${(html.length / 1024).toFixed(1)} kB) to root and dist/`)
