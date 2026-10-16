// Kjøring: bash tools/node-cli/run.sh --workdir . -- --test test/unit/security.test.cjs
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const zlib = require('node:zlib');

const { explorerPath } = require('../support/paths.cjs');

const html = fs.readFileSync(explorerPath, 'utf8');
const scripts = Array.from(html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi));
assert.equal(scripts.length, 1, 'Expected the actual, single explorer script');
const source = scripts[0][1];
const ROOT = 'https://explorer.test/bundles/security/';

function anchor(text) {
  const index = source.indexOf(text);
  assert.notEqual(index, -1, `Missing production anchor: ${text}`);
  assert.equal(source.indexOf(text, index + text.length), -1, `Ambiguous production anchor: ${text}`);
  return index;
}

function section(name) {
  const match = new RegExp(`^\\s*// -+ ${name}\\s*$`, 'm').exec(source);
  assert.ok(match, `Missing production section: ${name}`);
  return match.index;
}

function between(start, end) {
  assert.ok(end > start, 'Production helper anchors must remain ordered');
  return source.slice(start, end);
}

// Hjelperne kjøres uendret uten IIFE-en; DOM-oppstarten er ikke del av disse testene.
const helperSource = [
  between(section('config'), section('dom')),
  between(section('state'), section('utils')),
  between(section('utils'), section('layout')),
  between(anchor('  function esc('), section('pdf peek')),
  between(section('pdf peek'), section('preview')),
  between(section('load'), anchor('  function urlParam(')),
  between(anchor('  function urlParam('), anchor('  async function loadBundleFromFolder('))
].join('\n');
const helperScript = new vm.Script(`"use strict";\n${helperSource}`, {
  filename: 'okfy.html:actual-helpers'
});

function element() {
  const classes = new Set();
  return {
    textContent: '', innerHTML: '', hidden: false,
    classList: {
      add: name => classes.add(name),
      remove: name => classes.delete(name),
      contains: name => classes.has(name)
    },
    querySelectorAll: () => []
  };
}

function harness(t, overrides = {}) {
  const createdUrls = [], revokedUrls = [], opened = [], errors = [], timers = new Set();
  class MockURL extends URL {
    static createObjectURL(blob) {
      const url = `blob:https://explorer.test/${createdUrls.length + 1}`;
      createdUrls.push({ url, blob });
      return url;
    }
    static revokeObjectURL(url) { revokedUrls.push(url); }
  }
  const noop = () => {};
  const context = vm.createContext({
    URL: MockURL, URLSearchParams, TextEncoder, TextDecoder, AbortController, AbortSignal,
    Blob, Response, DecompressionStream, Uint8Array,
    location: { href: 'https://explorer.test/knowledge/okfy.html',
      origin: 'https://explorer.test', search: '' },
    history: { replaceState: noop },
    window: { console: { error: (...args) => errors.push(args) } },
    console: { error: (...args) => errors.push(args) },
    setTimeout(fn, delay) {
      const timer = setTimeout(fn, delay);
      timers.add(timer);
      return timer;
    },
    clearTimeout(timer) { clearTimeout(timer); timers.delete(timer); },
    fetch: async () => { throw new Error('Unexpected network request in test'); },
    spinnerEl: element(), fetchCountEl: element(),
    preview: element(), pvBody: element(), previewPath: null,
    pvStack: [], pvIndex: -1, pvSuppress: false, pvPushed: false,
    raf: 1, resize: noop, measureDepths: noop, recomputeRadii: noop,
    initialLayout: noop, fitView: noop, applyFocus: noop, relayout: noop,
    computeAllTags: noop, updateStats: noop, updateGraphNav: noop, loop: noop,
    hidePreview: noop, buildLegend: noop,
    renderChips: noop, renderKindChips: noop, renderTypeChips: noop, renderStatusChips: noop,
    tagPop: { render: noop }, kindPop: { render: noop },
    typePop: { render: noop }, statusPop: { render: noop },
    openPreview: node => opened.push(node), renderPreviewEntry: noop
  });
  helperScript.runInContext(context, { timeout: 1000 });
  // The production load helpers report a failed load through reportLoadError, which records it
  // for the generated .runtime/errors.md page; record into loadErrors so the tests can inspect it.
  context.reportLoadError = message => { context.loadErrors.push(String(message == null ? '' : message)); };
  Object.assign(context, overrides);
  t.after(() => { for (const timer of timers) clearTimeout(timer); });
  return { api: context, createdUrls, revokedUrls, opened, errors, timers };
}

function bytes(value) {
  return typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
}

function deferred(t) {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  if (t) t.after(() => resolve());
  return { promise, resolve };
}

function mockStream(chunks, options = {}) {
  const state = { reads: 0, readerCancels: 0, bodyCancels: 0, releases: 0 };
  let index = 0;
  const body = {
    locked: false,
    getReader() {
      assert.equal(body.locked, false, 'A body must not be read twice concurrently');
      body.locked = true;
      return {
        async read() {
          state.reads++;
          if (index === 0) {
            if (options.started) options.started.resolve();
            if (options.gate) await options.gate.promise;
          }
          if (options.error) throw options.error;
          if (index === chunks.length) return { done: true };
          return { done: false, value: bytes(chunks[index++]) };
        },
        async cancel() { state.readerCancels++; },
        releaseLock() { state.releases++; body.locked = false; }
      };
    },
    async cancel() { state.bodyCancels++; }
  };
  return { body, state };
}

function response(url, stream, headers = {}, status = 200) {
  const normalized = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return {
    url, ok: status >= 200 && status < 300, status, body: stream.body,
    headers: { get: name => normalized[name.toLowerCase()] ?? null }
  };
}

function localFile(name, text, options = {}) {
  const stream = mockStream([text]);
  return {
    name, size: options.size ?? bytes(text).byteLength,
    webkitRelativePath: options.path || `bundle/${name}`,
    stream: () => stream.body,
    text: async () => { throw new Error('The streaming loader must not use an unbounded text read'); },
    state: stream.state
  };
}

