import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { createStaticServer } from '../support/serve.mjs';
import paths from '../support/paths.cjs';

const { repositoryRoot } = paths;

async function startServer(t, root) {
  const server = createStaticServer(root);
  assert.equal(server.listening, false);
  t.after(async () => {
    if (!server.listening) return;
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  assert.equal(server.address().address, '127.0.0.1');
  return server.address().port;
}

function getResponse(port, path, method = 'GET') {
  return new Promise((resolve, reject) => {
    // http.request bevarer råstien slik at «..» faktisk når serveren.
    const req = request({ hostname: '127.0.0.1', port, path, method, agent: false }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('aborted', () => reject(new Error('Svaret ble avbrutt.')));
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks),
      }));
    });
    req.setTimeout(5000, () => req.destroy(new Error('Forespørselen tok for lang tid.')));
    req.on('error', reject);
    req.end();
  });
}

async function fixture(t, files = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'okf-static-server-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = join(directory, 'root');
  // Lik navneprefiks avdekker usikre startsWith-kontroller av rotgrensen.
  const outside = join(directory, 'root-external');
  await mkdir(root);
  await mkdir(outside);
  await writeFile(join(outside, 'hemmelig.md'), 'Dette skal ikke kunne leses.');
  for (const [filename, content] of Object.entries(files)) {
    const path = join(root, filename);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }
  return { root, outside };
}

test('serverer den faktiske utforskerfilen og Markdown fra repositoriet', { timeout: 10000 }, async t => {
  const port = await startServer(t, repositoryRoot);
  for (const [path, type] of [
    ['okfy.html', 'text/html; charset=utf-8'],
    ['index.md', 'text/markdown; charset=utf-8'],
  ]) {
    const expected = await readFile(join(repositoryRoot, path));
    const get = await getResponse(port, `/${path}?offline=1`);
    assert.equal(get.status, 200);
    assert.equal(get.headers['content-type'], type);
    assert.equal(get.headers['content-length'], String(expected.length));
    assert.deepEqual(get.body, expected);

    const head = await getResponse(port, `/${path}`, 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.headers['content-type'], type);
    assert.equal(head.headers['content-length'], get.headers['content-length']);
    assert.equal(head.body.length, 0);
  }
});

test('GET og HEAD har riktige innholdstyper og byte-lengder', { timeout: 10000 }, async t => {
  const files = [
    ['side.HTML', '<h1>Ærlig prøve</h1>', 'text/html; charset=utf-8'],
    ['notat.md', '# Prøve\n', 'text/markdown; charset=utf-8'],
    ['data.json', '{"offline":true}', 'application/json; charset=utf-8'],
    ['app.js', 'export const offline = true;', 'text/javascript; charset=utf-8'],
    ['app.mjs', 'export default true;', 'text/javascript; charset=utf-8'],
    ['stil.css', 'body { color: black; }', 'text/css; charset=utf-8'],
    ['bilde.png', Buffer.from([137, 80, 78, 71]), 'image/png'],
    ['ikon.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>', 'image/svg+xml'],
    ['bilde.jpg', Buffer.from([255, 216, 255, 217]), 'image/jpeg'],
    ['tekst.txt', 'Lokal tekst', 'text/plain; charset=utf-8'],
    ['ukjent.bin', Buffer.from([0, 1, 2, 255]), 'application/octet-stream'],
  ];
  const { root } = await fixture(t, Object.fromEntries(files.map(([name, body]) => [name, body])));
  const port = await startServer(t, root);
  for (const [name, body, type] of files) {
    const expected = Buffer.isBuffer(body) ? body : Buffer.from(body);
    for (const method of ['GET', 'HEAD']) {
      const response = await getResponse(port, `/${name}`, method);
      assert.equal(response.status, 200, `${method} /${name}`);
      assert.equal(response.headers['content-type'], type);
      assert.equal(response.headers['content-length'], String(expected.length));
      assert.equal(response.headers['x-content-type-options'], 'nosniff');
      assert.deepEqual(response.body, method === 'HEAD' ? Buffer.alloc(0) : expected);
    }
  }
});

test('dekoder filnavn én gang og ignorerer spørringsparametere', { timeout: 10000 }, async t => {
  const { root } = await fixture(t, { 'notat æ #.md': '# Ærlig prøve\n' });
  const port = await startServer(t, root);
  const response = await getResponse(port, '/notat%20%C3%A6%20%23.md?sti=../utenfor&feil=%ZZ');
  assert.equal(response.status, 200);
  assert.equal(response.body.toString(), '# Ærlig prøve\n');
  assert.equal(response.headers['content-type'], 'text/markdown; charset=utf-8');
  const encodedTwice = await getResponse(port, '/%252e%252e/root-external/hemmelig.md');
  assert.equal(encodedTwice.status, 404);
});

