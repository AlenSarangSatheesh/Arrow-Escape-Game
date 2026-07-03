/**
 * Zero-dependency static development server for Arrow Escape.
 *
 * Serves the project root over HTTP with correct MIME types so that native
 * ES modules load without a bundler. Usage: `npm start` then open the printed URL.
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT) || 5173;
const HOST = process.env.HOST || 'localhost';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

/** Resolve a request URL to a safe path inside ROOT, or null if it escapes. */
function safePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const candidate = normalize(join(ROOT, clean));
  if (!candidate.startsWith(ROOT)) return null;
  return candidate;
}

const server = http.createServer(async (req, res) => {
  try {
    let filePath = safePath(req.url || '/');
    if (!filePath) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    let info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) {
      filePath = join(filePath, 'index.html');
      info = await stat(filePath).catch(() => null);
    }
    if (!info) {
      // Fall back to index.html so client-side routing works.
      filePath = join(ROOT, 'index.html');
      info = await stat(filePath).catch(() => null);
      if (!info) {
        res.writeHead(404).end('Not found');
        return;
      }
    }
    const body = await readFile(filePath);
    const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500).end('Internal server error');
    console.error(err);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Arrow Escape dev server running at http://${HOST}:${PORT}`);
  console.log('Press Ctrl+C to stop.');
});