// Dette er en begrenset attributtdetektor, ikke en HTML-parser eller sanitizer.
// Hele siterte verdier konsumeres, slik at «onerror=» i alt-tekst ikke blir et funn.
function tags(markup) {
  return Array.from(markup.matchAll(/<([a-z][\w:-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi), match => ({
    name: match[1].toLowerCase(),
    attributes: Array.from(match[2].matchAll(/([^\s=/"'<>`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g), attr => ({
      name: attr[1].toLowerCase(), value: attr[2] ?? attr[3] ?? attr[4] ?? ''
    }))
  }));
}

function assertInert(markup) {
  for (const tag of tags(markup)) {
    assert.ok(!['script', 'iframe', 'object', 'embed', 'svg', 'math'].includes(tag.name), `Active tag: ${tag.name}`);
    for (const attr of tag.attributes) {
      assert.ok(!/^on/i.test(attr.name), `Event attribute ${attr.name} in ${markup}`);
      assert.notEqual(attr.name, 'srcdoc');
      if (attr.name === 'href' || attr.name === 'src') {
        assert.ok(!/^\s*(?:javascript|vbscript|data):/i.test(attr.value), `Active URL: ${attr.value}`);
      }
    }
  }
}

function renderInVm(api, text, inline = false) {
  api.testInput = text;
  return vm.runInContext(inline ? 'renderInline(testInput)' : 'renderMarkdown(testInput)', api, { timeout: 1000 });
}

async function flushJobs() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

function assertReservationsReleased(budget) {
  assert.equal(budget.reservedBytes, 0);
  assert.equal(budget.reservedFiles, 0);
  assert.equal(budget.imageReservedBytes, 0);
  assert.equal(budget.textWaiters.length, 0);
  assert.equal(budget.imageWaiters.length, 0);
}

function graphSnapshot(api) {
  return Object.fromEntries([
    'bundleFiles', 'bundleBudget', 'bundleRootUrl', 'bundleKnown', 'bundleGeneration',
    'nodes', 'links', 'allNodes', 'allLinks', 'fileMap', 'dirNodes',
    'graphStack', 'graphIndex', 'graphFocus'
  ].map(key => [key, api[key]]));
}

function assertGraphUnchanged(api, snapshot) {
  for (const [key, value] of Object.entries(snapshot)) assert.equal(api[key], value, key);
}

function assertGraphLimitDiagnostic(api, errors) {
  assert.ok(api.loadErrors.some(message => /graph.*too many (?:nodes|links)/i.test(message)));
  assert.ok(errors.some(args => /too many (?:nodes|links)/i.test(String(args[0] && args[0].message))));
}

function pdfObjectStream(text) {
  const compressed = zlib.deflateSync(Buffer.from(text, 'latin1'));
  return `1 0 obj\n<< /Type /ObjStm /FlateDecode /Length ${compressed.length} >>\nstream\n${compressed.toString('latin1')}\nendstream\nendobj\n`;
}

test('the complete actual HTML script compiles without test exports', () => {
  assert.doesNotThrow(() => new vm.Script(source, { filename: 'okfy.html:complete-script' }));
});

test('attribute detector distinguishes quoted harmless text from real event attributes', () => {
  const harmless = '<img alt="nested onerror=alert(1) &quot; <img onload=x>" data-embed="image.png">';
  assertInert(harmless);
  assert.deepEqual(tags(harmless)[0].attributes.map(attr => attr.name), ['alt', 'data-embed']);
  const embedded = '<img alt="image" data-embed="image.png&quot; onclick=document.title=1337 x=&quot;">';
  assertInert(embedded);
  assert.deepEqual(tags(embedded)[0].attributes.map(attr => attr.name), ['alt', 'data-embed']);
  for (const markup of ['<img onerror="alert(1)">', "<img ONLOAD='alert(1)'>", '<img onerror=alert(1)>', '<img data-embed="image.png" onclick=document.title=1337 x="">']) {
    assert.throws(() => assertInert(markup), /Event attribute/);
  }
});

test('original nested Markdown link and image XSS payloads create no event attributes', t => {
  const { api } = harness(t);
  const payloads = [
    '![[x](x" onerror="alert(1))](image.png)',
    '![x [y](z)](image.png" onerror="alert(1))',
    '[![x](image.png)](note.md" onmouseover="alert(1))',
    '![![x](image.png)](image.png)',
    '![a [b](c)](image.png)',
    '[![x](image.png "onerror=alert(1)")](note.md)'
  ];
  for (const payload of payloads) {
    for (const inline of [false, true]) assertInert(renderInVm(api, payload, inline));
  }
  assert.ok(tags(api.renderInline('![a [b](c)](image.png)')).some(tag => tag.name === 'img'));
});

test('exact audited nested image destination cannot inject an onclick attribute', t => {
  const { api } = harness(t);
  const payload = '[click](![ onclick=document.title=1337 x=](data:,))';
  for (const inline of [false, true]) {
    const markup = renderInVm(api, payload, inline);
    assertInert(markup);
    assert.ok(markup.length < 1024);
    assert.match(markup, /click/);
    assert.ok(!markup.includes(api.markdownLimitNotice));
  }
});

test('two automatic image self references and the exact doubled U+0001 self reference stay inert', t => {
  const { api } = harness(t);
  const payloads = [
    '![\u00010\u0001](data:,)![\u00011\u0001](data:,)',
    '![\u00010\u0001](data:,)![\u00010\u0001\u00010\u0001](data:,)',
    '[\u00010\u0001\u00010\u0001](https://example.invalid/)'
  ];
  for (const payload of payloads) {
    for (const inline of [false, true]) {
      const markup = renderInVm(api, payload, inline);
      assertInert(markup);
      assert.ok(markup.length < 1024);
      assert.ok(!markup.includes('\u0001'));
      assert.match(markup, /\ufffd/);
      if (payload.startsWith('!')) {
        const images = tags(markup).filter(tag => tag.name === 'img');
        assert.equal(images.length, 2);
        assert.ok(images.every(tag => !tag.attributes.some(attr => attr.name === 'src')));
      }
    }
  }
});

test('image and wikilink attribute sinks escape quote-breaking labels and targets', t => {
  const { api } = harness(t);
  const markup = api.renderMarkdown([
    '![" onerror="alert(1)](image.png)',
    '![[image.png|" onload="alert(1)]]',
    '[[note.md|" onclick="alert(1)]]'
  ].join('\n'));
  assertInert(markup);
  assert.match(markup, /&quot;/);
  assert.equal(tags(markup).filter(tag => tag.name === 'img').length, 2);
});

test('forged U+0001 self references are inert and produce only small output', t => {
  const { api } = harness(t);
  for (const payload of ['\u00010\u0001', '![\u00010\u0001](image.png)', '[\u00010\u0001](\u00010\u0001)']) {
    const markup = renderInVm(api, payload);
    assert.ok(markup.length < 1024);
    assert.ok(!markup.includes('\u0001'));
    assert.match(markup, /\ufffd/);
    assertInert(markup);
  }
});

test('raw HTML is escaped and cannot create active tags', t => {
  const { api } = harness(t);
  const markup = api.renderMarkdown('<img src=x onerror="alert(1)">\n<script>alert(1)</script>\n<svg onload=alert(1)>');
  assertInert(markup);
  assert.match(markup, /&lt;img/);
  assert.match(markup, /&lt;script&gt;/);
  assert.equal(tags(markup).filter(tag => tag.name !== 'p' && tag.name !== 'br').length, 0);
});

test('normal headings remain rendered with escaped content', t => {
  const { api } = harness(t);
  assert.equal(api.renderMarkdown('# Heading\n\n## <text>'), '<h1>Heading</h1><h2>&lt;text&gt;</h2>');
});

test('inline and fenced code remain literal, including footnote-looking lines', t => {
  const { api } = harness(t);
  const markup = api.renderMarkdown('`<img onerror=x>`\n\n```js\n[^literal]: <script>\n```');
  assert.match(markup, /<code>&lt;img onerror=x&gt;<\/code>/);
  assert.match(markup, /<pre class="md-pre"><code class="language-js">\[\^literal\]: &lt;script&gt;<\/code><\/pre>/);
  assert.ok(!markup.includes('md-footnotes'));
  assertInert(markup);
});

test('normal internal, HTTPS, mailto and wiki links preserve navigation', t => {
  const { api } = harness(t);
  const markup = api.renderInline('[nested](folder/note.md) [web](https://example.test/docs) [mail](mailto:reader@example.test) [[note.md|Alias]]');
  const anchors = tags(markup).filter(tag => tag.name === 'a');
  assert.equal(anchors.length, 4);
  assert.match(markup, /href="#" data-link="folder\/note.md"/);
  assert.match(markup, /href="https:\/\/example.test\/docs"/);
  assert.match(markup, /rel="noopener noreferrer"/);
  assert.match(markup, /href="mailto:reader@example.test"/);
  assert.match(markup, />Alias<\/a>/);
  assertInert(markup);
});

test('extractLinks and rendered destinations agree on angle paths, balanced parentheses and code', t => {
  const { api } = harness(t);
  const markdown = [
    '[angle](<nested/space name.md>)',
    '[balanced](nested/a(b(c)).md)',
    '[title](nested/titled.md "ignored title")',
    '[code `] inside`](nested/code.md)',
    '![figure](<images/space name.png>)',
    '[[nested/wiki.md|Alias]]',
    '[![literal](ignored.png)](outer.md)',
    '`[inline decoy](inline-hidden.md)`',
    '\\[escaped](escaped-hidden.md)',
    '',
    '```md',
    '[fenced decoy](fenced-hidden.md)',
    '![fenced image](fenced-hidden.png)',
    '```'
  ].join('\n');
  const expected = [
    'nested/space name.md', 'nested/a(b(c)).md', 'nested/titled.md', 'nested/code.md',
    api.EMBED_MARK + 'images/space name.png', 'nested/wiki.md', 'outer.md'
  ];
  const markup = api.renderMarkdown(markdown);
  const rendered = tags(markup).flatMap(tag => tag.attributes
    .filter(attr => attr.name === 'data-link' || attr.name === 'data-embed')
    .map(attr => (attr.name === 'data-embed' ? api.EMBED_MARK : '') + attr.value));
  assert.deepEqual(Array.from(api.extractLinks(markdown)), expected);
  assert.deepEqual(rendered, expected);
  assertInert(markup);
});

test('tables retain alignment and do not split pipes inside code or link labels', t => {
  const { api } = harness(t);
  const markup = api.renderMarkdown('| Name | Value |\n| :--- | ---: |\n| `a|b` | [x|y](note.md) |');
  assert.equal(tags(markup).filter(tag => tag.name === 'th').length, 2);
  assert.equal(tags(markup).filter(tag => tag.name === 'td').length, 2);
  assert.match(markup, /style="text-align:left"/);
  assert.match(markup, /style="text-align:right"/);
  assert.match(markup, /<code>a\|b<\/code>/);
  assert.match(markup, />x\|y<\/a>/);
  assertInert(markup);
});

test('footnotes render normally and escape hostile IDs and definitions', t => {
  const { api } = harness(t);
  const markup = api.renderMarkdown('Text[^note]\n\n[^note]: **Definition**\n\nHostile[^x" onmouseover="alert(1)]\n\n[^x" onmouseover="alert(1)]: <img onerror=x>');
  assert.match(markup, /id="fnref-note"/);
  assert.match(markup, /href="#fn-note" data-fn="note"/);
  assert.match(markup, /id="fn-note"><strong>Definition<\/strong>/);
  assert.match(markup, /md-footnotes/);
  assert.match(markup, /&lt;img onerror=x&gt;/);
  assertInert(markup);
});

test('a footnote defined as a URL renders an inline external marker instead of a reference', t => {
  const { api } = harness(t);
  const markup = api.renderMarkdown('Source[^src] and note[^note]\n\n[^src]: https://example.com/page\n\n[^note]: **Prose** definition');
  // The URL footnote becomes an external link at the reference, opening in a new tab.
  assert.match(markup, /<a class="fnext" href="https:\/\/example\.com\/page" data-link="https:\/\/example\.com\/page" target="_blank" rel="noopener noreferrer"/);
  assert.match(markup, /\u2197<\/a>/);
  // The prose footnote keeps its reference and its list entry.
  assert.match(markup, /id="fnref-note"/);
  assert.match(markup, /id="fn-note"><strong>Prose<\/strong>/);
  // The URL footnote is not listed at the foot of the page.
  assert.ok(!markup.includes('fn-src'));
  assertInert(markup);
});

test('an angle-bracketed URL footnote is also an external marker', t => {
  const { api } = harness(t);
  const markup = api.renderMarkdown('Text[^a]\n\n[^a]: <https://example.com/x>');
  assert.match(markup, /<a class="fnext" href="https:\/\/example\.com\/x"/);
  assert.ok(!markup.includes('md-footnotes'));
  assertInert(markup);
});

test('a footnote whose prose merely contains a URL stays a normal footnote', t => {
  const { api } = harness(t);
  const markup = api.renderMarkdown('Text[^n]\n\n[^n]: See https://example.com/ for details');
  assert.match(markup, /id="fnref-n"/);
  assert.match(markup, /md-footnotes/);
  assertInert(markup);
});

test('normal emphasis, strong emphasis and strikethrough remain supported', t => {
  const { api } = harness(t);
  assert.equal(api.renderInline('*em* **strong** ***both*** ~~gone~~'),
    '<em>em</em> <strong>strong</strong> <em><strong>both</strong></em> <del>gone</del>');
});

test('multi-line list items keep indented continuations inside the item', t => {
  const { api } = harness(t);
  const ordered = api.renderMarkdown('1. Every concept starts with frontmatter,\n   and `type` is the only required field.\n2. Open the folder.');
  assert.equal((ordered.match(/<p>/g) || []).length, 0);
  assert.match(ordered, /<li>Every concept starts with frontmatter, and <code>type<\/code> is the only required field\.<\/li>/);
  assert.match(ordered, /<li>Open the folder\.<\/li>/);

  const bullet = api.renderMarkdown('- A concept may span lines,\n  like this one.\n\nA separate paragraph.');
  assert.match(bullet, /<li>A concept may span lines, like this one\.<\/li>/);
  assert.match(bullet, /<p>A separate paragraph\.<\/p>/);
  assertInert(ordered);
  assertInert(bullet);
});

test('runtime domain statistics count URL hosts across the loaded files', t => {
  const { api } = harness(t);
  api.bundleGeneration = 1;
  api.bundleFiles = [
    { path: 'a.md', text: 'See [x](https://Example.com/a) and https://example.com/b.' },
    { path: 'b.md', text: 'Mail https://other.example.org/x' }
  ];
  const d = api.rtDomains();
  assert.equal(d.links, 3);
  assert.equal(d.files, 2);
  assert.equal(d.domains.map(x => x.host).join(','), 'example.com,other.example.org');
  const byHost = Object.fromEntries(d.domains.map(x => [x.host, x]));
  assert.equal(byHost['example.com'].n, 2);
  assert.equal(byHost['example.com'].files, 1);
  assert.equal(byHost['other.example.org'].n, 1);
  const md = api.runtimeBody('bundle.md');
  assert.ok(md.indexOf('| Domain | Links | Files |') >= 0, 'domain table header');
  assert.ok(md.indexOf('`example.com` | 2 | 1') >= 0, 'example.com row');
});

test('bidi base direction follows the first strong character', t => {
  const { api } = harness(t);
  assert.equal(api.bidiBaseDir('docs/x.md'), 'ltr');
  assert.equal(api.bidiBaseDir('nested/'), 'ltr');
  assert.equal(api.bidiBaseDir('123/'), 'ltr');      // no strong character
  assert.equal(api.bidiBaseDir('دليل'), 'rtl');      // Arabic
  assert.equal(api.bidiBaseDir('שלום'), 'rtl');      // Hebrew
  assert.equal(api.bidiBaseDir('abc دليل'), 'ltr');  // first strong is Latin
});

test('translated messages isolate interpolated values with bdi', t => {
  const { api } = harness(t);
  const html = api.tHtml('msg.sameOrigin', 'Bundle must be a same-origin path: {0}', { 0: 'https://x/<b>&' });
  assert.equal(html, 'Bundle must be a same-origin path: <bdi dir="auto">https://x/&lt;b&gt;&amp;</bdi>');
});

test('dangerous Markdown URL schemes cannot become active hrefs', t => {
  const { api } = harness(t);
  for (const target of ['javascript:alert(1)', 'data:text/html,evil', 'vbscript:evil', '//evil.test/note.md', 'https://user:pass@example.test/', 'https://example.test/%0aevil']) {
    assert.equal(api.markdownExternalUrl(target), null, target);
    const markup = api.renderInline(`[label](${target})`);
    assertInert(markup);
    assert.equal(tags(markup).filter(tag => tag.name === 'a').length, 0, target);
  }
});

test('Markdown input and nesting limits fail closed with bounded output', t => {
  const { api } = harness(t);
  for (const payload of ['x'.repeat(api.MAX_MARKDOWN_CHARS + 1), '>'.repeat(api.MAX_MARKDOWN_DEPTH + 2) + ' text']) {
    const markup = renderInVm(api, payload);
    assert.ok(markup.length < 1024);
    assert.match(markup, /safety limit exceeded/);
    assertInert(markup);
  }
});

test('path helpers reject encoded escapes, absolute paths, backslashes and schemes', t => {
  const { api } = harness(t);
  for (const path of ['../outside.md', '/outside.md', 'nested/../../outside.md', 'nested\\outside.md', 'https://evil.test/note.md', 'javascript:evil', '.hidden/note.md', 'a\u0000.md']) {
    assert.equal(api.validBundlePath(path), false, path);
    assert.equal(api.bundleUrl(path, ROOT), null, path);
  }
  for (const path of ['%2e%2e/outside.md', '%2e%2e%2foutside.md', '%252e%252e/outside.md', 'nested%2foutside.md', 'nested%5coutside.md', '%3aevil.md', 'bad%escape.md', '\\evil.test/x.md']) {
    assert.deepEqual(Array.from(api.linkCandidates('index.md', path)), [], path);
  }
});

test('legitimate nested paths, parent links and bundle-root-relative links survive', t => {
  const { api } = harness(t);
  assert.deepEqual(Array.from(api.linkCandidates('nested/topic.md', '../space%20name.md')), ['space name.md']);
  assert.deepEqual(Array.from(api.linkCandidates('nested/topic.md', './child.md')), ['nested/child.md']);
  assert.equal(api.linkCandidates('nested/topic.md', '/root.md')[0], 'root.md');
  assert.equal(api.resourceCandidates('nested/topic.md', 'guides/reference.md')[0], 'guides/reference.md');
  assert.equal(api.bundleUrl('nested/space name.md', ROOT), `${ROOT}nested/space%20name.md`);
  assert.equal(api.urlWithinBundle(`${ROOT}nested/space%20name.md`, ROOT), true);
});

test('URL scoping rejects foreign origins, sibling roots, credentials and encoded separators', t => {
  const { api } = harness(t);
  for (const url of [
    'https://evil.test/bundles/security/note.md',
    'https://explorer.test/bundles/security-other/note.md',
    `${ROOT}../outside.md`, `${ROOT}%2e%2e/outside.md`,
    `${ROOT}nested%2fnote.md`, `${ROOT}nested%5cnote.md`, `${ROOT}%252e%252e/note.md`,
    `${ROOT}note.md?secret=1`, `${ROOT}note.md#fragment`,
    'https://user:pass@explorer.test/bundles/security/note.md',
    'file:///bundles/security/note.md', 'javascript:alert(1)'
  ]) assert.equal(api.urlWithinBundle(url, ROOT), false, url);
  assert.equal(api.urlWithinBundle(`${ROOT}note.md`, ROOT.slice(0, -1)), false);
  assert.equal(api.urlWithinBundle(`${ROOT}note.md`, null), false);
});

test('root-scoped crawler fetches nested and space-named files but never escaping links', async t => {
  const { api } = harness(t);
  const pages = new Map([
    [`${ROOT}index.md`, '[nested](nested/page.md) [root](/root.md) [outside](../outside.md) [encoded](%2e%2e/outside.md) [slash](%2foutside.md) [backslash](nested\\bad.md) [scheme](javascript:evil) [remote](https://evil.test/x.md)'],
    [`${ROOT}nested/page.md`, '[space](../space%20name.md) [escape](../../outside.md)'],
    [`${ROOT}root.md`, '# Root'],
    [`${ROOT}space%20name.md`, '# Space']
  ]);
  const requested = [];
  api.fetch = async (url, opts) => {
    requested.push(url);
    assert.equal(opts.redirect, 'error');
    assert.equal(opts.credentials, 'omit');
    assert.ok(pages.has(url), `Unexpected crawl target: ${url}`);
    return response(url, mockStream([pages.get(url)]));
  };
  const files = await api.crawlFromUrl(`${ROOT}index.md`, Infinity, ROOT);
  assert.deepEqual(Array.from(files, file => file.path).sort(), ['index.md', 'nested/page.md', 'root.md', 'space name.md']);
  assert.deepEqual(requested.sort(), Array.from(pages.keys()).sort());
});

test('crawler honors depth zero and keeps paths relative to the explicit root', async t => {
  const { api } = harness(t);
  const requested = [];
  api.fetch = async url => {
    requested.push(url);
    return response(url, mockStream(['[child](child.md)']));
  };
  const files = await api.crawlFromUrl(`${ROOT}nested/start.md`, 0, ROOT);
  assert.deepEqual(Array.from(files, file => file.path), ['nested/start.md']);
  assert.deepEqual(requested, [`${ROOT}nested/start.md`]);
  assert.deepEqual(Array.from(await api.crawlFromUrl('https://explorer.test/outside.md', 0, ROOT)), []);
  assert.equal(requested.length, 1);
});

test('crawler tries successive ancestor candidates after 404 and stops at the first success', async t => {
  const { api } = harness(t);
  const start = `${ROOT}nested/deep/start.md`;
  const candidates = [`${ROOT}nested/deep/target.md`, `${ROOT}nested/target.md`, `${ROOT}target.md`];
  for (const successful of [0, 2]) {
    const requested = [];
    api.fetch = async url => {
      requested.push(url);
      if (url === start) return response(url, mockStream(['[target](target.md)']));
      const index = candidates.indexOf(url);
      assert.notEqual(index, -1);
      return response(url, mockStream(index === successful ? ['# Target'] : []), {}, index === successful ? 200 : 404);
    };
    const files = await api.crawlFromUrl(start, 1, ROOT);
    assert.deepEqual(requested, [start, ...candidates.slice(0, successful + 1)]);
    assert.deepEqual(Array.from(files, file => file.path), ['nested/deep/start.md', candidates[successful].slice(ROOT.length)]);
  }
});

test('crawler skips an already-missing deduplicated ancestor and still fetches the root fallback', async t => {
  const { api } = harness(t);
  const start = `${ROOT}a/b/page.md`;
  const ancestor = `${ROOT}a/shared.md`, nearest = `${ROOT}a/b/shared.md`, root = `${ROOT}shared.md`;
  const requested = [];
  api.fetch = async url => {
    requested.push(url);
    if (url === start) return response(url, mockStream(["[parent](../shared.md) [nearby](shared.md)"]));
    if (url === ancestor || url === nearest) return response(url, mockStream([]), {}, 404);
    assert.equal(url, root, 'Fallback must stay inside the bundle root');
    return response(url, mockStream(['# Shared']));
  };
  const files = await api.crawlFromUrl(start, 1, ROOT);
  assert.deepEqual(requested, [start, ancestor, nearest, root]);
  assert.equal(new Set(requested).size, requested.length);
  assert.deepEqual(Array.from(files, file => file.path), ['a/b/page.md', 'shared.md']);
  assert.equal(files[1].text, '# Shared');
});

test('crawler does not use ancestor fallback for non-404 responses or transport errors', async t => {
  const { api } = harness(t);
  const start = `${ROOT}nested/deep/start.md`, nearest = `${ROOT}nested/deep/target.md`;
  for (const failure of [401, 403, 500, 'transport']) {
    const requested = [];
    api.fetch = async url => {
      requested.push(url);
      if (url === start) return response(url, mockStream(['[target](target.md)']));
      if (url === nearest) {
        if (failure === 'transport') throw new Error('transport failed');
        return response(url, mockStream([]), {}, failure);
      }
      return response(url, mockStream(['# Unexpected ancestor']));
    };
    const files = await api.crawlFromUrl(start, 1, ROOT);
    assert.deepEqual(requested, [start, nearest], String(failure));
    assert.deepEqual(Array.from(files, file => file.path), ['nested/deep/start.md']);
  }
});

test('readBoundedStream accepts the exact limit and releases without cancelling', async t => {
  const { api } = harness(t);
  const stream = mockStream(['ab', 'cd']);
  assert.equal(new TextDecoder().decode(await api.readBoundedStream(stream.body, 4)), 'abcd');
  assert.equal(stream.state.readerCancels, 0);
  assert.equal(stream.state.releases, 1);
  assert.equal(stream.body.locked, false);
  const empty = mockStream([]);
  assert.equal((await api.readBoundedStream(empty.body, 0)).byteLength, 0);
});

test('readBoundedStream cancels on overflow after reaching the exact limit', async t => {
  const { api } = harness(t);
  const stream = mockStream(['abcd', 'e', 'never read']);
  await assert.rejects(api.readBoundedStream(stream.body, 4), /byte limit/i);
  assert.equal(stream.state.reads, 2);
  assert.equal(stream.state.readerCancels, 1);
  assert.equal(stream.state.releases, 1);
  const zero = mockStream(['x']);
  await assert.rejects(api.readBoundedStream(zero.body, 0), /byte limit/i);
  assert.equal(zero.state.readerCancels, 1);
});

test('readBoundedStream cancels an oversized first chunk and releases on read failure', async t => {
  const { api } = harness(t);
  const oversized = mockStream(['12345']);
  await assert.rejects(api.readBoundedStream(oversized.body, 4), /byte limit/i);
  assert.equal(oversized.state.readerCancels, 1);
  const broken = mockStream([], { error: new Error('reader failed') });
  await assert.rejects(api.readBoundedStream(broken.body, 4), /reader failed/);
  assert.equal(broken.state.readerCancels, 1);
  assert.equal(broken.state.releases, 1);
});

test('trackedFetch rejects out-of-root requests before contacting fetch', async t => {
  const { api } = harness(t);
  let calls = 0;
  api.fetch = async () => { calls++; throw new Error('Must not be contacted'); };
  for (const url of ['https://explorer.test/outside.md', 'https://evil.test/bundles/security/x.md', `${ROOT}%2e%2e/x.md`]) {
    await assert.rejects(api.trackedFetch(url, {}, 8, ROOT), /outside.*root/i);
  }
  assert.equal(calls, 0);
});

test('trackedFetch forces redirect:error and credentials:omit and returns bounded bytes', async t => {
  const { api, timers } = harness(t);
  const headers = { Range: 'bytes=0-3' };
  let passed;
  api.bundleRootUrl = ROOT;
  api.fetch = async (url, opts) => {
    passed = opts;
    return response(url, mockStream(['data']));
  };
  const result = await api.trackedFetch(`${ROOT}note.md`, { cache: 'force-cache', headers, credentials: 'include', redirect: 'follow' }, 4);
  assert.equal(passed.redirect, 'error');
  assert.equal(passed.credentials, 'omit');
  assert.equal(passed.cache, 'force-cache');
  assert.equal(passed.headers, headers);
  assert.ok(passed.signal instanceof AbortSignal);
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(new TextDecoder().decode(result.bytes), 'data');
  assert.equal(timers.size, 0);
});

test('trackedFetch holds semaphore slots until gated streaming bodies are consumed', { timeout: 5000 }, async t => {
  const { api } = harness(t, { MAX_CONCURRENT_FETCHES: 2 });
  const gates = [deferred(t), deferred(t), deferred(t)];
  const started = [deferred(), deferred(), deferred()];
  let calls = 0;
  api.fetch = async url => {
    const index = calls++;
    return response(url, mockStream([String(index)], { gate: gates[index], started: started[index] }));
  };
  const requests = [0, 1, 2].map(index => api.trackedFetch(`${ROOT}${index}.md`, {}, 8, ROOT));
  const completed = Promise.all(requests);
  try {
    await Promise.all([started[0].promise, started[1].promise]);
    await flushJobs();
    assert.equal(calls, 2, 'Headers alone must not release the first two slots');
    gates[0].resolve();
    await started[2].promise;
    assert.equal(calls, 3);
    gates[1].resolve(); gates[2].resolve();
    assert.deepEqual((await completed).map(result => new TextDecoder().decode(result.bytes)), ['0', '1', '2']);
  } finally {
    gates.forEach(gate => gate.resolve());
    await completed;
  }
});

test('trackedFetch rejects oversized bodies with absent or dishonest Content-Length', async t => {
  const { api } = harness(t);
  for (const headers of [{}, { 'Content-Length': '1' }]) {
    const stream = mockStream(['abcd', 'e']);
    api.fetch = async url => response(url, stream, headers);
    await assert.rejects(api.trackedFetch(`${ROOT}note.md`, {}, 4, ROOT), /byte limit/i);
    assert.equal(stream.state.readerCancels, 1);
    assert.equal(stream.state.releases, 1);
  }
});

test('trackedFetch rejects declared oversize and foreign response URLs without reading bodies', async t => {
  const { api } = harness(t);
  for (const [url, headers, pattern] of [
    [`${ROOT}note.md`, { 'Content-Length': '9' }, /byte limit/i],
    ['https://explorer.test/outside.md', {}, /outside.*root/i]
  ]) {
    const stream = mockStream(['never read']);
    api.fetch = async () => response(url, stream, headers);
    await assert.rejects(api.trackedFetch(`${ROOT}note.md`, {}, 4, ROOT), pattern);
    assert.equal(stream.state.reads, 0);
    assert.equal(stream.state.bodyCancels, 1);
  }
});

test('network and body failures release slots for requests already queued', { timeout: 5000 }, async t => {
  for (const failure of ['network', 'body']) {
    const { api, timers } = harness(t, { MAX_CONCURRENT_FETCHES: 1 });
    const gate = deferred(t), contacted = deferred();
    let calls = 0;
    api.fetch = async url => {
      calls++;
      if (calls === 1) {
        contacted.resolve();
        await gate.promise;
        if (failure === 'network') throw new Error('network failed');
        return response(url, mockStream([], { error: new Error('body failed') }));
      }
      return response(url, mockStream(['ok']));
    };
    const first = assert.rejects(api.trackedFetch(`${ROOT}bad.md`, {}, 4, ROOT), /failed/);
    const second = api.trackedFetch(`${ROOT}good.md`, {}, 4, ROOT);
    try {
      await contacted.promise;
      await flushJobs();
      assert.equal(calls, 1);
      gate.resolve();
      await first;
      assert.equal(new TextDecoder().decode((await second).bytes), 'ok');
      assert.equal(calls, 2);
      assert.equal(timers.size, 0);
    } finally {
      gate.resolve();
      await Promise.allSettled([first, second]);
    }
  }
});

test('HEAD and headersOnly requests cancel bodies without buffering oversized content', async t => {
  const { api } = harness(t);
  for (const opts of [{ method: 'HEAD' }, { headersOnly: true, headers: { Range: 'bytes=0-0' } }]) {
    const stream = mockStream(['this body must never be consumed']);
    let passed;
    api.fetch = async (url, options) => {
      passed = options;
      return response(url, stream, { 'Content-Length': '99999999' });
    };
    const result = await api.trackedFetch(`${ROOT}report.pdf`, opts, 1, ROOT);
    assert.equal(result.bytes.byteLength, 0);
    assert.equal(stream.state.reads, 0);
    assert.equal(stream.state.bodyCancels, 1);
    assert.equal(passed.method, opts.method || 'GET');
  }
});

test('near-cap tiny text files wait for temporary reservations instead of failing early', { timeout: 5000 }, async t => {
  // Små grenser utøver samme ventelogikk uten store testdata.
  const { api } = harness(t, { MAX_FILE_BYTES: 8, MAX_BUNDLE_BYTES: 12 });
  const budget = api.createBundleBudget();
  api.accountBundleFile(budget, { path: 'seed.md', text: '12345678' });
  const gate = deferred(t), started = deferred();
  const requested = [];
  api.fetch = async url => {
    requested.push(url);
    return response(url, mockStream(['x'], requested.length === 1 ? { gate, started } : {}));
  };
  const first = api.fetchBundleText('first.md', `${ROOT}first.md`, budget, ROOT);
  let second;
  try {
    await started.promise;
    second = api.fetchBundleText('second.md', `${ROOT}second.md`, budget, ROOT);
    await flushJobs();
    assert.deepEqual(requested, [`${ROOT}first.md`]);
    assert.equal(budget.reservedBytes, 4);
    assert.equal(budget.reservedFiles, 1);
    assert.equal(budget.textWaiters.length, 1);
    gate.resolve();
    const results = await Promise.all([first, second]);
    assert.deepEqual(results.map(file => file.path), ['first.md', 'second.md']);
    assert.equal(budget.bytes, 10);
    assert.equal(budget.paths.size, 3);
    assertReservationsReleased(budget);
  } finally {
    gate.resolve();
    await Promise.allSettled([first, second]);
  }
});

test('text file-slot reservations wait near the file cap and reject only after it is committed', { timeout: 5000 }, async t => {
  const { api } = harness(t, { MAX_FILE_BYTES: 8, MAX_BUNDLE_BYTES: 64, MAX_BUNDLE_FILES: 2 });
  const budget = api.createBundleBudget();
  api.accountBundleFile(budget, { path: 'seed.md', text: 'seed' });
  const gate = deferred(t), started = deferred();
  const requested = [];
  api.fetch = async url => {
    requested.push(url);
    return response(url, mockStream(['x'], requested.length === 1 ? { gate, started } : {}));
  };
  const first = api.fetchBundleText('first.md', `${ROOT}first.md`, budget, ROOT);
  let second;
  try {
    await started.promise;
    second = assert.rejects(api.fetchBundleText('second.md', `${ROOT}second.md`, budget, ROOT), /file or total byte limit/i);
    await flushJobs();
    assert.equal(requested.length, 1);
    assert.equal(budget.textWaiters.length, 1);
    gate.resolve();
    await Promise.all([first, second]);
    assert.equal(budget.paths.size, 2);
    await assert.rejects(api.fetchBundleText('third.md', `${ROOT}third.md`, budget, ROOT), /file or total byte limit/i);
    assert.equal(requested.length, 1);
    assertReservationsReleased(budget);
  } finally {
    gate.resolve();
    await Promise.allSettled([first, second]);
  }
});

test('failed text reservations wake a waiting fetch and release all reserved capacity', { timeout: 5000 }, async t => {
  const { api } = harness(t, { MAX_FILE_BYTES: 8, MAX_BUNDLE_BYTES: 4 });
  const budget = api.createBundleBudget();
  const gate = deferred(t), started = deferred();
  const requested = [];
  api.fetch = async url => {
    requested.push(url);
    if (requested.length === 1) {
      started.resolve();
      await gate.promise;
      throw new Error('reserved fetch failed');
    }
    return response(url, mockStream(['ok']));
  };
  const first = assert.rejects(api.fetchBundleText('bad.md', `${ROOT}bad.md`, budget, ROOT), /reserved fetch failed/);
  let second;
  try {
    await started.promise;
    second = api.fetchBundleText('good.md', `${ROOT}good.md`, budget, ROOT);
    await flushJobs();
    assert.equal(requested.length, 1);
    gate.resolve();
    await first;
    assert.equal((await second).text, 'ok');
    assert.equal(budget.bytes, 2);
    assert.deepEqual(Array.from(budget.paths), ['good.md']);
    assertReservationsReleased(budget);
  } finally {
    gate.resolve();
    await Promise.allSettled([first, second]);
  }
});

test('PDF deflate accepts exact output limits and rejects zlib-generated expansion bombs', async t => {
  const { api } = harness(t);
  const exact = 'metadata'.repeat(128);
  const packed = zlib.deflateSync(Buffer.from(exact)).toString('latin1');
  assert.equal(await api.inflateDeflate(packed, exact.length), exact);
  assert.equal(await api.inflateDeflate(packed, exact.length - 1), '');
  const bomb = zlib.deflateSync(Buffer.alloc(api.PDF_STREAM_TEXT_MAX + 1, 65)).toString('latin1');
  assert.equal(await api.inflateDeflate(bomb), '');
  assert.equal(await api.inflateDeflate('not zlib', 1024), '');
});

test('PDF object streams share one decompressed cap including separators', async t => {
  const { api } = harness(t, { PDF_STREAM_TEXT_MAX: 8 });
  const exact = pdfObjectStream('aaaa') + pdfObjectStream('bbb');
  assert.equal(await api.inflateObjStreams(exact), 'aaaa\nbbb');
  const oversized = pdfObjectStream('aaaa') + pdfObjectStream('bbbb');
  assert.equal(await api.inflateObjStreams(oversized), 'aaaa');
});

test('remote PDF rejects an oversized non-range body through the bounded fetch wrapper', async t => {
  const { api } = harness(t);
  api.bundleRootUrl = ROOT;
  const stream = mockStream([new Uint8Array(api.PDF_HTTP_WINDOW), new Uint8Array(1)]);
  let calls = 0;
  api.fetch = async (url, opts) => {
    calls++;
    assert.equal(opts.headers.Range, `bytes=0-${api.PDF_HTTP_WINDOW - 1}`);
    return response(url, stream, {}, 200);
  };
  await assert.rejects(api.readPdfUrl(`${ROOT}report.pdf`), /byte limit/i);
  assert.equal(calls, 1);
  assert.equal(stream.state.readerCancels, 1);
  assert.equal(stream.state.releases, 1);
});

test('remote PDF reads the wrapper bytes and joins real head and tail responses', async t => {
  const { api } = harness(t, { PDF_HTTP_WINDOW: 4 });
  api.bundleRootUrl = ROOT;
  const ranges = [];
  api.fetch = async (url, opts) => {
    ranges.push(opts.headers.Range);
    return ranges.length === 1
      ? response(url, mockStream(['head']), { 'Content-Range': 'bytes 0-3/12' }, 206)
      : response(url, mockStream(['tail']), { 'Content-Range': 'bytes 8-11/12' }, 206);
  };
  assert.equal(new TextDecoder().decode(await api.readPdfUrl(`${ROOT}report.pdf`)), 'head\ntail');
  assert.deepEqual(ranges, ['bytes=0-3', 'bytes=-4']);
  api.fetch = async url => response(url, mockStream(['tiny']), {}, 200);
  assert.equal(new TextDecoder().decode(await api.readPdfUrl(`${ROOT}tiny.pdf`)), 'tiny');
});

test('local file-list loading rejects cumulative overflow before reading the next file', async t => {
  const { api } = harness(t, { MAX_BUNDLE_BYTES: 6, MAX_FILE_BYTES: 8 });
  const first = localFile('a.md', 'aaaa'), second = localFile('b.md', 'bbbb');
  await assert.rejects(api.fromFileList([first, second]), /byte limit/i);
  assert.equal(first.state.reads, 2);
  assert.equal(second.state.reads, 0);
});

test('local file-list loading accepts exact cumulative bytes and bounds dishonest streams', async t => {
  const { api } = harness(t, { MAX_BUNDLE_BYTES: 6, MAX_FILE_BYTES: 4 });
  const exact = await api.fromFileList([localFile('a.md', 'aaa'), localFile('b.md', 'bbb')]);
  assert.deepEqual(Array.from(exact, file => file.path), ['a.md', 'b.md']);
  assert.equal(exact.reduce((sum, file) => sum + file.bytes, 0), 6);
  const dishonest = localFile('bad.md', '12345', { size: 1 });
  await assert.rejects(api.fromFileList([dishonest]), /byte limit/i);
  assert.equal(dishonest.state.readerCancels, 1);
});

test('local file-list file and entry counts are bounded even for unsupported entries', async t => {
  const { api } = harness(t, { MAX_BUNDLE_FILES: 2 });
  await assert.rejects(api.fromFileList([localFile('a.md', 'a'), localFile('b.md', 'b'), localFile('c.md', 'c')]), /too many|file.*limit/i);
  api.MAX_GRAPH_NODES = 2;
  const unsupported = [0, 1, 2].map(index => ({ name: `skip${index}.unknown` }));
  await assert.rejects(api.fromFileList(unsupported), /directory entries/i);
});

test('pre-accounted local binary files materialize once and retain their native Blob source', async t => {
  const { api, opened, errors } = harness(t);
  const blob = new Blob(['%PDF-local']);
  const report = { path: 'assets/report.pdf', text: '', binary: true, src: blob };
  const index = { path: 'index.md', text: '[report](assets/report.pdf)' };
  let calls = 0;
  api.fetch = async () => { calls++; throw new Error('Local materialization must not fetch'); };
  api.loadLocal([index, report]);
  assert.equal(api.loadErrors.length, 0);
  assert.equal(errors.length, 0);
  assert.ok(!api.bundleFiles.some(file => file.path === report.path));
  const placeholder = api.allNodes.find(node => node.kind === 'file' && node.loaded === false);
  assert.ok(placeholder);
  assert.equal(api.loadBinaryFileNode(placeholder), true);
  assert.equal(api.bundleFiles.filter(file => file.path === report.path).length, 1);
  assert.equal(api.fileMap.get(report.path).src, blob);
  assert.equal(api.fileMap.get(report.path).kind, 'file');
  assert.equal(opened.at(-1).src, blob);
  api.loadBinaryFileNode(placeholder);
  assert.equal(api.bundleFiles.filter(file => file.path === report.path).length, 1);
  assert.equal(calls, 0);
  assert.equal(errors.length, 0);
});

test('depth-limited local expansion reveals already-accounted files without fetching or double charging', async t => {
  const { api, errors } = harness(t, { MAX_BUNDLE_BYTES: 64 });
  api.location.search = '?depth=0';
  const files = [{ path: 'index.md', text: '[next](nested/next.md)' }, { path: 'nested/next.md', text: '# Next' }];
  api.loadLocal(files);
  const before = api.bundleBudget.bytes;
  assert.equal(api.bundleFiles.length, 1);
  assert.equal(await api.expandNode(api.fileMap.get('index.md')), true);
  assert.ok(api.fileMap.has('nested/next.md'));
  assert.equal(api.bundleBudget.bytes, before);
  assert.equal(api.loadErrors.length, 0);
  assert.equal(errors.length, 0);
});

test('buildGraph returns local graph arrays without installing them and load returns a boolean', t => {
  const { api } = harness(t);
  const initial = [{ path: 'index.md', text: '# Initial' }];
  assert.equal(api.load(initial, ROOT), true);
  const snapshot = graphSnapshot(api);
  const graph = api.buildGraph([{ path: 'other.md', text: '# Other' }]);
  assert.deepEqual(Array.from(graph.nodes, node => node.id), ['dir:', 'other.md']);
  assert.equal(graph.links.length, 1);
  assert.ok(graph.files.has('other.md'));
  assert.ok(graph.dirs.has(''));
  assert.notEqual(graph.nodes, api.nodes);
  assertGraphUnchanged(api, snapshot);
  assert.equal(api.load([{ path: 'other.md', text: '# Other' }], ROOT), true);
  assert.ok(api.fileMap.has('other.md'));
  assert.ok(!api.fileMap.has('index.md'));
});

test('non-Markdown frontmatter sources become on-demand file nodes and ref links', t => {
  const { api } = harness(t);
  const text = [
    '---',
    'type: Reference',
    'sources:',
    '  - id: tool',
    '    resource: tool.html',
    '  - id: tests',
    '    resource: test/unit/security.test.cjs',
    '---',
    '',
    '# Concept'
  ].join('\n');
  const graph = api.buildGraph([{ path: 'index.md', text }]);
  const tool = Array.from(graph.nodes).find(node => node.id === 'tool.html');
  const tests = Array.from(graph.nodes).find(node => node.id === 'test/unit/security.test.cjs');
  assert.ok(tool, 'a non-Markdown source should appear as a node');
  assert.ok(tests, 'a nested test source should appear as a node');
  for (const node of [tool, tests]) {
    assert.equal(node.kind, 'file');
    assert.equal(node.loaded, false);
    const edge = Array.from(graph.links).find(link => link.kind === 'ref' && link.target === node);
    assert.ok(edge, `missing ref edge to ${node.id}`);
    assert.equal(edge.source.id, 'index.md');
  }
});

test('preserve load graph-node and graph-link limits leave installed files and graph untouched', t => {
  for (const limit of ['MAX_GRAPH_NODES', 'MAX_GRAPH_LINKS']) {
    const { api, errors } = harness(t);
    const initial = [{ path: 'index.md', text: '# Initial' }];
    assert.equal(api.load(initial, ROOT), true);
    api.fileMap.get('index.md').x = 1337;
    const snapshot = graphSnapshot(api);
    api[limit] = limit === 'MAX_GRAPH_NODES' ? 2 : 1;
    assert.equal(api.load(initial.concat([{ path: 'next.md', text: '# Next' }]), ROOT, null, true), false);
    assertGraphUnchanged(api, snapshot);
    assert.deepEqual(Array.from(api.bundleFiles, file => file.path), ['index.md']);
    assert.equal(api.fileMap.get('index.md').x, 1337);
    assertGraphLimitDiagnostic(api, errors);
  }
});

test('remote expansion graph-limit rejection leaves files untouched and releases remote charges', async t => {
  const { api, errors } = harness(t, { MAX_GRAPH_NODES: 2 });
  api.location.search = '?depth=0';
  assert.equal(api.load([{ path: 'index.md', text: '[next](next.md)' }], ROOT), true);
  const snapshot = graphSnapshot(api), chargedBytes = api.bundleBudget.bytes;
  const requested = [];
  api.fetch = async url => {
    requested.push(url);
    return response(url, mockStream(['# Remote']));
  };
  assert.equal(await api.expandNode(api.fileMap.get('index.md')), false);
  assert.deepEqual(requested, [`${ROOT}next.md`]);
  assertGraphUnchanged(api, snapshot);
  assert.deepEqual(Array.from(api.bundleFiles, file => file.path), ['index.md']);
  assert.deepEqual(Array.from(api.bundleBudget.paths), ['index.md']);
  assert.equal(api.bundleBudget.bytes, chargedBytes);
  assertReservationsReleased(api.bundleBudget);
  assertGraphLimitDiagnostic(api, errors);
  assert.equal(api.attemptedUrls.has(`${ROOT}next.md`), false);
  api.MAX_GRAPH_NODES = 3;
  assert.equal(await api.expandNode(api.fileMap.get('index.md')), true);
  assert.deepEqual(requested, [`${ROOT}next.md`, `${ROOT}next.md`]);
  assert.ok(api.fileMap.has('next.md'));
  assert.equal(api.bundleBudget.bytes, chargedBytes + bytes('# Remote').byteLength);
  assertReservationsReleased(api.bundleBudget);
});

test('remote binary file graph-limit rejection rolls back its path charge without opening preview', t => {
  const { api, errors, opened } = harness(t, { MAX_GRAPH_NODES: 3 });
  assert.equal(api.load([{ path: 'index.md', text: '[report](assets/report.pdf)' }], ROOT), true);
  const snapshot = graphSnapshot(api), chargedBytes = api.bundleBudget.bytes;
  const placeholder = api.allNodes.find(node => node.loaded === false);
  assert.ok(placeholder);
  assert.equal(api.loadBinaryFileNode(placeholder), false);
  assertGraphUnchanged(api, snapshot);
  assert.deepEqual(Array.from(api.bundleFiles, file => file.path), ['index.md']);
  assert.deepEqual(Array.from(api.bundleBudget.paths), ['index.md']);
  assert.equal(api.bundleBudget.bytes, chargedBytes);
  assert.equal(opened.length, 0);
  assertReservationsReleased(api.bundleBudget);
  assertGraphLimitDiagnostic(api, errors);
});

test('a loaded SVG at a later candidate resolves its actual path rather than the first missing candidate', async t => {
  const { api, createdUrls } = harness(t);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>';
  assert.equal(api.load([
    { path: 'nested/note.md', text: '![chart](icons/chart.svg)' },
    { path: 'icons/chart.svg', text: svg }
  ], ROOT), true);
  assert.equal(api.fileMap.get('icons/chart.svg').src, null);
  const requested = [];
  api.fetch = async url => {
    requested.push(url);
    return response(url, mockStream([svg]), { 'Content-Type': 'image/svg+xml' });
  };
  const url = await api.resolveEmbedSrc('icons/chart.svg', 'nested/note.md', api.bundleGeneration);
  assert.deepEqual(requested, [`${ROOT}icons/chart.svg`]);
  assert.equal(url, createdUrls[0].url);
  assert.equal(createdUrls[0].blob.type, 'image/svg+xml');
  assert.equal(await createdUrls[0].blob.text(), svg);
  assert.ok(api.embedUrlCache['icons/chart.svg']);
  assert.equal(api.embedUrlCache['nested/icons/chart.svg'], undefined);
  assertReservationsReleased(api.bundleBudget);
});

test('blob cache reuses URLs, revokes replacements and resets preview and pending caches', t => {
  const { api, createdUrls, revokedUrls } = harness(t);
  api.bundleBudget = api.createBundleBudget();
  const first = new Blob(['first']), second = new Blob(['next']);
  const url = api.blobUrlFor('image.png', first);
  assert.equal(api.blobUrlFor('image.png', first), url);
  assert.equal(createdUrls.length, 1);
  const replacement = api.blobUrlFor('image.png', second);
  assert.notEqual(replacement, url);
  assert.deepEqual(revokedUrls, [url]);
  api.embedLoads.set('pending.png', Promise.resolve(null));
  api.pvBody.textContent = 'old preview';
  api.pvStack = ['old.md'];
  api.previewPath = 'old.md';
  api.resetBundleResources();
  assert.deepEqual(revokedUrls, [url, replacement]);
  assert.equal(Object.keys(api.embedUrlCache).length, 0);
  assert.equal(api.embedLoads.size, 0);
  assert.equal(api.pvBody.textContent, '');
  assert.equal(api.pvStack.length, 0);
  assert.equal(api.previewPath, null);
});

test('blob materialization enforces per-image and cumulative image limits', t => {
  const { api, createdUrls } = harness(t, { MAX_IMAGE_BYTES: 8, MAX_IMAGE_TOTAL_BYTES: 12 });
  api.bundleBudget = api.createBundleBudget();
  assert.equal(api.blobUrlFor('too-large.png', new Blob(['123456789'])), null);
  assert.ok(api.blobUrlFor('first.png', new Blob(['12345678'])));
  assert.equal(api.blobUrlFor('overflow.png', new Blob(['12345'])), null);
  assert.ok(api.blobUrlFor('exact.png', new Blob(['1234'])));
  assert.equal(createdUrls.length, 2);
});

test('remote images enforce aggregate capacity and still reuse cached images when the cache is full', async t => {
  const { api, createdUrls } = harness(t, { MAX_IMAGE_BYTES: 8, MAX_IMAGE_TOTAL_BYTES: 12 });
  api.bundleBudget = api.createBundleBudget();
  const requested = [];
  api.fetch = async url => {
    requested.push(url);
    const content = url.endsWith('first.png') ? '12345678' : url.endsWith('oversized.png') ? '12345' : '1234';
    return response(url, mockStream([content]), { 'Content-Type': 'image/png' });
  };
  const first = await api.imageSrcFor('first.png', `${ROOT}first.png`, api.bundleGeneration, ROOT);
  assert.ok(first);
  await assert.rejects(api.imageSrcFor('oversized.png', `${ROOT}oversized.png`, api.bundleGeneration, ROOT), /byte limit/i);
  assert.equal(api.bundleBudget.imageBytes, 8);
  assertReservationsReleased(api.bundleBudget);
  assert.ok(await api.imageSrcFor('second.png', `${ROOT}second.png`, api.bundleGeneration, ROOT));
  assert.equal(api.bundleBudget.imageBytes, 12);
  assert.equal(await api.imageSrcFor('third.png', `${ROOT}third.png`, api.bundleGeneration, ROOT), null);
  assert.equal(await api.imageSrcFor('first.png', `${ROOT}first.png`, api.bundleGeneration, ROOT), first);
  assert.deepEqual(requested, [`${ROOT}first.png`, `${ROOT}oversized.png`, `${ROOT}second.png`]);
  assert.equal(createdUrls.length, 2);
  assertReservationsReleased(api.bundleBudget);
});

test('remote images wait for temporarily reduced allowance before reading a larger second image', { timeout: 5000 }, async t => {
  const { api, createdUrls } = harness(t, { MAX_IMAGE_BYTES: 8, MAX_IMAGE_TOTAL_BYTES: 12 });
  api.bundleBudget = api.createBundleBudget();
  const gate = deferred(t), started = deferred();
  const requested = [];
  api.fetch = async url => {
    requested.push(url);
    return response(url, mockStream(requested.length === 1 ? ['x'] : ['123456'], requested.length === 1 ? { gate, started } : {}));
  };
  const first = api.imageSrcFor('first.png', `${ROOT}first.png`, api.bundleGeneration, ROOT);
  let second;
  try {
    await started.promise;
    second = api.imageSrcFor('second.png', `${ROOT}second.png`, api.bundleGeneration, ROOT);
    await flushJobs();
    assert.deepEqual(requested, [`${ROOT}first.png`]);
    assert.equal(api.bundleBudget.imageReservedBytes, 8);
    assert.equal(api.bundleBudget.imageWaiters.length, 1);
    gate.resolve();
    const results = await Promise.all([first, second]);
    assert.ok(results.every(Boolean));
    assert.equal(createdUrls.length, 2);
    assert.equal(api.bundleBudget.imageBytes, 7);
    assertReservationsReleased(api.bundleBudget);
  } finally {
    gate.resolve();
    await Promise.allSettled([first, second]);
  }
});

test('local image materialization waits for a remote reservation instead of being omitted', { timeout: 5000 }, async t => {
  const { api, createdUrls } = harness(t, { MAX_IMAGE_BYTES: 8, MAX_IMAGE_TOTAL_BYTES: 12 });
  api.bundleBudget = api.createBundleBudget();
  const gate = deferred(t), started = deferred();
  let calls = 0;
  api.fetch = async url => {
    calls++;
    return response(url, mockStream(['x'], { gate, started }));
  };
  const remote = api.imageSrcFor('remote.png', `${ROOT}remote.png`, api.bundleGeneration, ROOT);
  let local;
  try {
    await started.promise;
    local = api.imageSrcFor('local.png', new Blob(['123456']), api.bundleGeneration, ROOT);
    await flushJobs();
    assert.equal(createdUrls.length, 0);
    assert.equal(api.bundleBudget.imageWaiters.length, 1);
    gate.resolve();
    assert.ok((await Promise.all([remote, local])).every(Boolean));
    assert.equal(calls, 1);
    assert.equal(createdUrls.length, 2);
    assert.equal(api.bundleBudget.imageBytes, 7);
    assertReservationsReleased(api.bundleBudget);
  } finally {
    gate.resolve();
    await Promise.allSettled([remote, local]);
  }
});

test('failed remote image reservations wake waiting images and release their capacity', { timeout: 5000 }, async t => {
  const { api, createdUrls } = harness(t, { MAX_IMAGE_BYTES: 8, MAX_IMAGE_TOTAL_BYTES: 12 });
  api.bundleBudget = api.createBundleBudget();
  const gate = deferred(t), started = deferred();
  let calls = 0;
  api.fetch = async url => {
    calls++;
    if (calls === 1) {
      started.resolve();
      await gate.promise;
      throw new Error('image fetch failed');
    }
    return response(url, mockStream(['123456']));
  };
  const first = assert.rejects(api.imageSrcFor('bad.png', `${ROOT}bad.png`, api.bundleGeneration, ROOT), /image fetch failed/);
  let second;
  try {
    await started.promise;
    second = api.imageSrcFor('good.png', `${ROOT}good.png`, api.bundleGeneration, ROOT);
    await flushJobs();
    assert.equal(calls, 1);
    gate.resolve();
    await first;
    assert.ok(await second);
    assert.equal(calls, 2);
    assert.equal(createdUrls.length, 1);
    assert.equal(api.bundleBudget.imageBytes, 6);
    assertReservationsReleased(api.bundleBudget);
  } finally {
    gate.resolve();
    await Promise.allSettled([first, second]);
  }
});

test('image responses from an old bundle cannot repopulate the reset blob cache', { timeout: 5000 }, async t => {
  const { api, createdUrls } = harness(t);
  const gate = deferred(t), started = deferred();
  api.bundleBudget = api.createBundleBudget();
  api.bundleRootUrl = ROOT;
  api.fetch = async url => response(url, mockStream(['image'], { gate, started }), { 'Content-Type': 'image/png' });
  const pending = api.resolveEmbedSrc('image.png', 'index.md', api.bundleGeneration);
  try {
    await started.promise;
    api.bundleGeneration++;
    api.resetBundleResources();
    api.bundleBudget = api.createBundleBudget();
    gate.resolve();
    assert.equal(await pending, null);
    assert.equal(createdUrls.length, 0);
    assert.equal(Object.keys(api.embedUrlCache).length, 0);
    assert.equal(api.embedLoads.size, 0);
  } finally {
    gate.resolve();
    await pending;
  }
});

test('mediaKind classifies audio and video files, and a scrub window stays in bounds', t => {
  const { api } = harness(t);
  assert.equal(api.mediaKind('clip.mp3'), 'audio');
  assert.equal(api.mediaKind('a/b/take.WAV'), 'audio');
  assert.equal(api.mediaKind('movie.webm'), 'video');
  assert.equal(api.mediaKind('trailer.MP4'), 'video');
  assert.equal(api.mediaKind('notes.md'), null);
  assert.equal(api.mediaKind('picture.png'), null);
  // Audio and video extensions are binary files, so such a file becomes a node (but is not read).
  assert.equal(api.binaryKind('clip.mp3'), 'mp3');
  assert.equal(api.binaryKind('movie.mp4'), 'mp4');
  // A scrub grain is one short window, clamped so it never runs off the end of the clip.
  assert.deepEqual({ ...api.asScrubWindow(1, 30) }, { off: 1, dur: api.AS_SCRUB_GRAIN });
  assert.equal(api.asScrubWindow(29.99, 30).off, 30 - api.AS_SCRUB_GRAIN);
  assert.equal(api.asScrubWindow(-4, 30).off, 0);
  assert.equal(api.asScrubWindow(5, 0.01).dur, 0.01);
  // A grain window is silent at both edges and peaks in the middle, so grains cross-fade.
  var curve = api.asScrubCurve(5);
  assert.equal(curve.length, 5);
  assert.equal(curve[0], 0);
  assert.equal(curve[4], 0);
  assert.ok(Math.abs(curve[1] - 0.5) < 1e-6);
  assert.ok(Math.abs(curve[2] - 1) < 1e-6);
});

test('asScrubPlan densifies grains as a drag speeds up, keeping them overlapping', t => {
  const { api } = harness(t);
  const close = (a, b) => Math.abs(a - b) < 1e-9;
  // At rest a calm, fixed hop; the read head does not move, so the grain repeats (a granular freeze).
  const still = api.asScrubPlan(0);
  assert.ok(close(still.hop, api.AS_SCRUB_HOP0));
  assert.equal(still.advance, 0);
  // A slow drag still uses the calm hop, and reads on at the drag's own speed.
  assert.ok(close(api.asScrubPlan(0.5).hop, api.AS_SCRUB_HOP0));
  assert.ok(close(api.asScrubPlan(0.5).advance, 0.5 * api.AS_SCRUB_HOP0));
  // A fast drag places grains denser, so the read advance per grain stays at the cap (not the whole
  // jump), which keeps consecutive grains overlapping in the source instead of disjoint snippets.
  const fast = api.asScrubPlan(5);
  assert.ok(fast.hop < api.AS_SCRUB_HOP0);
  assert.ok(close(fast.advance, api.AS_SCRUB_ADV));
  // An extreme drag saturates: the hop bottoms out, the advance stays capped, and the pointer just
  // outruns the audio rather than the grains tearing apart.
  const extreme = api.asScrubPlan(1000);
  assert.ok(close(extreme.hop, api.AS_SCRUB_HOP_MIN));
  assert.ok(close(extreme.advance, api.AS_SCRUB_ADV));
  // A reversal reads the other way.
  assert.ok(close(api.asScrubPlan(-5).advance, -api.AS_SCRUB_ADV));
  // Across every speed the hop stays in range and the per-grain advance is less than a grain, so
  // the grains always overlap and their seams cross-fade.
  assert.ok(api.AS_SCRUB_ADV < api.AS_SCRUB_GRAIN);
  for (const vel of [-1000, -7, -1, 0, 1, 3, 7, 1000]) {
    const plan = api.asScrubPlan(vel);
    assert.ok(plan.hop >= api.AS_SCRUB_HOP_MIN && plan.hop <= api.AS_SCRUB_HOP0);
    assert.ok(Math.abs(plan.advance) <= api.AS_SCRUB_ADV);
  }
});

test('media blob cache reuses URLs, revokes replacements and resets with the bundle', t => {
  const { api, createdUrls, revokedUrls } = harness(t);
  const first = new Blob(['a']), second = new Blob(['bb']);
  const url = api.mediaUrlFor('clip.mp4', first);
  assert.equal(api.mediaUrlFor('clip.mp4', first), url);   // the same blob reuses its URL
  assert.equal(createdUrls.length, 1);
  const replacement = api.mediaUrlFor('clip.mp4', second);
  assert.notEqual(replacement, url);
  assert.deepEqual(revokedUrls, [url]);                    // the replaced URL is revoked
  api.resetMediaUrls();
  assert.deepEqual(revokedUrls, [url, replacement]);
});

test('media blob cache drops a clip larger than the media byte limit', t => {
  const { api, createdUrls } = harness(t, { MAX_MEDIA_BYTES: 8 });
  assert.equal(api.mediaUrlFor('big.mp4', new Blob(['123456789'])), null);
  assert.ok(api.mediaUrlFor('ok.mp4', new Blob(['12345678'])));
  assert.equal(createdUrls.length, 1);
});

test('a local media blob streams from an object URL while a served clip is not local', t => {
  const { api, createdUrls, revokedUrls } = harness(t);
  const blob = new Blob(['local-clip']);
  const local = api.mediaLocalUrl({ path: 'clip.mp3', src: blob });
  assert.match(local, /^blob:https:\/\/explorer\.test\//);
  assert.equal(createdUrls.length, 1);
  // The same blob reuses its URL; a different one replaces and revokes it.
  assert.equal(api.mediaLocalUrl({ path: 'clip.mp3', src: blob }), local);
  const replacement = api.mediaLocalUrl({ path: 'clip.mp3', src: new Blob(['next']) });
  assert.notEqual(replacement, local);
  assert.deepEqual(revokedUrls, [local]);
  // A served clip (string src) is not a local source: it goes through the bounded fetch.
  assert.equal(api.mediaLocalUrl({ path: 'clip.mp3', src: 'https://explorer.test/bundles/security/clip.mp3' }), null);
  api.resetMediaUrls();
  assert.deepEqual(revokedUrls, [local, replacement]);
});

test('vttPathFor finds the sibling track, and vttParse reads cue timings and text', t => {
  const { api } = harness(t);
  assert.equal(api.vttPathFor('a/b/clip.mp3'), 'a/b/clip.vtt');
  assert.equal(api.vttPathFor('Clip.WAV'), 'Clip.vtt');
  assert.equal(api.vttPathFor('plain'), 'plain.vtt');
  assert.equal(api.vttTime('00:01:02.500'), 62.5);
  assert.equal(api.vttTime('01:02.500'), 62.5);
  assert.equal(api.vttTime('nope'), null);
  const cues = api.vttParse([
    'WEBVTT', '',
    '1', '00:00:00.000 --> 00:00:01.000 align:start position:10%', 'Hello <b>world</b>',
    '', '00:01.000 --> 00:02.500', 'Second &amp; line',
    '', 'NOTE a comment', 'ignored entirely', '',
    '00:03.000 --> 00:04.000', 'Third'
  ].join('\n'));
  assert.equal(cues.length, 3);
  assert.deepEqual({ ...cues[0] }, { start: 0, end: 1, text: 'Hello <b>world</b>' });
  assert.equal(cues[1].start, 1);
  assert.equal(cues[1].end, 2.5);
  assert.equal(cues[2].start, 3);
  // Cue text is shown as plain words: WebVTT tags are dropped and its entities resolved.
  assert.equal(api.vttCueText(cues[0].text), 'Hello world');
  assert.equal(api.vttCueText('Second &amp; line'), 'Second & line');
  // A file without the WEBVTT signature yields no cues.
  assert.deepEqual(Array.from(api.vttParse('not vtt')), []);
});

test('vttTranscriptMarkdown writes the track as a bounded transcript of its cues', t => {
  const { api } = harness(t);
  const track = [
    'WEBVTT', '',
    '00:00:00.000 --> 00:00:02.000', 'Hello <b>world</b>', '',
    // A word-level track repeats its line as the highlight moves: shown once, from the first cue.
    '00:00:02.000 --> 00:00:04.000', 'Hello <u>world</u>', '',
    '00:01:05.000 --> 00:01:07.000', 'Second &amp; line', '',
    // Markdown's own specials are escaped, so a track cannot introduce markup it never had.
    '00:01:30.000 --> 00:01:32.000', '# 3 * 4 [note]', '',
    '01:02:03.000 --> 01:02:05.000', 'An hour in'
  ].join('\n');
  assert.equal(api.vttTranscriptMarkdown(track), [
    '**0:00** Hello world',
    '**1:05** Second & line',
    '**1:30** \\# 3 \\* 4 \\[note\\]',
    '**1:02:03** An hour in'
  ].join('\n\n'));
  // A file that is not a WebVTT track yields nothing, so the preview can show it as it is instead.
  assert.equal(api.vttTranscriptMarkdown('not a track'), '');
  // The transcript is bounded, so a very long track cannot fill the preview.
  let long = 'WEBVTT';
  for (let i = 0; i < api.MAX_VTT_TRANSCRIPT_CUES + 500; i++) {
    long += `\n\n00:00:${String(i % 60).padStart(2, '0')}.000 --> 00:00:${String(i % 60).padStart(2, '0')}.500\nLine ${i}`;
  }
  assert.equal(api.vttTranscriptMarkdown(long).split('\n\n').length, api.MAX_VTT_TRANSCRIPT_CUES);
});

test('vttCueAt finds the cue covering a position by binary search', t => {
  const { api } = harness(t);
  const cues = [
    { start: 0, end: 1, text: 'first' },
    { start: 2, end: 4, text: 'second' },
    { start: 4, end: 6, text: 'third' },
    { start: 8, end: 9, text: 'fourth' }
  ];
  // No cues at all, a null track, and a position outside every cue all yield nothing.
  assert.equal(api.vttCueAt([], 1), '');
  assert.equal(api.vttCueAt(null, 0), '');
  assert.equal(api.vttCueAt(cues, -1), '');
  assert.equal(api.vttCueAt(cues, 10), '');
  // A cue covers [start, end): its own start is inside, its end is outside and hands over to the
  // next cue, and the gap between cues is empty.
  assert.equal(api.vttCueAt(cues, 0), 'first');
  assert.equal(api.vttCueAt(cues, 3.5), 'second');
  assert.equal(api.vttCueAt(cues, 4), 'third');
  assert.equal(api.vttCueAt(cues, 6), '');
  // The raw cue text is returned; resolving tags and entities stays with the caller.
  assert.equal(api.vttCueAt([{ start: 0, end: 1, text: 'a <b>c</b>' }], 0.5), 'a <b>c</b>');
});

test('vttCueAt steps back through an overlap to the cue still covering the position', t => {
  const { api } = harness(t);
  // A long cue with a shorter one nested inside it: past the short cue's end, the long one resumes.
  const nested = [
    { start: 0, end: 10, text: 'long' },
    { start: 2, end: 4, text: 'short' }
  ];
  assert.equal(api.vttCueAt(nested, 3), 'short');
  assert.equal(api.vttCueAt(nested, 5), 'long');
  // The step back is bounded, so a pile of already-ended cues cannot turn the lookup into a scan.
  const pile = [{ start: 0, end: 100, text: 'cover' }];
  for (let i = 1; i <= 12; i++) pile.push({ start: i, end: i, text: `ended${i}` });
  assert.equal(api.vttCueAt(pile, 12.5), '');
});

test('localMediaBytes reads a local clip only up to the decode bound', async t => {
  const { api } = harness(t, { MAX_MEDIA_DECODE_BYTES: 8 });
  // At the bound the clip is read whole, as bytes ready to decode.
  const read = await api.localMediaBytes(new Blob(['12345678'], { type: 'audio/wav' }));
  assert.equal(read.bytes.byteLength, 8);
  assert.equal(read.type, 'audio/wav');
  // One byte over the bound is refused unread, so a large clip streams instead of being expanded.
  assert.equal(await api.localMediaBytes(new Blob(['123456789'])), null);
  // A source without a numeric size is not a local clip, and neither is a missing one.
  assert.equal(await api.localMediaBytes({ type: 'audio/wav' }), null);
  assert.equal(await api.localMediaBytes(null), null);
});