test('kataloger serverer bare index.html, aldri index.md eller fillister', { timeout: 10000 }, async t => {
  const { root } = await fixture(t, {
    'index.html': '<h1>Rot</h1>',
    'begge/index.html': '<h1>HTML først</h1>',
    'begge/index.md': '# Ikke denne',
    'bare-markdown/index.md': '# Ingen automatisk visning',
    'uten-indeks/annet.txt': 'Ingen filliste',
  });
  const port = await startServer(t, root);
  for (const [path, body] of [
    ['/', '<h1>Rot</h1>'],
    ['/begge', '<h1>HTML først</h1>'],
    ['/begge/', '<h1>HTML først</h1>'],
  ]) {
    const response = await getResponse(port, path);
    assert.equal(response.status, 200);
    assert.equal(response.headers['content-type'], 'text/html; charset=utf-8');
    assert.equal(response.body.toString(), body);
  }
  for (const path of ['/bare-markdown', '/bare-markdown/', '/uten-indeks/']) {
    assert.equal((await getResponse(port, path)).status, 404);
  }
  const head = await getResponse(port, '/begge/', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.headers['content-length'], String(Buffer.byteLength('<h1>HTML først</h1>')));
  assert.equal(head.body.length, 0);
});

test('manglende filer gir 404, og HEAD-feil har ingen svartekst', { timeout: 10000 }, async t => {
  const { root } = await fixture(t, { 'fil.txt': 'En fil' });
  const port = await startServer(t, root);
  for (const path of ['/mangler.md', '/fil.txt/underfil.md']) {
    const get = await getResponse(port, path);
    const head = await getResponse(port, path, 'HEAD');
    assert.equal(get.status, 404);
    assert.equal(head.status, 404);
    assert.equal(get.headers['content-type'], 'text/plain; charset=utf-8');
    assert.equal(head.headers['content-length'], get.headers['content-length']);
    assert.equal(head.body.length, 0);
  }
});

test('avviser andre HTTP-metoder med 405 og Allow', { timeout: 10000 }, async t => {
  const { root } = await fixture(t, { 'index.html': 'Prøve' });
  const port = await startServer(t, root);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const response = await getResponse(port, '/', method);
    assert.equal(response.status, 405, method);
    assert.equal(response.headers.allow, 'GET, HEAD');
  }
});

test('avviser katalogtraversering også med prosentkoding og omvendt skråstrek', { timeout: 10000 }, async t => {
  const { root } = await fixture(t, { 'mappe/index.html': 'Innenfor' });
  const port = await startServer(t, root);
  const paths = [
    '/../root-external/hemmelig.md',
    '/%2e%2e/root-external/hemmelig.md',
    '/.%2e/root-external/hemmelig.md',
    '/%2e./root-external/hemmelig.md',
    '/%2E%2E%2Froot-external%2Fhemmelig.md',
    '/mappe/../../root-external/hemmelig.md',
    '/..\\root-external\\hemmelig.md',
    '/%2e%2e%5croot-external%5chemmelig.md',
    '/mappe\\index.html',
    '/mappe%5Cindex.html',
  ];
  for (const path of paths) {
    for (const method of ['GET', 'HEAD']) {
      const response = await getResponse(port, path, method);
      assert.equal(response.status, 403, `${method} ${path}`);
      if (method === 'HEAD') assert.equal(response.body.length, 0);
    }
  }
});

test('ugyldig prosentkoding og nullbyte gir 400 uten å stoppe serveren', { timeout: 10000 }, async t => {
  const { root } = await fixture(t, { 'index.html': 'Fortsatt tilgjengelig' });
  const port = await startServer(t, root);
  for (const path of ['/%', '/%ZZ', '/%C3%28', '/fil%00.md']) {
    assert.equal((await getResponse(port, path)).status, 400, path);
  }
  assert.equal((await getResponse(port, '/')).status, 200);
});

test('avviser eksterne symlenker, også kataloger og index.html', { timeout: 10000 }, async t => {
  const { root, outside } = await fixture(t, { 'lokal.md': '# Innenfor roten' });
  await symlink(join(outside, 'hemmelig.md'), join(root, 'ekstern.md'));
  await symlink(outside, join(root, 'ekstern-mappe'), 'dir');
  await mkdir(join(root, 'indeks'));
  await symlink(join(outside, 'hemmelig.md'), join(root, 'indeks', 'index.html'));
  await symlink(join(root, 'lokal.md'), join(root, 'intern.md'));
  const port = await startServer(t, root);
  for (const path of ['/ekstern.md', '/ekstern-mappe/', '/ekstern-mappe/hemmelig.md', '/indeks/']) {
    for (const method of ['GET', 'HEAD']) {
      const response = await getResponse(port, path, method);
      assert.equal(response.status, 403, `${method} ${path}`);
      if (method === 'HEAD') assert.equal(response.body.length, 0);
    }
  }
  const internal = await getResponse(port, '/intern.md');
  assert.equal(internal.status, 200);
  assert.equal(internal.body.toString(), '# Innenfor roten');
});
