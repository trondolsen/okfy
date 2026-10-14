import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import paths from './paths.cjs';

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.htm', 'text/html; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.markdown', 'text/markdown; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.csv', 'text/csv; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.pdf', 'application/pdf'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.wasm', 'application/wasm'],
]);

const errorMessages = new Map([
  [400, 'Ugyldig forespørsel.\n'],
  [403, 'Tilgang nektet.\n'],
  [404, 'Fant ikke filen.\n'],
  [405, 'Metoden er ikke tillatt.\n'],
  [500, 'Intern serverfeil.\n'],
]);

class RequestError extends Error {
  constructor(statusCode) {
    super(errorMessages.get(statusCode));
    this.statusCode = statusCode;
  }
}

function requestPath(url) {
  let pathname;
  try {
    // URL-parseren normaliserer bort «..»; kontroller derfor råstien først.
    pathname = decodeURIComponent(url.split('?')[0]);
  } catch {
    throw new RequestError(400);
  }
  if (!pathname.startsWith('/') || pathname.includes('\0')) {
    throw new RequestError(400);
  }
  if (pathname.includes('\\') || pathname.split('/').includes('..')) {
    throw new RequestError(403);
  }
  return pathname;
}

function requireInsideRoot(root, filename) {
  const path = relative(root, filename);
  if (path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) {
    throw new RequestError(403);
  }
}

function sendError(request, response, statusCode) {
  if (response.destroyed) return;
  if (response.headersSent) {
    response.destroy();
    return;
  }
  const body = Buffer.from(errorMessages.get(statusCode));
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': body.length,
    'X-Content-Type-Options': 'nosniff',
    ...(statusCode === 405 ? { Allow: 'GET, HEAD' } : {}),
  });
  response.end(request.method === 'HEAD' ? undefined : body);
}

export function createStaticServer(root) {
  const rootPath = resolve(root);

  async function serve(request, response) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      throw new RequestError(405);
    }

    const pathname = requestPath(request.url);
    const canonicalRoot = await realpath(rootPath);
    const requestedFile = resolve(canonicalRoot, `.${pathname}`);
    requireInsideRoot(canonicalRoot, requestedFile);

    let filename = await realpath(requestedFile);
    requireInsideRoot(canonicalRoot, filename);
    let info = await stat(filename);
    if (info.isDirectory()) {
      filename = await realpath(join(filename, 'index.html'));
      requireInsideRoot(canonicalRoot, filename);
      info = await stat(filename);
    }
    if (!info.isFile()) throw new RequestError(404);

    const body = request.method === 'HEAD' ? undefined : await readFile(filename);
    if (response.destroyed) return;
    response.writeHead(200, {
      'Content-Type': contentTypes.get(extname(filename).toLowerCase()) ?? 'application/octet-stream',
      'Content-Length': body === undefined ? info.size : body.length,
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(body);
  }

  return createServer((request, response) => {
    void serve(request, response).catch(error => {
      let statusCode = error.statusCode ?? 500;
      if (['ENOENT', 'ENOTDIR', 'ELOOP'].includes(error.code)) statusCode = 404;
      if (['EACCES', 'EPERM'].includes(error.code)) statusCode = 403;
      if (statusCode === 500) console.error('Kunne ikke behandle forespørselen:', error);
      sendError(request, response, statusCode);
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = paths.repositoryRoot;
  const server = createStaticServer(root);
  server.on('error', error => {
    console.error('Kunne ikke starte den lokale serveren:', error.message);
    process.exitCode = 1;
  });
  server.listen(8080, '127.0.0.1', () => {
    console.log(`Lokal server: http://127.0.0.1:8080 (rot: ${root})`);
  });
}
