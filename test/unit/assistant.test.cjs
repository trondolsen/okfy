// Kjøring: bash tools/node-cli/run.sh --workdir . -- --test test/unit/assistant.test.cjs
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

const { explorerPath } = require('../support/paths.cjs');

const html = fs.readFileSync(explorerPath, 'utf8');
const scripts = Array.from(html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi));
assert.equal(scripts.length, 1, 'Expected the actual, single explorer script');
const source = scripts[0][1];

function section(name) {
  const match = new RegExp(`^\\s*// -+ ${name}\\s*$`, 'm').exec(source);
  assert.ok(match, `Missing production section: ${name}`);
  return match.index;
}

// The assistant section runs without the DOM bootstrap: the functions are exercised
// directly, with the graph and helpers they read provided as context globals.
const assistantSource = source.slice(section('assistant'), section('init'));

function makeContext() {
  const opened = [];
  const decks = [{ name: 'Deck 1', items: [] }];
  const context = vm.createContext({
    URL, URLSearchParams, TextEncoder, TextDecoder, AbortController, AbortSignal, Blob,
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    escape,
    setTimeout, clearTimeout,
    document: { getElementById: () => null },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { href: 'https://explorer.test/knowledge/okfy.html', origin: 'https://explorer.test', pathname: '/knowledge/okfy.html', search: '', assign: () => {} },
    history: { replaceState: () => {}, state: null },
    window: {},
    console: { error: () => {} },
    fetch: async () => { throw new Error('Unexpected network request in test'); },
    t: (key, fallback) => (fallback != null ? fallback : key),
    esc: value => String(value == null ? '' : value),
    // The interface language and its English name are production globals the assistant reads.
    currentLang: 'en',
    englishName: tag => ({ en: 'English', fr: 'French', de: 'German', nb: 'Norwegian Bokm\u00e5l', 'en-US': 'American English' }[tag] || tag),
    renderMarkdown: () => '',
    openPreview: node => opened.push(node),
    fileMap: new Map(),
    allNodes: [], allLinks: [], links: [], bundleFiles: [],
    // A minimal deck model, mirroring the viewer's own helpers.
    decks, activeDeck: 0, deck: decks[0].items, MAX_DECKS: 8,
    cardable: node => !!node && node.kind === 'concept' && !node.runtime,
    deckHasIn: (items, path) => items.some(item => item.path === path || (item.sub && item.sub.indexOf(path) >= 0)),
    isMultiPageGuide: () => false,
    guidePagesOf: () => [],
    useDeck: i => { if (i < 0 || i >= decks.length) return; context.activeDeck = i; context.deck = decks[i].items; },
    renderDeck: () => {},
    removeDeckCardFrom: (index, path) => {
      const d = decks[index];
      if (!d) return;
      d.items = d.items.filter(entry => entry.path !== path);
      d.items.forEach(entry => { if (entry.sub) entry.sub = entry.sub.filter(p => p !== path); });
      if (index === context.activeDeck) context.deck = d.items;
    },
    // The filter panel, the legend and the preview the scene tools drive, mirroring the viewer.
    RUNTIME_DIR: '.runtime',
    query: '', searchField: '', showTags: false, showLabels: true, graphFocus: '',
    tagInclude: new Set(), tagExclude: new Set(),
    kindInclude: new Set(), kindExclude: new Set(),
    typeInclude: new Set(), typeExclude: new Set(),
    statusInclude: new Set(), statusExclude: new Set(),
    legendFilter: new Set(), allTags: [], nodes: [], dirNodes: new Map(),
    preview: { classList: { contains: () => false } }, pvBody: null,
    pvStack: [], pvIndex: -1, pvNavCalls: [],
    pvBack: () => { context.pvNavCalls.push('back'); },
    pvForward: () => { context.pvNavCalls.push('forward'); },
    searchEl: { value: '' }, searchFieldEl: { value: '' }, labelsBtn: { setAttribute: () => {} },
    presentKinds: () => ['Concept', 'Directory'],
    presentTypes: () => ['Reference', 'Guide'],
    presentStatuses: () => ['stable', 'draft'],
    groupOf: n => (n && n.kind === 'dir' ? 'Directories' : 'Concepts'),
    renderChips: () => {}, renderKindChips: () => {}, renderTypeChips: () => {}, renderStatusChips: () => {},
    updateFilterSummary: () => {}, updateView: () => {}, buildLegend: () => {},
    setShowTags: on => { context.showTags = !!on; },
    enterDir: p => { context.graphFocus = p; },
    expandTagInGraph: t => { context.tagInclude.add(t); },
    toggleTag: t => { if (context.tagInclude.has(t)) context.tagInclude.delete(t); else { context.tagInclude.add(t); context.tagExclude.delete(t); } },
    closePreview: () => {},
    tagPop: null, kindPop: null, typePop: null, statusPop: null
  });
  new vm.Script(`"use strict";\n${assistantSource}`, { filename: 'okfy-assistant' })
    .runInContext(context, { timeout: 1000 });
  return { context, opened };
}

function graph() {
  const fileMap = new Map();
  const make = (path, type, title, description, tags, body) => {
    const node = { id: path, path, kind: 'concept', type, title, description, tags: tags || [], status: '', fm: { type }, body: body || '', degree: 0 };
    fileMap.set(path, node);
    return node;
  };
  const guide = make('docs/guide.md', 'Guide', 'Guide', 'A task guide', ['start'], '# Guide\n');
  const reference = make('docs/ref.md', 'Reference', 'Reference', 'A reference page', ['ref'], '# Ref\n');
  return { fileMap, allNodes: [guide, reference], allLinks: [{ kind: 'ref', source: guide, target: reference }], guide, reference };
}

test('asAllowedUrl allows https and local loopback http, normalising a bind-all host', () => {
  const { context } = makeContext();
  assert.equal(context.asAllowedUrl('https://api.deepseek.com/chat/completions').host, 'api.deepseek.com');
  assert.equal(context.asAllowedUrl('http://localhost:9931/v1').host, 'localhost:9931');
  assert.equal(context.asAllowedUrl('http://127.0.0.1:8080/x').hostname, '127.0.0.1');
  // A local server's bind-all address — what it prints when it listens on 0.0.0.0 — and the IPv6
  // loopback are accepted and rewritten to a reachable loopback, which the page CSP covers.
  assert.equal(context.asAllowedUrl('http://0.0.0.0:8004/models').hostname, '127.0.0.1');
  assert.equal(context.asAllowedUrl('http://0.0.0.0:8004/models').host, '127.0.0.1:8004');
  assert.equal(context.asAllowedUrl('http://[::1]:8004/models').hostname, '127.0.0.1');
  assert.equal(context.asAllowedUrl('http://[::]:8004/models').hostname, '127.0.0.1');
  assert.equal(context.asAllowedUrl('http://127.0.0.2:8004/models').hostname, '127.0.0.1');
  assert.equal(context.asAllowedUrl('http://example.com/'), null);
  assert.equal(context.asAllowedUrl('http://192.168.1.10:8004/'), null);
  assert.equal(context.asAllowedUrl('ftp://example.com/'), null);
  assert.equal(context.asAllowedUrl('javascript:alert(1)'), null);
  assert.equal(context.asAllowedUrl(''), null);
});

test('asLocalBase rewrites a bind-all loopback to 127.0.0.1 and keeps the port and path', () => {
  const { context } = makeContext();
  assert.equal(context.asLocalBase('http://0.0.0.0:8004/v1'), 'http://127.0.0.1:8004/v1');
  assert.equal(context.asLocalBase('http://[::]:8004'), 'http://127.0.0.1:8004');
  assert.equal(context.asLocalBase('http://[::1]:8004/v1'), 'http://127.0.0.1:8004/v1');
  assert.equal(context.asLocalBase('http://127.0.0.2:8004'), 'http://127.0.0.1:8004');
  // The two canonical forms are left as written, and a remote host is untouched.
  assert.equal(context.asLocalBase('http://localhost:8004/v1'), 'http://localhost:8004/v1');
  assert.equal(context.asLocalBase('http://127.0.0.1:8004/v1'), 'http://127.0.0.1:8004/v1');
  assert.equal(context.asLocalBase('https://api.mistral.ai/v1'), 'https://api.mistral.ai/v1');
  assert.equal(context.asLocalBase('  http://0.0.0.0:8004  '), 'http://127.0.0.1:8004');
  assert.equal(context.asLocalBase(''), '');
});

test('asChatUrl builds OpenAI-compatible and Azure URLs', () => {
  const { context } = makeContext();
  assert.equal(context.asChatUrl({ provider: 'deepseek', base: 'https://api.deepseek.com/', model: 'deepseek-flash' }), 'https://api.deepseek.com/chat/completions');
  assert.equal(context.asChatUrl({ provider: 'llamacpp', base: 'http://localhost:9931/v1', model: 'x' }), 'http://localhost:9931/v1/chat/completions');
  assert.equal(context.asChatUrl({ provider: 'azure', base: 'https://res.openai.azure.com', model: 'deploy', apiVersion: '2024-10-21' }), 'https://res.openai.azure.com/openai/deployments/deploy/chat/completions?api-version=2024-10-21');
  assert.throws(() => context.asChatUrl({ provider: 'custom', base: '', model: '' }), /base URL/i);
  assert.throws(() => context.asChatUrl({ provider: 'azure', base: 'https://x.openai.azure.com', model: '' }), /deployment/i);
});

test('asHeaders selects the authentication header', () => {
  const { context } = makeContext();
  const bearer = context.asHeaders({ auth: 'bearer', key: 'sk-1', stream: true, oauth: {} });
  assert.equal(bearer['Authorization'], 'Bearer sk-1');
  assert.equal(bearer['Accept'], 'text/event-stream');
  assert.equal(bearer['Content-Type'], 'application/json');
  const azure = context.asHeaders({ auth: 'api-key', key: 'ak', stream: false, oauth: {} });
  assert.equal(azure['api-key'], 'ak');
  assert.equal(azure['Authorization'], undefined);
  const oauth = context.asHeaders({ auth: 'oauth', key: '', oauth: { accessToken: 'tok' }, stream: true });
  assert.equal(oauth['Authorization'], 'Bearer tok');
  const none = context.asHeaders({ auth: 'none', oauth: {} });
  assert.equal(none['Authorization'], undefined);
});

test("asModelsUrl builds each provider's model-listing URL", () => {
  const { context } = makeContext();
  assert.equal(context.asModelsUrl({ provider: 'deepseek', base: 'https://api.deepseek.com' }), 'https://api.deepseek.com/models');
  assert.equal(context.asModelsUrl({ provider: 'mistral', base: 'https://api.mistral.ai/v1/' }), 'https://api.mistral.ai/v1/models');
  assert.equal(context.asModelsUrl({ provider: 'llamacpp', base: 'http://localhost:9931/v1' }), 'http://localhost:9931/v1/models');
  assert.equal(context.asModelsUrl({ provider: 'custom', base: 'http://0.0.0.0:8004/v1' }), 'http://127.0.0.1:8004/v1/models');
  assert.equal(context.asModelsUrl({ provider: 'azure', base: 'https://res.openai.azure.com', apiVersion: '2024-10-21' }), 'https://res.openai.azure.com/openai/models?api-version=2024-10-21');
  assert.throws(() => context.asModelsUrl({ provider: 'custom', base: '' }), /base URL/i);
});

test('the audio provider endpoints normalise a bind-all base too', () => {
  const { context } = makeContext();
  const cfg = { provider: 'custom', base: 'http://0.0.0.0:8004/v1', model: 'voxtral' };
  assert.equal(context.asSpeechUrl(cfg), 'http://127.0.0.1:8004/v1/audio/speech');
  assert.equal(context.asRtUrl(cfg), 'http://127.0.0.1:8004/v1/audio/transcriptions/realtime?model=voxtral');
  assert.ok(context.asVoicesUrl(cfg, 0).startsWith('http://127.0.0.1:8004/v1/audio/voices'));
});

test('asModels reads ids, drops duplicates and formats an available price', () => {
  const { context } = makeContext();
  const ids = json => Array.from(context.asModels(json)).map(m => m.id);
  const costs = json => Array.from(context.asModels(json)).map(m => m.cost);
  assert.deepEqual(ids({ object: 'list', data: [{ id: 'b' }, { id: 'a' }, { id: 'b' }, { object: 'x' }] }), ['b', 'a']);
  assert.deepEqual(ids({ models: ['m2', 'm1'] }), ['m2', 'm1']);
  assert.deepEqual(ids({ data: [{ name: 'named' }, 42, { id: '' }] }), ['named']);
  assert.deepEqual(ids(null), []);
  // No price reported: no second line.
  assert.deepEqual(costs({ data: [{ id: 'a' }] }), ['']);
  // Per-token pricing (OpenRouter style and *_cost_per_token), shown per million tokens.
  const priced = Array.from(context.asModels({ data: [
    { id: 'openai/gpt-4o', pricing: { prompt: '0.0000025', completion: '0.00001' } },
    { id: 'free/model', pricing: { prompt: '0', completion: '0' } },
    { id: 'input-only', input_cost_per_token: '0.0000001' }
  ] }));
  assert.equal(priced[0].cost, '$2.5 in · $10 out per 1M tokens');
  assert.equal(priced[1].cost, 'free');
  assert.equal(priced[2].cost, '$0.1 in per 1M tokens');
});

test('asModels reads tool support and the reported token maximum', () => {
  const { context } = makeContext();
  const rows = Array.from(context.asModels({ data: [
    { id: 'mistral-large-latest', capabilities: { function_calling: true, vision: true }, max_context_length: 131072 },
    { id: 'no-tools', capabilities: { function_calling: false }, max_context_length: 32768 },
    { id: 'openrouter', supported_parameters: ['temperature', 'tools'], context_length: 128000, top_provider: { max_completion_tokens: 16384 } },
    { id: 'plain', context_length: 8192 },
    { id: 'silent' }
  ] }));
  assert.equal(rows[0].tools, true);
  assert.equal(rows[0].maxOutput, 131072);
  assert.equal(rows[1].tools, false);
  assert.equal(rows[2].tools, true);
  assert.equal(rows[2].maxOutput, 16384);   // an explicit output limit wins over the context window
  assert.equal(rows[3].tools, null);        // the provider reports nothing about tooling,
  assert.equal(rows[3].maxOutput, 8192);    // so the context window is the fallback maximum
  assert.equal(rows[4].tools, null);
  assert.equal(rows[4].maxOutput, 0);
  // The context window is read separately, for the context-length ring and the input arrow.
  assert.equal(rows[0].context, 131072);
  assert.equal(rows[2].context, 128000);   // the context window, not the output limit
  assert.equal(rows[3].context, 8192);
  assert.equal(rows[4].context, 0);
});

test('the usage limit follows the model context length when known', () => {
  const { context } = makeContext();
  assert.equal(context.asModelContext({ max_context_length: 200000 }), 200000);
  assert.equal(context.asModelContext({ context_window: 32000 }), 32000);
  assert.equal(context.asModelContext({ top_provider: { context_length: 64000 } }), 64000);
  assert.equal(context.asModelContext({ id: 'x' }), 0);
  // The ring and the input arrow measure the prompt against the model's context when it is set.
  context.asCfg = { maxTokens: 4096, modelContext: 200000 };
  assert.equal(context.asUsageLimit('in'), 200000);
  context.asCfg.modelContext = 0;
  assert.equal(context.asUsageLimit('in'), context.AS_LIMITS.inputTokens);   // fallback budget
});

test('asModelMetaText summarizes tool support and the token maximum', () => {
  const { context } = makeContext();
  assert.equal(context.asModelMetaText({ tools: true, maxOutput: 128000 }), 'tool calling · max 128k');
  assert.equal(context.asModelMetaText({ tools: false, maxOutput: 0 }), 'no tool calling');
  assert.equal(context.asModelMetaText({ tools: null, maxOutput: 4096 }), 'max 4.1k');
  assert.equal(context.asModelMetaText({ id: 'x' }), '');
});

test('asMaxTokensCeiling bounds the setting by the selected model', () => {
  const { context } = makeContext();
  context.asCfg = { modelMax: 131072 };
  assert.equal(context.asMaxTokensCeiling(), 131072);
  context.asCfg = { modelMax: 0 };
  assert.equal(context.asMaxTokensCeiling(), context.AS_LIMITS.maxTokens);
});

test('asSyncModelMax adopts the listing maximum and drops it for an unknown model', () => {
  const { context } = makeContext();
  context.asCfg = { provider: 'mistral', model: 'large', modelMax: 0, modelMaxFor: '' };
  context.asModelCache = { mistral: [{ id: 'large', cost: '', tools: true, maxOutput: 131072 }] };
  context.asSyncModelMax();
  assert.equal(context.asCfg.modelMax, 131072);
  assert.equal(context.asCfg.modelMaxFor, 'large');
  // A model the listing does not know drops a bound that belonged to another model.
  context.asCfg.model = 'other';
  context.asSyncModelMax();
  assert.equal(context.asCfg.modelMax, 0);
});

test('asReadForm caps max output tokens at the selected model maximum', () => {
  const { context } = makeContext();
  context.asCfg = { provider: 'mistral', model: 'large', modelMax: 131072, modelMaxFor: 'large', maxTokens: 1024, temperature: 0.2, oauth: {}, audio: { provider: 'mistral', auth: 'bearer' } };
  context.asModelCache = { mistral: [{ id: 'large', maxOutput: 131072 }] };
  context.asEls = { maxTokens: { value: '999999', setAttribute: () => {} } };
  context.asReadForm();
  assert.equal(context.asCfg.maxTokens, 131072);   // never above the model's maximum
  context.asEls.maxTokens.value = '500';
  context.asReadForm();
  assert.equal(context.asCfg.maxTokens, 500);      // a lower value is kept
});

test('asModelGroups groups fetched models by provider and includes configured presets', () => {
  const { context } = makeContext();
  context.asCfg = { provider: 'llamacpp' };
  context.asModelCache = {
    llamacpp: [{ id: 'qwen2.5-7b', cost: '' }, { id: 'llama-3.2-1b', cost: '' }],
    deepseek: [{ id: 'deepseek-chat', cost: '' }]
  };
  const shape = q => Array.from(context.asModelGroups(q)).map(g => ({ provider: g.provider, ids: Array.from(g.models).map(m => m.id) }));
  // AS_PROVIDERS order; only configured providers (base set) or already-listed ones appear.
  assert.deepEqual(shape(''), [
    { provider: 'deepseek', ids: ['deepseek-flash', 'deepseek-chat'] },   // preset merged with the fetched list
    { provider: 'mistral', ids: ['mistral-large-latest'] },               // configured preset default
    { provider: 'llamacpp', ids: ['qwen2.5-7b', 'llama-3.2-1b'] }          // fetched only
  ]);
  assert.deepEqual(shape('qwen'), [{ provider: 'llamacpp', ids: ['qwen2.5-7b'] }]);
});

test('asFromMessage keeps the thinking-mode reasoning for the tool round-trip', () => {
  const { context } = makeContext();
  const r = context.asFromMessage({ choices: [{ message: { role: 'assistant', content: '', reasoning_content: 'let me think', tool_calls: [{ id: 'a', type: 'function', function: { name: 'search_concepts', arguments: '{}' } }] } }] });
  assert.equal(r.reasoning, 'let me think');
  assert.equal(r.tool_calls.length, 1);
  assert.equal(context.asFromMessage({ choices: [{ message: { content: 'hi' } }] }).reasoning, '');
});

test('asWireMessages passes a tool-call assistant message reasoning back', () => {
  const { context } = makeContext();
  context.asCfg = { speak: false, audio: {} };
  context.asMessages = [
    { role: 'user', content: 'q' },
    { role: 'assistant', content: '', reasoning_content: 'think', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'search_concepts', arguments: '{}' } }] },
    { role: 'tool', tool_call_id: 'c1', name: 'search_concepts', content: '{}' },
    // A call the provider answered without reasoning: the field must still be present, or the
    // provider rejects the next request in thinking mode.
    { role: 'assistant', content: '', tool_calls: [{ id: 'c2', type: 'function', function: { name: 'speak', arguments: '{}' } }] },
    { role: 'tool', tool_call_id: 'c2', name: 'speak', content: '{}' },
    { role: 'assistant', content: 'answer' }
  ];
  const assistants = Array.from(context.asWireMessages()).filter(m => m.role === 'assistant');
  assert.equal(assistants[0].tool_calls.length, 1);
  assert.equal(assistants[0].reasoning_content, 'think');   // an older round keeps its reasoning
  assert.equal(assistants[1].reasoning_content, '');        // a round with none still carries the field
  assert.equal(assistants[2].reasoning_content, undefined); // a plain answer carries no reasoning
});

test('asWireMessages bounds the replay without dropping the thread of the conversation', () => {
  const { context } = makeContext();
  context.asCfg = { speak: false, audio: {} };
  const rounds = context.AS_LIMITS.toolResultKeep + 2;   // more results than the cap keeps
  const long = 'r'.repeat(context.AS_LIMITS.reasonKept + 500);
  const longResult = i => 'r' + i + '-'.repeat(context.AS_LIMITS.toolResultAged + 200);
  const shortResult = '{"created":[],"active":"Deck 1"}';
  for (let i = 0; i < rounds; i++) {
    context.asMessages.push({ role: 'user', content: 'q' + i });
    context.asMessages.push({ role: 'assistant', content: '', reasoning_content: long, tool_calls: [{ id: 'c' + i, type: 'function', function: { name: 'create_decks', arguments: '{}' } }] });
    context.asMessages.push({ role: 'tool', tool_call_id: 'c' + i, name: 'create_decks', content: i === 1 ? shortResult : longResult(i) });
  }
  const wire = context.asWireMessages();
  const tools = wire.filter(m => m.role === 'tool');
  assert.equal(tools.length, rounds);   // every tool call keeps its reply
  // The recent results stay full; a long aged one is shortened to an excerpt, never dropped.
  assert.equal(tools[rounds - 1].content, longResult(rounds - 1));
  assert.ok(tools[0].content.length < longResult(0).length);
  assert.ok(tools[0].content.startsWith('r0'));
  // A short aged result is kept whole, so the model still recalls what it did.
  assert.equal(tools[1].content, shortResult);
  // Older tool-call rounds have their reasoning shortened; the most recent is kept whole.
  const calls = wire.filter(m => m.role === 'assistant' && m.tool_calls);
  assert.equal(calls[calls.length - 1].reasoning_content, long);
  assert.ok(calls[0].reasoning_content.length < long.length);
});

test('asBoundedJson reads a bounded JSON body and rejects an oversized one', async () => {
  const { context } = makeContext();
  const ok = { body: null, text: async () => JSON.stringify({ data: [{ id: 'x' }] }) };
  assert.deepEqual(Array.from(context.asModels(await context.asBoundedJson(ok, 1000))).map(m => m.id), ['x']);
  const big = { body: null, text: async () => 'x'.repeat(2000) };
  await assert.rejects(() => context.asBoundedJson(big, 100), /too large/i);
});

test('asRequest posts JSON with omitted credentials and no redirects', async () => {
  const { context } = makeContext();
  let seen = null;
  context.fetch = async (url, opts) => {
    seen = { url, opts };
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ choices: [{ message: { content: 'hi' } }] }) };
  };
  const out = await context.asRequest(
    { provider: 'custom', base: 'https://api.example.com', model: 'm', auth: 'bearer', key: 'k', stream: false, oauth: {} },
    { model: 'm', messages: [] }
  );
  assert.equal(out.content, 'hi');
  assert.equal(seen.url, 'https://api.example.com/chat/completions');
  assert.equal(seen.opts.credentials, 'omit');
  assert.equal(seen.opts.redirect, 'error');
  assert.equal(seen.opts.headers['Authorization'], 'Bearer k');
});

test('asRequest flashes the input arrow on send and the output arrow on the reply', async () => {
  const { context } = makeContext();
  const mk = () => {
    const s = new Set();
    return { offsetWidth: 0, classList: { add(c) { s.add(c); }, remove(c) { s.delete(c); }, contains(c) { return s.has(c); } } };
  };
  const useIn = mk(), useOut = mk();
  context.asEls = { useIn, useOut };
  let release;
  const gate = new Promise(r => { release = r; });
  context.fetch = async () => {
    await gate;
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ choices: [{ message: { content: 'hi' } }] }) };
  };
  const pending = context.asRequest(
    { provider: 'custom', base: 'https://api.example.com', model: 'm', auth: 'bearer', key: 'k', stream: false, oauth: {} },
    { model: 'm', messages: [] }
  );
  // The send flashes input immediately; output waits for the reply.
  assert.equal(useIn.classList.contains('flash'), true);
  assert.equal(useOut.classList.contains('flash'), false);
  release();
  assert.equal((await pending).content, 'hi');
  assert.equal(useOut.classList.contains('flash'), true);
});

test('asReadSSE assembles streamed content and tool calls across chunk boundaries', async () => {
  const { context } = makeContext();
  const sse = [
    'data: {"choices":[{"delta":{"content":"Hel"}}]}',
    '',
    'data: {"choices":[{"delta":{"content":"lo"}}]}',
    '',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","type":"function","function":{"name":"read_concept","arguments":"{\\"path\\""}}]}}]}',
    '',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":":\\"a.md\\"}"}}]}}]}',
    '',
    'data: [DONE]',
    '',
    ''
  ].join('\n');
  const chunks = [sse.slice(0, 40), sse.slice(40)];
  let index = 0;
  const res = { body: { getReader() { return { async read() { return index < chunks.length ? { done: false, value: new TextEncoder().encode(chunks[index++]) } : { done: true }; }, releaseLock() {} }; } } };
  const deltas = [];
  const out = await context.asReadSSE(res, delta => deltas.push(delta));
  assert.equal(out.content, 'Hello');
  assert.equal(deltas.join(''), 'Hello');
  assert.equal(out.tool_calls.length, 1);
  assert.equal(out.tool_calls[0].id, 'c1');
  assert.equal(out.tool_calls[0].function.name, 'read_concept');
  assert.equal(out.tool_calls[0].function.arguments, '{"path":"a.md"}');
});

test('asMergeCall reassembles streamed tool-call fragments by index', () => {
  const { context } = makeContext();
  const calls = [];
  context.asMergeCall(calls, { index: 0, id: 'call_1', type: 'function', function: { name: 'read_concept', arguments: '{"path"' } });
  context.asMergeCall(calls, { index: 0, function: { arguments: ':"docs/x.md"}' } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, 'call_1');
  assert.equal(calls[0].function.name, 'read_concept');
  assert.equal(calls[0].function.arguments, '{"path":"docs/x.md"}');
});

test('asJwtExp reads the exp claim and tolerates non-tokens', () => {
  const { context } = makeContext();
  const payload = Buffer.from(JSON.stringify({ exp: 1700000000 })).toString('base64url');
  assert.equal(context.asJwtExp(`header.${payload}.sig`), 1700000000 * 1000);
  assert.equal(context.asJwtExp('not-a-jwt'), 0);
});

test('asParseArgs tolerates invalid JSON', () => {
  const { context } = makeContext();
  assert.equal(JSON.stringify(context.asParseArgs('{"a":1}')), '{"a":1}');
  assert.equal(JSON.stringify(context.asParseArgs('nonsense')), '{}');
  assert.equal(JSON.stringify(context.asParseArgs('')), '{}');
});

test('search_concepts matches title, description, tags and path', async () => {
  const { context } = makeContext();
  Object.assign(context, graph());
  const out = JSON.parse(await context.asExecTool('search_concepts', { query: 'refer' }));
  assert.equal(out.count, 1);
  assert.equal(out.results[0].path, 'docs/ref.md');
});

test('read_concept peeks frontmatter by default and returns the body only when asked', async () => {
  const { context } = makeContext();
  Object.assign(context, graph());
  const peek = JSON.parse(await context.asExecTool('read_concept', { path: 'docs/guide' }));
  assert.equal(peek.path, 'docs/guide.md');
  assert.deepEqual(peek.frontmatter, { type: 'Guide' });
  assert.equal(peek.body, undefined);
  assert.ok(peek.bodyChars > 0);
  const full = JSON.parse(await context.asExecTool('read_concept', { path: 'docs/guide', full: true }));
  assert.match(full.body, /# Guide/);
  const missing = JSON.parse(await context.asExecTool('read_concept', { path: 'docs/nope.md' }));
  assert.match(missing.error, /No such concept/);
});

test('list_neighbors reads the ref links', async () => {
  const { context } = makeContext();
  Object.assign(context, graph());
  const out = JSON.parse(await context.asExecTool('list_neighbors', { path: 'docs/guide.md' }));
  assert.deepEqual(out.linksTo, ['docs/ref.md']);
  assert.deepEqual(out.linkedFrom, []);
});

test('open_concept opens the node in the viewer', async () => {
  const { context, opened } = makeContext();
  Object.assign(context, graph());
  const out = JSON.parse(await context.asExecTool('open_concept', { path: 'docs/ref.md' }));
  assert.equal(out.opened, 'docs/ref.md');
  assert.equal(opened.length, 1);
  assert.equal(opened[0].path, 'docs/ref.md');
});

test('an unknown tool returns an error result', async () => {
  const { context } = makeContext();
  assert.match(JSON.parse(await context.asExecTool('nope', {})).error, /Unknown tool/);
});

test('list_decks reports the decks and their cards', async () => {
  const { context } = makeContext();
  Object.assign(context, graph());
  context.decks.push({ name: 'Tour', items: [{ path: 'docs/guide.md', sub: null, open: false }] });
  const out = JSON.parse(await context.asExecTool('list_decks', {}));
  assert.equal(out.active, 'Deck 1');
  assert.equal(out.decks.length, 2);
  assert.deepEqual(out.decks.find(d => d.name === 'Tour').cards, ['docs/guide.md']);
});

test('create_decks creates decks with names and pre-filled paths', async () => {
  const { context } = makeContext();
  Object.assign(context, graph());
  const out = JSON.parse(await context.asExecTool('create_decks', { decks: [{ name: 'Tour', paths: ['docs/guide.md', 'docs/missing.md'] }, { name: 'Model' }] }));
  assert.deepEqual(out.created, [{ name: 'Tour', added: 1, skipped: 1 }, { name: 'Model', added: 0, skipped: 0 }]);
  assert.equal(out.active, 'Model');
  assert.equal(context.decks.length, 3);
});

test('create_decks reports the maximum-deck cap per item and needs a non-empty list', async () => {
  const { context } = makeContext();
  Object.assign(context, graph());
  context.MAX_DECKS = 1;
  const capped = JSON.parse(await context.asExecTool('create_decks', { decks: [{ name: 'Extra' }] }));
  assert.match(capped.created[0].error, /maximum number of decks/);
  assert.match(JSON.parse(await context.asExecTool('create_decks', { decks: [] })).error, /non-empty/);
});

test('add_to_decks adds several cards across decks in one call', async () => {
  const { context } = makeContext();
  Object.assign(context, graph());
  await context.asExecTool('create_decks', { decks: [{ name: 'Tour' }] });
  const out = JSON.parse(await context.asExecTool('add_to_decks', { items: [
    { deck: 'Deck 1', path: 'docs/guide.md' },
    { deck: 'Tour', path: 'docs/ref.md' },
    { path: 'docs/guide.md' },
    { path: 'docs/nope.md' }
  ] }));
  assert.equal(out.added, 3);
  assert.equal(out.results.length, 4);
  assert.match(out.results[3].error, /No such concept/);
  assert.deepEqual(Array.from(context.decks[0].items, item => item.path), ['docs/guide.md']);
  assert.deepEqual(Array.from(context.decks[1].items, item => item.path), ['docs/ref.md', 'docs/guide.md']);
});

test('add_to_decks rejects non-concepts and reports duplicates', async () => {
  const { context } = makeContext();
  Object.assign(context, graph());
  const directory = { id: 'docs', path: 'docs', kind: 'dir', type: '', title: '', description: '', tags: [], status: '', fm: {}, body: '', degree: 0 };
  context.allNodes.push(directory);
  context.fileMap.set('docs', directory);
  const out = JSON.parse(await context.asExecTool('add_to_decks', { items: [{ path: 'docs' }, { path: 'docs/guide.md' }, { path: 'docs/guide.md' }] }));
  assert.match(out.results[0].error, /Only a concept/);
  assert.equal(out.results[1].added, true);
  assert.equal(out.results[2].added, false);
  assert.equal(out.added, 1);
});

test('remove_from_decks removes several pages and delete_decks removes decks', async () => {
  const { context } = makeContext();
  Object.assign(context, graph());
  await context.asExecTool('create_decks', { decks: [{ name: 'Tour', paths: ['docs/guide.md', 'docs/ref.md'] }] });
  const removed = JSON.parse(await context.asExecTool('remove_from_decks', { items: [{ deck: 'Tour', path: 'docs/guide.md' }, { deck: 'Tour', path: 'docs/missing.md' }] }));
  assert.equal(removed.removed, 1);
  assert.equal(removed.results[1].removed, false);
  const deleted = JSON.parse(await context.asExecTool('delete_decks', { names: ['Tour', 'Nope'] }));
  assert.equal(deleted.results[0].deleted, true);
  assert.match(deleted.results[1].error, /No such deck/);
  assert.ok(!context.decks.some(d => d.name === 'Tour'));
});

test('set_active_deck switches and rejects unknown decks', async () => {
  const { context } = makeContext();
  Object.assign(context, graph());
  await context.asExecTool('create_decks', { decks: [{ name: 'Tour' }] });
  assert.equal(JSON.parse(await context.asExecTool('set_active_deck', { deck: 'Deck 1' })).active, 'Deck 1');
  assert.match(JSON.parse(await context.asExecTool('set_active_deck', { deck: 'Nope' })).error, /No such deck/);
});

test('the deck tools are locked while the full-page reading view is open', async () => {
  const { context } = makeContext();
  context.deckReading = () => true;   // the user is reading the deck fullscreen
  const locked = async call => assert.match(JSON.parse(await call).error, /deck is locked/);
  await locked(context.asExecTool('create_decks', { decks: [{ name: 'X' }] }));
  await locked(context.asExecTool('add_to_decks', { items: [{ path: 'a.md' }] }));
  await locked(context.asExecTool('remove_from_decks', { items: [{ path: 'a.md' }] }));
  await locked(context.asExecTool('delete_decks', { names: ['Deck 1'] }));
  await locked(context.asExecTool('set_active_deck', { deck: 'Deck 1' }));
  // Reading the deck list still works, and the close/step actions are refused with a note.
  assert.equal(JSON.parse(await context.asExecTool('list_decks')).decks.length, 1);
  const closed = JSON.parse(await context.asExecTool('viewer_preview', { action: 'close' }));
  assert.equal(closed.closed, false);
  assert.match(closed.note, /only the user can close it/);
});

test('asCompact shortens large token counts', () => {
  const { context } = makeContext();
  assert.equal(context.asCompact(0), '0');
  assert.equal(context.asCompact(999), '999');
  assert.equal(context.asCompact(1500), '1.5k');
  assert.equal(context.asCompact(25000), '25k');
  assert.equal(context.asCompact(2000000), '2m');   // a round million drops the ".0"
  assert.equal(context.asCompact(1000000), '1m');
  assert.equal(context.asCompact(5000000), '5m');
  assert.equal(context.asCompact(10000000), '10m');
});

test('asWireMessages sends the base instruction and the generated AGENTS.md on every request', () => {
  const { context } = makeContext();
  context.asMessages.push({ role: 'user', content: 'hi' });
  const out = context.asWireMessages();
  assert.equal(out.length, 4);                    // base system + AGENTS + speech note + user
  assert.equal(out[0].role, 'system');
  assert.equal(out[0].content, context.AS_SYSTEM);
  assert.equal(out[1].role, 'system');
  assert.equal(out[1].content, context.asAgentsMd());
  assert.equal(out[2].role, 'system');
  assert.match(out[2].content, /Audio output is off/);   // audio off: the note withholds `speak`
  assert.equal(out[3].role, 'user');
  assert.match(context.AS_AGENTS, /read_concept/);
  assert.match(context.AS_AGENTS, /untrusted data/);
  assert.match(context.AS_AGENTS, /## Linking/);
  assert.match(context.AS_AGENTS, /\[#guide\]\(#guide\)/);
  assert.match(context.AS_AGENTS, /about the page open in the preview/);
  assert.match(context.AS_AGENTS, /## Speaking/);
  assert.match(context.AS_AGENTS, /commentary, not a summary/);
  assert.match(context.AS_AGENTS, /every reply/);   // speaking is the default, not an extra
  assert.match(context.AS_AGENTS, /Narrow an existing view by adding to it/);   // refine, never wipe
  // The preferred output language is appended to the static AGENTS.md, for chat and speech.
  assert.match(out[1].content, /## Output language/);
  assert.match(out[1].content, /English \(en\), the interface language/);
});

test('asStats renders the assistant session statistics page without leaking secrets', () => {
  const { context } = makeContext();
  // Before the panel is configured: no provider and no activity yet.
  let md = context.asStats();
  assert.match(md, /^# Assistant statistics\n/);
  assert.match(md, /- Status: `not configured`/);
  assert.match(md, /No tool calls yet\./);

  context.asCfg = {
    provider: 'deepseek', model: 'deepseek-flash', base: 'https://user:pass@api.deepseek.com/v1',
    auth: 'bearer', key: 'sk-secret', stream: true, temperature: 0.2, maxTokens: 1024, oauth: {},
    audio: { provider: 'deepseek', model: '', base: '', auth: 'bearer' }
  };
  context.asTokens.input = 1300;
  context.asTokens.output = 400;
  context.asTokens.calls = 2;
  context.asMessages.push({ role: 'user', content: 'hi' });
  context.asMessages.push({ role: 'assistant', content: 'ok', tool_calls: [{ id: 'a', type: 'function', function: { name: 'search_concepts', arguments: '{}' } }] });
  context.asMessages.push({ role: 'tool', name: 'search_concepts', tool_call_id: 'a', content: '[]' });
  context.asMessages.push({ role: 'error', content: 'boom' });
  md = context.asStats();
  assert.match(md, /- Provider: `deepseek`/);
  assert.match(md, /- Model: `deepseek-flash`/);
  assert.match(md, /- Base URL: `https:\/\/\u2026@api\.deepseek\.com\/v1`/);   // userinfo redacted
  assert.match(md, /- Authentication: `bearer`/);
  assert.match(md, /- API key: `set`/);
  assert.match(md, /- Input tokens: `1300`/);
  assert.match(md, /- Output tokens: `400`/);
  assert.match(md, /- Total tokens: `1700`/);
  assert.match(md, /- Requests: `2`/);
  assert.match(md, /- Messages: `4`/);
  assert.match(md, /- User turns: `1`/);
  assert.match(md, /- Assistant turns: `1`/);
  assert.match(md, /- Tool results: `1`/);
  assert.match(md, /- Errors: `1`/);
  assert.match(md, /\| `search_concepts` \| 1 \|/);
  assert.doesNotMatch(md, /sk-secret/);   // the key is never printed
  assert.doesNotMatch(md, /user:pass/);   // nor are base-URL credentials

  // OAuth shows the session state instead of an API key.
  context.asCfg.auth = 'oauth';
  context.asCfg.oauth = { accessToken: 'secret-token-value' };
  md = context.asStats();
  assert.match(md, /- OAuth session: `signed in`/);
  assert.doesNotMatch(md, /- API key:/);
  assert.doesNotMatch(md, /secret-token-value/);
});

test('asAddUsage counts the wire sizes even without token usage', () => {
  const { context } = makeContext();
  const tip = { textContent: '' };
  context.asEls = { usage: {}, usageTotal: { textContent: '' }, usageTip: tip, useInFill: { style: {} }, useOutFill: { style: {} } };
  context.asAddUsage({ prompt_tokens: 10, completion_tokens: 5 }, { sentBytes: 2048, recvBytes: 1536 });
  assert.equal(context.asTokens.sent, 2048);
  assert.equal(context.asTokens.recv, 1536);
  assert.equal(context.asTokens.lastSent, 2048);
  assert.match(tip.textContent, /Sent: 2 KB \u00b7 last 2 KB/);
  assert.match(tip.textContent, /Received: 1\.5 KB \u00b7 last 1\.5 KB/);
  // A reply that carries no token usage still counts its bytes and still renders.
  context.asAddUsage(null, { sentBytes: 1024, recvBytes: 0 });
  assert.equal(context.asTokens.sent, 3072);
  assert.equal(context.asTokens.recv, 1536);
  assert.equal(context.asTokens.calls, 1);   // only the first reply carried usage
});

test('asBytes formats a byte count in data-size units', () => {
  const { context } = makeContext();
  assert.equal(context.asBytes(0), '0 B');
  assert.equal(context.asBytes(512), '512 B');
  assert.equal(context.asBytes(1024), '1 KB');
  assert.equal(context.asBytes(1536), '1.5 KB');
  assert.equal(context.asBytes(2048), '2 KB');
  assert.equal(context.asBytes(10 * 1024), '10 KB');
  assert.equal(context.asBytes(1024 * 1024), '1 MB');
  assert.equal(context.asBytes(1536 * 1024), '1.5 MB');
  assert.equal(context.asBytes(1024 * 1024 * 1024), '1 GB');
});

test('asByteLen measures a string in UTF-8 bytes', () => {
  const { context } = makeContext();
  assert.equal(context.asByteLen('abc'), 3);
  assert.equal(context.asByteLen('\u00e9'), 2);   // é is two UTF-8 bytes
  assert.equal(context.asByteLen(''), 0);
  assert.equal(context.asByteLen(null), 0);
});

test('asRequest counts the bytes it sends and receives', async () => {
  const { context } = makeContext();
  const reply = JSON.stringify({ choices: [{ message: { content: 'hi' } }] });
  context.fetch = async () => ({
    ok: true, status: 200, headers: { get: () => 'application/json' },
    clone: () => ({ text: async () => reply }),
    json: async () => JSON.parse(reply)
  });
  const out = await context.asRequest(
    { provider: 'custom', base: 'https://api.example.com', model: 'm', auth: 'none', stream: false, oauth: {} },
    { model: 'm', messages: [{ role: 'user', content: 'hi' }] }
  );
  assert.equal(out.content, 'hi');
  assert.ok(out.sentBytes > 0);            // the JSON request body
  assert.equal(out.recvBytes, context.asByteLen(reply));
});

test('asAddUsage accumulates tokens and fills the arrow badge', () => {
  const { context } = makeContext();
  const mkArrow = () => {
    const cls = new Set();
    return { style: {}, offsetWidth: 0, classList: {
      add(c) { cls.add(c); }, remove(c) { cls.delete(c); }, contains(c) { return cls.has(c); }
    } };
  };
  const usage = {}, total = { textContent: '' }, tip = { textContent: '' };
  const useIn = mkArrow(), useOut = mkArrow(), useInFill = { style: {} }, useOutFill = { style: {} };
  const ctxArc = { style: {} };
  const CIRC = 2 * Math.PI * 9;   // the context ring's circumference
  context.asEls = { usage, usageTotal: total, usageTip: tip, useIn, useOut, useInFill, useOutFill, ctxArc };
  context.asRenderUsage();                       // always shown, zero until tokens arrive
  assert.equal(total.textContent, '0');
  assert.equal(useOutFill.style.clipPath, 'inset(100.00% 0 0 0)');   // up-arrow (output) hidden from the top
  assert.equal(useInFill.style.clipPath, 'inset(0 0 100.00% 0)');    // down-arrow (input) hidden from the bottom
  // The context ring starts empty: the dash length is one circumference and the offset hides it all.
  assert.equal(ctxArc.style.strokeDasharray, CIRC.toFixed(2));
  assert.equal(ctxArc.style.strokeDashoffset, CIRC.toFixed(2));
  context.asAddUsage(null);
  context.asAddUsage({});                        // ignored
  assert.equal(context.asTokens.calls, 0);

  context.asCfg = { maxTokens: 4096 };
  context.asAddUsage({ prompt_tokens: 1200, completion_tokens: 340 });   // OpenAI names
  context.asAddUsage({ input_tokens: 100, output_tokens: 60 });          // Anthropic-style names
  assert.equal(context.asTokens.input, 1300);
  assert.equal(context.asTokens.output, 400);
  assert.equal(context.asTokens.calls, 2);
  assert.equal(total.textContent, '1.7k');
  const tipLines = tip.textContent.split('\n');
  assert.match(tipLines[0], /^Input tokens: /);
  assert.match(tipLines[1], /^Output tokens: /);   // the output line is listed right after the input line
  assert.ok(tipLines.some(l => new RegExp('^Context length: ' + (1200).toLocaleString() + ' \\/ ').test(l)));   // the ring's reading: the largest prompt seen
  assert.match(tip.textContent, /Requests: 2/);
  // The popup also carries the wire sizes, shown in data-size units.
  assert.match(tip.textContent, /Sent: 0 B \u00b7 last 0 B/);
  assert.match(tip.textContent, /Received: 0 B \u00b7 last 0 B/);

  // Limits: output is the configured maximum; input is the fallback prompt budget.
  assert.equal(context.asUsageLimit('out'), 4096);
  assert.equal(context.asUsageLimit('in'), context.AS_LIMITS.inputTokens);
  // Each arrow shows the last reply's share of its limit (the up-arrow fills from the
  // bottom with output tokens, the down-arrow from the top with input tokens).
  const outRest = (100 - 60 / 4096 * 100).toFixed(2);                            // last output 60
  assert.equal(useOutFill.style.clipPath, `inset(${outRest}% 0 0 0)`);
  const inRest = (100 - 100 / context.AS_LIMITS.inputTokens * 100).toFixed(2);   // last input 100
  assert.equal(useInFill.style.clipPath, `inset(0 0 ${inRest}% 0)`);
  // The context ring fills clockwise from 12 o'clock by the largest prompt's share of the
  // context limit (the high-water mark, so a smaller side request cannot pull it back down).
  assert.equal(ctxArc.style.strokeDashoffset, (CIRC * (1 - 1200 / context.AS_LIMITS.inputTokens)).toFixed(2));
});

test('asFlash highlights an arrow and clears itself, tolerating missing elements', () => {
  const { context } = makeContext();
  const cls = new Set();
  const arrow = { offsetWidth: 0, classList: { add(c) { cls.add(c); }, remove(c) { cls.delete(c); }, contains(c) { return cls.has(c); } } };
  context.asFlash(arrow);
  assert.equal(arrow.classList.contains('flash'), true);   // the animation class is set
  assert.doesNotThrow(() => { context.asFlash(null); context.asFlash({}); });
});

test('asCompactCut keeps the most recent turns and never cuts the current one', () => {
  const { context } = makeContext();
  context.asMessages = [];
  for (let i = 0; i < 10; i++) { context.asMessages.push({ role: 'user', content: 'u' + i }, { role: 'assistant', content: 'a' + i }); }
  // The cut is the start of the compactKeep-th most recent user turn, a user-message boundary.
  const cut = context.asCompactCut();
  assert.equal(cut, 2 * (10 - context.AS_LIMITS.compactKeep));
  assert.equal(context.asMessages[cut].role, 'user');
  // Too little history to drop: nothing to compact.
  context.asMessages = [{ role: 'user', content: 'u' }, { role: 'assistant', content: 'a' }];
  assert.equal(context.asCompactCut(), -1);
});

test('asCompactText renders the messages being summarized and skips notices', () => {
  const { context } = makeContext();
  context.asMessages = [
    { role: 'user', content: 'Find security reviews' },
    { role: 'assistant', content: '', tool_calls: [{ type: 'function', function: { name: 'search_concepts', arguments: '{"query":"security"}' } }] },
    { role: 'tool', name: 'search_concepts', content: '[{"path":"docs/reviews/2026-10-05.md"}]' },
    { role: 'assistant', content: 'Opened the review.' },
    { role: 'notice', content: 'a compaction notice that must not be summarized' }
  ];
  const text = context.asCompactText(0, 5);
  assert.match(text, /User: Find security reviews/);
  assert.match(text, /Assistant called: search_concepts\(/);
  assert.match(text, /Result of search_concepts: /);
  assert.match(text, /Assistant: Opened the review\./);
  assert.doesNotMatch(text, /must not be summarized/);
});

test('asShouldCompact triggers near the context length and stops over budget', () => {
  const { context } = makeContext();
  context.asCfg = { budget: 0 };
  context.asMessages = [];
  for (let i = 0; i < 8; i++) { context.asMessages.push({ role: 'user', content: 'u' + i }, { role: 'assistant', content: 'a' + i }); }
  const limit = context.asUsageLimit('in');
  context.asTokens.context = Math.floor(limit * context.AS_LIMITS.compactAt) - 1;
  assert.equal(context.asShouldCompact(), false);
  context.asTokens.context = Math.ceil(limit * context.AS_LIMITS.compactAt) + 1;
  assert.equal(context.asShouldCompact(), true);
  // Once the session budget is spent the viewer stops making the extra request.
  context.asCfg.budget = 1;
  context.asTokens.input = 5;
  assert.equal(context.asShouldCompact(), false);
});

test('asCompactContext summarizes the older turns and the wire replays from the cut', async () => {
  const { context } = makeContext();
  context.asCfg = { model: 'm', budget: 0, speak: false, audio: {} };
  context.asMessages = [];
  for (let i = 0; i < 8; i++) { context.asMessages.push({ role: 'user', content: 'q' + i }, { role: 'assistant', content: 'a' + i }); }
  let asked = null;
  context.asRequest = async (cfg, body) => { asked = body; return { content: 'Earlier: the user asked q0 and q1.', usage: { prompt_tokens: 500, completion_tokens: 20 } }; };
  assert.equal(await context.asCompactContext(), true);
  assert.match(context.asCompaction.summary, /Earlier: the user asked/);
  const keep = context.AS_LIMITS.compactKeep;
  assert.equal(context.asCompaction.upto, 2 * (8 - keep));
  assert.equal(context.asCompaction.count, 1);
  assert.ok(asked && asked.messages[0].role === 'system' && /memory/.test(asked.messages[0].content));
  assert.ok(asked.messages[0].stream === undefined || asked.stream === false);
  // The summary rides as a system message and the dropped turns are gone from the replay.
  const wire = context.asWireMessages();
  assert.ok(wire.some(m => m.role === 'system' && /compacted to save context/.test(m.content)));
  assert.ok(wire.some(m => m.role === 'user' && m.content === 'q' + (8 - keep)));
  assert.ok(!wire.some(m => m.role === 'user' && m.content === 'q0'));
  // A notice marks the compaction in the transcript, and the context reading is freed.
  assert.ok(context.asMessages.some(m => m.role === 'notice'));
  assert.equal(context.asTokens.context, 0);
});

test('asDismissWarn remembers the host so the notice stays dismissed across a reload', () => {
  const { context } = makeContext();
  const store = new Map();
  context.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k)
  };
  const warn = { hidden: false }, text = { innerHTML: '', textContent: '' };
  context.asEls = { warn, warnText: text };
  context.asCfg = { base: 'https://api.deepseek.com' };
  context.asWarn();
  assert.equal(warn.hidden, false);                 // not dismissed yet
  context.asDismissWarn();                          // remember this host
  assert.equal(warn.hidden, true);
  assert.equal(context.asWarnDismissedHost(), 'api.deepseek.com');
  context.asWarnHost = null;                        // simulate a fresh load
  context.asWarn();
  assert.equal(warn.hidden, true);                 // the same host stays dismissed
  context.asCfg.base = 'https://api.mistral.ai/v1'; // a different host warns again
  context.asWarn();
  assert.equal(warn.hidden, false);
  assert.match(text.innerHTML, /api\.mistral\.ai/);
});

test('asBudgetExceeded compares the session total against the budget', () => {
  const { context } = makeContext();
  context.asTokens.input = 500;
  context.asTokens.output = 500;
  context.asCfg = { budget: 0 };
  assert.equal(context.asBudgetExceeded(), false);   // no budget set
  context.asCfg.budget = 1000;
  assert.equal(context.asBudgetExceeded(), true);    // reached counts as exceeded
  context.asCfg.budget = 1200;
  assert.equal(context.asBudgetExceeded(), false);
  context.asTokens.output = 800;                     // total 1300
  assert.equal(context.asBudgetExceeded(), true);
});

test('asSetBudget keeps a positive token count and clears anything else', () => {
  const { context } = makeContext();
  context.asCfg = { audio: {} };
  context.asEls = { budgetInput: { value: '' } };
  context.asSetBudget(50000);
  assert.equal(context.asCfg.budget, 50000);
  assert.equal(context.asEls.budgetInput.value, 50000);
  context.asSetBudget('-5');
  assert.equal(context.asCfg.budget, 0);             // a negative value clears the budget
  context.asSetBudget('nonsense');
  assert.equal(context.asCfg.budget, 0);
  assert.equal(context.asEls.budgetInput.value, '');
});

test('the common token-budget presets are positive and ascending', () => {
  const { context } = makeContext();
  const presets = Array.from(context.AS_BUDGET_PRESETS);
  assert.ok(presets.length >= 4);
  presets.forEach(v => assert.equal(Number.isInteger(v) && v > 0, true));
  for (let i = 1; i < presets.length; i++) assert.ok(presets[i] > presets[i - 1]);
});

test('asModels marks only models that report audio output', () => {
  const { context } = makeContext();
  const rows = Array.from(context.asModels({ data: [
    { id: 'audio-or', architecture: { output_modalities: ['audio', 'text'] } },
    { id: 'audio-mod', modality: 'text+audio->text+audio' },
    { id: 'audio-flag', capabilities: { audio_output: true } },
    { id: 'audio-speech-cap', capabilities: { audio_speech: true } },
    { id: 'audio-speech-top', audio_speech: true },
    { id: 'speech-in', capabilities: { audio: true } },     // audio input, not output
    { id: 'text', capabilities: { function_calling: true } }
  ] }));
  assert.equal(rows[0].audioOut, true);
  assert.equal(rows[1].audioOut, true);
  assert.equal(rows[2].audioOut, true);
  assert.equal(rows[3].audioOut, true);    // capabilities.audio_speech
  assert.equal(rows[4].audioOut, true);    // top-level audio_speech
  assert.equal(rows[5].audioOut, false);   // a speech-input model is not offered as output
  assert.equal(rows[6].audioOut, false);
});

test("the audio picker lists only the audio provider's audio-output models", () => {
  const { context } = makeContext();
  context.asCfg = { provider: 'deepseek', model: 'deepseek-flash', audio: { provider: 'llamacpp', model: '' } };
  context.asModelCache = {
    llamacpp: [
      { id: 'text-only', cost: '', audioOut: false },
      { id: 'speaks', cost: '', audioOut: true }
    ],
    deepseek: [{ id: 'deepseek-audio', cost: '', audioOut: true }]
  };
  const shape = () => Array.from(context.asModelGroups('')).map(g => ({ provider: g.provider, ids: Array.from(g.models).map(m => m.id) }));
  context.asModelPickTarget = 'audio';
  assert.deepEqual(shape(), [{ provider: 'llamacpp', ids: ['speaks'] }]);   // the audio provider, audio-capable only
  context.asModelPickTarget = null;
  assert.deepEqual(Array.from(context.asModelGroups('')).map(g => g.provider), ['deepseek', 'mistral', 'llamacpp']);   // the chat picker still groups every provider
});

test('the chat picker keeps only chat models that support tool calling', () => {
  const { context } = makeContext();
  context.asCfg = { provider: 'llamacpp', model: '', audio: { provider: 'deepseek' } };
  context.asModelCache = {
    llamacpp: [
      { id: 'chat-tools', cost: '', chatTools: true },
      { id: 'no-tools', cost: '', chatTools: false },
      { id: 'embed', cost: '', chatTools: false }
    ]
  };
  const ids = Array.from(context.asModelGroups('')).filter(g => g.provider === 'llamacpp').flatMap(g => Array.from(g.models).map(m => m.id));
  assert.deepEqual(ids, ['chat-tools']);   // a model without chat+tools is not offered
});

test('asModels drops embeddings-only and non-tool models from the chat set', () => {
  const { context } = makeContext();
  const rows = Array.from(context.asModels({ data: [
    { id: 'chat', capabilities: { completion_chat: true, function_calling: true } },
    { id: 'embed', capabilities: { embeddings: true } },
    { id: 'no-tools', capabilities: { completion_chat: true, function_calling: false } },
    { id: 'plain' }
  ] }));
  assert.equal(rows[0].chatTools, true);
  assert.equal(rows[1].chatTools, false);   // an embeddings-only model
  assert.equal(rows[2].chatTools, false);   // chat but no tool calling
  assert.equal(rows[3].chatTools, true);    // nothing reported: kept
});

test('asSpeechUrl builds OpenAI-compatible and Azure speech URLs', () => {
  const { context } = makeContext();
  assert.equal(context.asSpeechUrl({ provider: 'mistral', base: 'https://api.mistral.ai/v1/' }), 'https://api.mistral.ai/v1/audio/speech');
  assert.equal(context.asSpeechUrl({ provider: 'llamacpp', base: 'http://localhost:9931/v1' }), 'http://localhost:9931/v1/audio/speech');
  assert.equal(context.asSpeechUrl({ provider: 'azure', base: 'https://res.openai.azure.com', model: 'tts', apiVersion: '2024-10-21' }), 'https://res.openai.azure.com/openai/deployments/tts/audio/speech?api-version=2024-10-21');
  assert.throws(() => context.asSpeechUrl({ provider: 'custom', base: '' }), /base URL/i);
  assert.throws(() => context.asSpeechUrl({ provider: 'azure', base: 'https://x.openai.azure.com', model: '' }), /deployment/i);
});

test('asVoicesUrl points at the provider voice list', () => {
  const { context } = makeContext();
  assert.equal(context.asVoicesUrl({ base: 'https://api.mistral.ai/v1/' }), 'https://api.mistral.ai/v1/audio/voices?type=preset&limit=100');
  assert.equal(context.asVoicesUrl({ base: 'https://api.mistral.ai/v1' }, 100), 'https://api.mistral.ai/v1/audio/voices?type=preset&limit=100&offset=100');
  assert.throws(() => context.asVoicesUrl({ base: '' }), /base URL/i);
});

test('asVoiceList follows the voice endpoint pagination', async () => {
  const { context } = makeContext();
  const cfg = { provider: 'mistral', base: 'https://api.mistral.ai/v1', auth: 'bearer', key: 'k' };
  const pages = {
    '0': { items: [{ id: 'v1', languages: ['en_us'] }], total: 2, page_size: 1, page: 1, total_pages: 2 },
    '1': { items: [{ id: 'v2', languages: ['fr_fr'] }], total: 2, page_size: 1, page: 2, total_pages: 2 }
  };
  const urls = [];
  context.fetch = async url => {
    urls.push(String(url));
    const m = /offset=(\d+)/.exec(String(url));
    return { ok: true, headers: { get: () => 'application/json' }, body: null, text: async () => JSON.stringify(pages[m ? m[1] : '0']) };
  };
  const items = Array.from(await context.asVoiceList(cfg, true)).map(v => v.id);
  assert.deepEqual(items, ['v1', 'v2']);   // the second page is followed and merged
  assert.equal(urls.length, 2);
  assert.match(urls[0], /limit=100/);
  assert.match(urls[1], /offset=1/);
});

test('asBuildMel builds one triangular filter per band over the requested range', () => {
  const { context } = makeContext();
  const fft = 2048, sr = 48000, nBins = fft / 2 + 1;
  const filters = context.asBuildMel(sr, fft, 12, 8000);
  assert.equal(filters.length, 12);
  const peaks = [];
  for (let i = 0; i < filters.length; i++) {
    const f = filters[i];
    assert.equal(f.length, nBins);
    let max = 0, at = -1;
    for (let k = 0; k < f.length; k++) { assert.ok(f[k] >= 0); if (f[k] > max) { max = f[k]; at = k; } }
    assert.ok(max > 0);          // every band has some weight
    peaks.push(at);
  }
  // The bands climb in frequency: each band's peak bin is at or above the previous one.
  for (let i = 1; i < peaks.length; i++) assert.ok(peaks[i] >= peaks[i - 1]);
  assert.ok(peaks[0] < peaks[peaks.length - 1]);
  // The range is capped at the requested 8 kHz, well below the 24 kHz Nyquist.
  assert.ok(peaks[peaks.length - 1] * (sr / fft) < 8000);
  // A maxHz above Nyquist is clamped rather than overrunning the bins.
  const clamped = context.asBuildMel(sr, fft, 8, 999999);
  assert.equal(clamped.length, 8);
  assert.equal(clamped[0].length, nBins);
});

test('asLogMel reports band energy in dB with the low bands first', () => {
  const { context } = makeContext();
  const fft = 2048, sr = 48000, nBins = fft / 2 + 1, binHz = sr / fft;
  const filters = context.asBuildMel(sr, fft, 6, 8000);
  const quiet = new Float32Array(nBins).fill(-100);
  const loud = Float32Array.from(quiet);
  for (let k = 0; k * binHz < 600; k++) loud[k] = -6;   // energy only in the lowest bins
  const q = context.asLogMel(quiet, filters);
  const l = context.asLogMel(loud, filters);
  assert.equal(q.length, 6);
  for (let i = 0; i < l.length; i++) assert.ok(Number.isFinite(l[i]));
  // The low band is louder than silence and gains far more than the highest band.
  assert.ok(l[0] > q[0]);
  assert.ok((l[0] - q[0]) > (l[5] - q[5]));
});

test('asReplayButton renders an icon-only replay symbol', () => {
  const { context } = makeContext();
  const markup = context.asReplayButton();
  assert.match(markup, /class="as-replay"/);
  assert.match(markup, /<svg/);
  assert.match(markup, /aria-label="Replay"/);
  assert.doesNotMatch(markup, /<span>/);   // the symbol only, with no visible label
});

test('asStopButton renders an icon-only stop symbol', () => {
  const { context } = makeContext();
  const markup = context.asStopButton();
  assert.match(markup, /class="as-stop"/);
  assert.match(markup, /<svg/);
  assert.match(markup, /aria-label="Stop"/);
  assert.doesNotMatch(markup, /<span>/);   // the symbol only, with no visible label
});

test('asReplaySpeech ignores a message without kept audio', () => {
  const { context } = makeContext();
  assert.doesNotThrow(() => context.asReplaySpeech(null));
  assert.doesNotThrow(() => context.asReplaySpeech({}));
  assert.doesNotThrow(() => context.asReplaySpeech({ speech: {} }));
});

test('the speak tool is offered for the whole session and gates itself at call time', () => {
  const { context } = makeContext();
  const names = () => Array.from(context.asToolSchema()).map(tl => tl.function.name);
  // Audio output off: the tool is still in the schema, so the tools array never changes shape.
  context.asCfg = { speak: false, audio: { model: 'tts' } };
  assert.equal(context.asSpeakAvailable(), false);
  assert.equal(names().includes('speak'), true);
  assert.match(context.AS_SPEAK_TOOL.description, /commentary/i);
  assert.match(context.AS_SPEAK_TOOL.description, /every reply/i);
  context.asCfg.speak = true;
  assert.equal(context.asSpeakAvailable(), true);
  assert.equal(names().includes('speak'), true);
  context.asCfg.audio.model = '';
  assert.equal(context.asSpeakAvailable(), false);
  assert.equal(names().includes('speak'), true);
});

test('asSpeak sends a voice and fetches audio from the audio provider', async () => {
  const { context } = makeContext();
  context.asCfg = { speak: true, audio: { provider: 'llamacpp', base: 'http://localhost:9931/v1', auth: 'none', model: 'tts', voice: 'v1' } };
  let seen = null;
  context.fetch = async (url, opts) => {
    seen = { url, opts };
    return { ok: true, headers: { get: () => 'audio/mpeg' }, body: null, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
  };
  const out = JSON.parse(await context.asSpeak('Hello there.'));
  assert.equal(out.spoken, true);
  assert.equal(out.chars, 12);
  assert.equal(out.voice, 'v1');
  assert.equal(seen.url, 'http://localhost:9931/v1/audio/speech');
  const sent = JSON.parse(seen.opts.body);
  assert.equal(sent.model, 'tts');
  assert.equal(sent.input, 'Hello there.');
  assert.equal(sent.voice_id, 'v1');   // Mistral's name for the voice
  assert.equal(sent.voice, 'v1');      // and the OpenAI-compatible name
  assert.equal(seen.opts.credentials, 'omit');
  assert.equal(seen.opts.redirect, 'error');
  // Not configured (or off) is an error result the model can read.
  context.asCfg.speak = false;
  assert.match(JSON.parse(await context.asSpeak('hi')).error, /audio output is off/i);
  context.asCfg.speak = true;
  assert.match(JSON.parse(await context.asSpeak('   ')).error, /nothing to speak/i);
});

test('asSpeak decodes a base64 audio_data reply (Mistral Voxtral TTS)', async () => {
  const { context } = makeContext();
  context.asCfg = { speak: true, audio: { provider: 'mistral', base: 'https://api.mistral.ai/v1', auth: 'bearer', key: 'k', model: 'voxtral-mini-tts-latest', voice: 'v1' } };
  context.fetch = async () => {
    const body = JSON.stringify({ audio_data: Buffer.from([9, 8, 7]).toString('base64') });
    return { ok: true, headers: { get: () => 'application/json' }, body: null, arrayBuffer: async () => new TextEncoder().encode(body).buffer };
  };
  const out = JSON.parse(await context.asSpeak('hei'));
  assert.equal(out.spoken, true);
});

test('the spoken language follows the interface language', () => {
  const { context } = makeContext();
  assert.equal(context.asLangBase('nb-NO'), 'nb');
  assert.equal(context.asLangBase(''), '');
  // The voices endpoint reports region-qualified tags with an underscore, which normalise to a
  // BCP 47 tag; the primary subtag is what matches.
  assert.equal(context.asTag('en_us'), 'en-US');
  assert.equal(context.asTag('en_gb'), 'en-GB');
  assert.equal(context.asLangBase('en_us'), 'en');
  // The covered set is the union of the voices' languages, by primary subtag.
  assert.deepEqual(Array.from(context.asSpeechLanguages([{ languages: ['en'] }, { languages: ['fr', 'en'] }], 'x')), ['en', 'fr']);
  assert.deepEqual(Array.from(context.asSpeechLanguages([{ languages: ['en_us', 'en_gb'] }], 'x')), ['en']);
  // No voice reports languages: coverage is unknown.
  assert.equal(context.asSpeechLanguages([{ id: 'v' }], 'custom-tts'), null);
  // A Voxtral model falls back to the documented set, so its coverage is known.
  assert.deepEqual(Array.from(context.asSpeechLanguages([{ id: 'v' }], 'voxtral-mini-tts-latest')), ['en', 'fr', 'es', 'pt', 'it', 'nl', 'de', 'hi', 'ar']);
  // The interface language is spoken whatever the voices cover — the covered set is only a
  // recommendation used to prefer a matching voice and to word the note.
  assert.equal(context.asSpeechLang('fr'), 'fr');
  assert.equal(context.asSpeechLang('nb'), 'nb');   // not covered: still spoken
  assert.equal(context.asSpeechLang('nb-NO'), 'nb');
  assert.equal(context.asSpeechLang(''), 'en');
  assert.equal(context.asVoiceFor([{ id: 'a', languages: ['en'] }, { id: 'b', languages: ['fr'] }], 'fr'), 'b');
  assert.equal(context.asVoiceFor([{ id: 'a', languages: ['en'] }], 'nb'), '');
});

test('asSpeechNote names the spoken language and recommends English as a fallback', () => {
  const { context } = makeContext();
  context.asCfg = { speak: true, audio: { model: 'voxtral-mini-tts-latest' } };
  context.currentLang = 'fr';
  context.asSpeechPlan = { key: 'x', lang: 'fr', voice: 'v', supported: ['en', 'fr'] };
  const covered = context.asSpeechNote();
  assert.match(covered, /French \(fr\)/);
  assert.doesNotMatch(covered, /English is an acceptable fallback/);   // covered: no fallback advice
  // The interface language is not one the model lists: it is still recommended, English as a fallback.
  context.currentLang = 'nb';
  context.asSpeechPlan = { key: 'x', lang: 'nb', voice: 'v', supported: ['en', 'fr'] };
  const uncovered = context.asSpeechNote();
  assert.match(uncovered, /Norwegian Bokm/);
  assert.match(uncovered, /English is an acceptable fallback/);
  // Coverage unknown: the interface language is named with no fallback advice.
  context.asSpeechPlan = { key: 'x', lang: 'nb', voice: 'v', supported: null };
  assert.doesNotMatch(context.asSpeechNote(), /English is an acceptable fallback/);
  // Audio output off: the note tells the model not to call `speak`.
  context.asCfg.speak = false;
  assert.match(context.asSpeechNote(), /Audio output is off/);
});

test('asAgentsMd names the preferred output language for chat and speech', () => {
  const { context } = makeContext();
  context.currentLang = 'fr';
  const md = context.asAgentsMd();
  assert.match(md, /## Output language/);
  assert.match(md, /Write your replies in French \(fr\), the interface language/);
  assert.match(md, /switch to French \(fr\) now/);   // an explicit mid-session switch, not just a default
  assert.match(md, /`speak` commentary is spoken in the same language/);
  assert.match(md, /## Linking/);   // the static instructions still ride along
  // The language follows the setting, so changing it changes the instructions.
  context.currentLang = 'de';
  assert.match(context.asAgentsMd(), /German \(de\)/);
});

test('asLangChanged drops the spoken-language plan so the new language is decided afresh', () => {
  const { context } = makeContext();
  context.asCfg = { audio: {} };
  context.asEls = {};   // no Voice field to refresh
  context.asSpeechPlan = { key: 'x', lang: 'fr', voice: 'v', supported: ['en'] };
  context.asLangChanged();
  assert.equal(context.asSpeechPlan, null);
});

test('asVoiceRows sorts the voices by display name', () => {
  const { context } = makeContext();
  context.asCfg = { audio: { provider: 'mistral', base: 'https://api.mistral.ai/v1' } };
  context.asVoicesCache = { key: 'mistral|https://api.mistral.ai/v1', items: [
    { id: 'p', name: 'Paul - Neutral' },
    { id: 'b', name: 'Béatrice' },
    { id: 'o', name: 'Oliver - Neutral' },
    { id: 'v10', name: 'Voice 10' },
    { id: 'v2', name: 'Voice 2' }
  ] };
  const names = Array.from(context.asVoiceRows('')).map(v => v.name);
  // Sorted by display name, case and accents folded, digit runs ordered numerically.
  assert.deepEqual(names, ['Béatrice', 'Oliver - Neutral', 'Paul - Neutral', 'Voice 2', 'Voice 10']);
});

test('asVoiceRows lists the provider voices with their languages', () => {
  const { context } = makeContext();
  context.asCfg = { audio: { provider: 'mistral', base: 'https://api.mistral.ai/v1' } };
  context.asVoicesCache = { key: 'mistral|https://api.mistral.ai/v1', items: [
    { id: 'v1', name: 'Alice', languages: ['en', 'fr'], gender: 'female' },
    { id: 'v2', languages: ['de'] },
    { id: '' }
  ] };
  const rows = Array.from(context.asVoiceRows('')).map(v => ({ id: v.id, name: v.name }));
  assert.deepEqual(rows, [{ id: 'v1', name: 'Alice' }, { id: 'v2', name: 'v2' }]);   // a name falls back to the id, an id-less voice is dropped
  assert.equal(context.asVoiceRows('ali').length, 1);
  assert.equal(context.asVoiceRows('nope').length, 0);
  assert.equal(context.asVoiceMeta({ languages: ['en', 'fr'], gender: 'female' }), 'English, French \u00b7 female');
  assert.equal(context.asVoiceMeta({ languages: ['en_us'] }), 'American English');   // underscore tags normalise for the name lookup
  assert.equal(context.asVoiceMeta({}), '');
});

test('the voice field shows the provider name and keeps the id as the value', () => {
  const { context } = makeContext();
  context.asCfg = { audio: { provider: 'mistral', base: 'https://api.mistral.ai/v1', voice: 'v1' } };
  context.asVoicesCache = { key: 'mistral|https://api.mistral.ai/v1', items: [
    { id: 'v1', name: 'Paul - Neutral', languages: ['en_us'] }
  ] };
  assert.equal(context.asVoiceLabel('v1'), 'Paul - Neutral');
  assert.equal(context.asVoiceLabel('unknown'), 'unknown');       // a typed id is shown as it is
  assert.equal(context.asVoiceId('Paul - Neutral'), 'v1');        // the display name maps back to the id
  assert.equal(context.asVoiceId('v9'), 'v9');                    // an id the provider did not list
  assert.equal(context.asVoiceId(''), '');
});

test('asResolveVoice picks a voice for the interface language', async () => {
  const { context } = makeContext();
  context.currentLang = 'fr';
  context.asCfg = { speak: true, audio: { provider: 'mistral', base: 'https://api.mistral.ai/v1', auth: 'bearer', key: 'k', model: 'voxtral-mini-tts-latest', voice: '' } };
  context.fetch = async url => {
    assert.match(String(url), /\/audio\/voices\?type=preset/);
    return { ok: true, headers: { get: () => 'application/json' }, body: null, text: async () => JSON.stringify({ items: [
      { id: 'en-voice', type: 'preset', languages: ['en'] },
      { id: 'fr-voice', type: 'preset', languages: ['fr', 'en'] }
    ] }) };
  };
  assert.equal(await context.asResolveVoice(context.asCfg.audio), 'fr-voice');
  // No voice lists the interface language: the provider's first voice is used (the language is
  // still spoken — coverage is only a recommendation).
  context.currentLang = 'nb';
  assert.equal(await context.asResolveVoice(context.asCfg.audio), 'en-voice');
  // A voice set in Settings always wins.
  context.asCfg.audio.voice = 'mine';
  assert.equal(await context.asResolveVoice(context.asCfg.audio), 'mine');
});

test('asModels marks the realtime transcription capability', () => {
  const { context } = makeContext();
  const rows = Array.from(context.asModels({ data: [
    { id: 'rt-cap', capabilities: { audio_transcription_realtime: true } },
    { id: 'rt-top', audio_transcription_realtime: true },
    { id: 'rt-alt', capabilities: { transcription_realtime: true } },
    // A realtime-capable model the provider also flags as batch-capable.
    { id: 'voxtral-mini-transcribe-realtime-2602', capabilities: { audio_transcription_realtime: true, audio_transcription: true } },
    // A batch-only model, an audio-input model and a TTS model are not offered for the microphone.
    { id: 'batch-only', capabilities: { audio_transcription: true } },
    { id: 'audio-input', capabilities: { audio: true } },
    { id: 'voxtral-mini-tts-2603', capabilities: { audio_speech: true } },
    { id: 'chat', capabilities: { function_calling: true } }
  ] }));
  // Only the models that report the realtime capability itself are offered; the name alone is not enough.
  assert.equal(rows[0].transcribeRealtime, true);
  assert.equal(rows[1].transcribeRealtime, true);
  assert.equal(rows[2].transcribeRealtime, true);
  assert.equal(rows[3].transcribeRealtime, true);
  assert.equal(rows[4].transcribeRealtime, false);   // batch only
  assert.equal(rows[5].transcribeRealtime, false);   // audio input, but not the realtime capability
  assert.equal(rows[6].transcribeRealtime, false);   // text to speech
  assert.equal(rows[7].transcribeRealtime, false);   // a plain chat model
});

test('asRtUrl builds the realtime WebSocket URL and the token endpoint', () => {
  const { context } = makeContext();
  assert.equal(context.asRtUrl({ base: 'https://api.mistral.ai/v1/', model: 'voxtral-mini-transcribe-realtime-2602' }), 'https://api.mistral.ai/v1/audio/transcriptions/realtime?model=voxtral-mini-transcribe-realtime-2602');
  assert.equal(context.asRtUrl({ base: 'http://localhost:9931/v1', model: 'a/b' }), 'http://localhost:9931/v1/audio/transcriptions/realtime?model=a%2Fb');
  assert.equal(context.asRtSessionUrl({ base: 'https://api.mistral.ai/v1/' }), 'https://api.mistral.ai/v1/client/sessions');
  assert.throws(() => context.asRtUrl({ base: '', model: 'm' }), /base URL/i);
  assert.throws(() => context.asRtUrl({ base: 'https://api.mistral.ai/v1', model: '' }), /model/i);
  assert.throws(() => context.asRtSessionUrl({ base: '' }), /base URL/i);
});

test('the realtime wire helpers encode the token, messages, PCM and events', () => {
  const { context } = makeContext();
  // The token request body, and the token read back from the session response.
  assert.equal(context.asRtTokenBody('voxtral-x'), '{"purpose":"realtime","model":"voxtral-x"}');
  assert.equal(context.asRtTokenFrom({ client_secret: { value: 'rt_1' } }), 'rt_1');
  assert.equal(context.asRtTokenFrom({ client_secret: 'rt_2' }), 'rt_2');
  assert.equal(context.asRtTokenFrom({}), '');
  // Client messages carry a type and their fields.
  assert.equal(context.asRtMsg('input_audio.flush'), '{"type":"input_audio.flush"}');
  assert.equal(context.asRtMsg('input_audio.append', { audio: 'AA==' }), '{"type":"input_audio.append","audio":"AA=="}');
  // Float samples become signed 16-bit PCM, clamped at the rails.
  assert.deepEqual(Array.from(context.asPcm16(new Float32Array([0, 1, -1, 2, -2, 0.5]))), [0, 32767, -32768, 32767, -32768, 16383]);
  // Base64 of a byte view.
  assert.equal(context.asB64(new Uint8Array([0, 0, 1, 0])), 'AAABAA==');
  // Resampling is a no-op at the same rate.
  assert.equal(context.asResample(new Float32Array([0, 1, 2, 3]), 16000, 16000).length, 4);
  // Server events decode into { type, text, error } (spread, since the vm realm differs).
  const ev = s => ({ ...context.asRtEvent(s) });
  assert.deepEqual(ev('{"type":"transcription.text.delta","text":"hi"}'), { type: 'transcription.text.delta', text: 'hi', error: '' });
  assert.deepEqual(ev('{"type":"error","error":{"message":"nope"}}'), { type: 'error', text: '', error: 'nope' });
  assert.deepEqual(ev('{"type":"error","error":{"message":{"detail":"bad"}}}'), { type: 'error', text: '', error: 'bad' });
  assert.equal(context.asRtEvent('not json'), null);
  assert.equal(context.asRtEvent('{"no":"type"}'), null);
});

test('a transcription overload is reported as a short actionable message', () => {
  const { context } = makeContext();
  // The provider's opaque gRPC / queue-overflow dump is replaced with a short notice.
  const overload = context.asTranscribeErrorText('gRPC streaming transcription error: <AioRpcError ... QueueOverflowError ...>');
  assert.match(overload, /overloaded/);
  assert.doesNotMatch(overload, /AioRpcError/);
  assert.match(context.asTranscribeErrorText('HTTP 429 Too Many Requests'), /overloaded/);
  // Anything else is passed through as the provider sent it.
  assert.equal(context.asTranscribeErrorText('The transcription connection failed.'), 'The transcription connection failed.');
  assert.equal(context.asTranscribeErrorText(''), '');
  // Classification drives whether listening continues.
  assert.equal(context.asTranscribeOverload('grpc QueueOverflowError'), true);
  assert.equal(context.asTranscribeOverload('HTTP 503'), true);
  assert.equal(context.asTranscribeOverload('Invalid API key'), false);
});

test('an overload leaves the microphone on so the user can speak again', () => {
  const { context } = makeContext();
  const errors = [], mic = [];
  context.asError = m => errors.push(m);
  context.asSetMic = v => mic.push(v);
  context.asMicClearBubble = () => {};
  context.asMicPrewarm = () => {};
  const session = () => ({ gen: 1, ws: null, ready: true, ending: false, ended: false, endSent: false, done: false,
    text: '', bufs: [], bufBytes: 0, queue: [], queueBytes: 0, draining: false, drainTimer: 0, timer: 0 });

  context.asMicRt = session();
  context.asMicRtFail(1, new Error('gRPC stream aborted: QueueOverflowError'));
  assert.deepEqual(mic, []);                          // listening is left on for a retry
  assert.equal(errors.length, 1);
  assert.match(errors[0], /overloaded/);
  assert.ok(context.asMicHoldUntil > Date.now());      // a brief hold before a fresh session opens

  // A non-transient failure still stops listening, as before.
  context.asMicRt = session();
  context.asMicRtFail(1, new Error('Invalid API key'));
  assert.deepEqual(mic, [false]);
  assert.equal(errors.length, 2);
});

test('the realtime audio send queue paces a backlog and holds the end until it drains', () => {
  const { context } = makeContext();
  const sent = [], timers = [];
  context.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  context.clearTimeout = () => {};
  const frame = n => new Int16Array(8000).fill(n);   // 8000 samples = 0.5 s at 16 kHz
  context.asMicRt = { gen: 1, ws: { readyState: 1, send: t => sent.push(JSON.parse(t).type) }, ready: true,
    ending: false, ended: false, endSent: false, done: false, text: '', bufs: [], bufBytes: 0,
    queue: [], queueBytes: 0, draining: false, drainTimer: 0, timer: 0 };

  // The handshake backlog is queued whole, then drained one frame per frame-time — not in a burst.
  context.asMicEnqueue(context.asMicRt, frame(1));
  context.asMicEnqueue(context.asMicRt, frame(2));
  context.asMicEnqueue(context.asMicRt, frame(3));
  context.asMicDrain(1);
  assert.deepEqual(sent, ['input_audio.append']);   // only the first frame went out
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 500);                  // paced by one frame's worth of audio
  timers.shift().fn();
  assert.equal(sent.length, 2);
  timers.shift().fn();
  assert.equal(sent.length, 3);
  assert.equal(timers.length, 0);                   // drained: no pacing timer left

  // A live frame with an idle queue still goes out at once, adding no latency.
  context.asMicQueue(1, frame(4));
  assert.equal(sent.length, 4);

  // The end markers wait for the queued audio rather than overtaking it.
  context.asMicEnqueue(context.asMicRt, frame(5));
  context.asMicEnqueue(context.asMicRt, frame(6));
  context.asMicRtEndSend(1);
  assert.equal(sent.indexOf('input_audio.end'), -1);
  while (timers.length) timers.shift().fn();
  assert.equal(sent[sent.length - 1], 'input_audio.end');
  assert.ok(sent.indexOf('input_audio.flush') >= 0);
});

test('asMicDescribeError explains a getUserMedia failure', () => {
  const { context } = makeContext();
  const denied = context.asMicDescribeError({ name: 'NotAllowedError' });
  assert.match(denied, /permission was denied/i);
  assert.match(denied, /operating system/i);   // the OS-level permission
  assert.match(denied, /browser/i);            // and the browser-level permission
  assert.match(context.asMicDescribeError({ name: 'NotFoundError' }), /no microphone/i);
  assert.match(context.asMicDescribeError({ name: 'NotReadableError' }), /in use/i);
  assert.match(context.asMicDescribeError({ name: 'OverconstrainedError' }), /not available/i);
  assert.equal(context.asMicDescribeError({ message: 'boom' }), 'boom');
});

test('asMicContextIssue allows this secure top-level page', () => {
  const { context } = makeContext();
  assert.equal(context.asMicContextIssue(), '');
});

test('the input picker lists only the audio provider\u2019s realtime models', () => {
  const { context } = makeContext();
  context.asCfg = { provider: 'deepseek', model: 'deepseek-flash', input: { provider: 'mistral', model: '' } };
  context.asModelCache = {
    mistral: [
      { id: 'voxtral-mini-transcribe-realtime-2602', cost: '', transcribeRealtime: true },
      { id: 'voxtral-mini-batch', cost: '', transcribeRealtime: false }
    ],
    deepseek: [{ id: 'deepseek-audio', cost: '', transcribeRealtime: true }]
  };
  context.asModelPickTarget = 'input';
  const shape = () => Array.from(context.asModelGroups('')).map(g => ({ provider: g.provider, ids: Array.from(g.models).map(m => m.id) }));
  assert.deepEqual(shape(), [{ provider: 'mistral', ids: ['voxtral-mini-transcribe-realtime-2602'] }]);   // the input provider, realtime-capable only
  context.asModelPickTarget = null;
});

test('asMicFold is not fooled when speech starts during calibration', () => {
  const { context } = makeContext();
  const st = context.asMicFresh();
  // The user speaks from the first frame, so calibration sees only speech. The floor is capped,
  // so the utterance is still detected instead of being swallowed as "the room".
  for (let i = 0; i < 3; i++) context.asMicFold(st, 0.3, 100);
  assert.equal(st.speaking, false);   // still calibrating
  for (let i = 0; i < 2; i++) context.asMicFold(st, 0.3, 100);
  assert.equal(st.speaking, true);
});

test('asMicReset keeps the learned floor so the next utterance opens at once', () => {
  const { context } = makeContext();
  const st = context.asMicFresh();
  for (let i = 0; i < 8; i++) context.asMicFold(st, 0.01, 60);   // the room is calibrated
  const floor = st.floor, calMs = st.calMs;
  const r = context.asMicReset(st);
  assert.equal(r.speaking, false);
  assert.equal(r.done, false);
  assert.equal(r.floor, floor);     // the room level is remembered, not re-learned
  assert.equal(r.calMs, calMs);
  for (let i = 0; i < 4; i++) context.asMicFold(r, 0.3, 60);
  assert.equal(r.speaking, true);   // the onset fires with no recalibration delay
});

test('asMicFold needs a louder, longer onset to interrupt the assistant', () => {
  const { context } = makeContext();
  const st = context.asMicFresh();
  for (let i = 0; i < 8; i++) context.asMicFold(st, 0.01, 60);   // a quiet room
  // Above the normal onset (0.025) but below the barge onset (0.04): no interruption.
  for (let i = 0; i < 10; i++) context.asMicFold(st, 0.03, 60, true);
  assert.equal(st.speaking, false);
  // A clearly louder voice interrupts.
  for (let i = 0; i < 8; i++) context.asMicFold(st, 0.5, 60, true);
  assert.equal(st.speaking, true);
});

test('asMicFold decides when the user has finished speaking', () => {
  const { context } = makeContext();
  const st = context.asMicFresh();
  for (let i = 0; i < 20; i++) context.asMicFold(st, 0.005, 60);   // a quiet room (calibrates first)
  assert.equal(st.speaking, false);
  assert.equal(st.done, false);
  context.asMicFold(st, 0.2, 100);   // one loud frame is below the onset window
  assert.equal(st.speaking, false);
  context.asMicFold(st, 0.2, 100);
  context.asMicFold(st, 0.2, 100);   // sustained loudness crosses onset: speech has started
  assert.equal(st.speaking, true);
  context.asMicFold(st, 0.0, 300);   // a brief pause does not end the utterance
  assert.equal(st.done, false);
  context.asMicFold(st, 0.0, 1000);  // sustained quiet does
  assert.equal(st.done, true);
});

test('asMicFold calibrates the room and then detects a soft utterance', () => {
  const { context } = makeContext();
  const st = context.asMicFresh();
  for (let i = 0; i < 10; i++) context.asMicFold(st, 0.004, 60);   // a quiet room sets a low floor
  for (let i = 0; i < 6; i++) context.asMicFold(st, 0.04, 60);     // a soft voice, below a fixed 0.06
  assert.equal(st.speaking, true);   // the onset follows the learned floor, not a fixed level
});

test('asMicFold needs a louder onset in a noisy room', () => {
  const { context } = makeContext();
  const st = context.asMicFresh();
  for (let i = 0; i < 40; i++) context.asMicFold(st, 0.04, 60);   // a steady room hum
  for (let i = 0; i < 5; i++) context.asMicFold(st, 0.05, 60);    // above the old fixed threshold
  assert.equal(st.speaking, false);   // the floor rose, so this is still the room
  for (let i = 0; i < 5; i++) context.asMicFold(st, 0.2, 60);      // real speech
  assert.equal(st.speaking, true);
});

test('asMicFold caps a long utterance', () => {
  const { context } = makeContext();
  const st = context.asMicFresh();
  for (let i = 0; i < 10; i++) context.asMicFold(st, 0.005, 60);   // calibrate the quiet room first
  context.asMicFold(st, 0.2, 300);   // cross the onset window
  assert.equal(st.speaking, true);
  for (let i = 0; i < 60; i++) context.asMicFold(st, 0.2, 500);   // keep talking, never quiet
  assert.equal(st.done, true);
});

test('asMicAsk asks at once when the assistant is idle', () => {
  const { context } = makeContext();
  let asked = 0;
  context.asAgent = () => { asked += 1; };   // the turn itself is not under test here
  context.asPreflight = () => true;
  context.asBusy = false;
  context.asMicAsk();
  assert.equal(asked, 1);
  assert.equal(context.asPendingAsk, false);
});

test('a question spoken while the assistant is busy is held and asked when the turn ends', () => {
  const { context } = makeContext();
  let asked = 0;
  context.asAgent = () => { asked += 1; };
  context.asPreflight = () => true;
  context.asMessages = [
    { role: 'user', content: 'q1' },
    { role: 'user', content: 'spoken mid-turn', queued: true },   // the bubble opened during the turn
    { role: 'assistant', content: 'a1' }                          // the turn's own reply followed it
  ];
  context.asBusy = true;                       // thinking, calling tools or replying
  context.asMicAsk();
  assert.equal(context.asPendingAsk, true);    // the question is held, not asked mid-turn
  assert.equal(asked, 0);
  context.asBusy = false;
  context.asDrainPendingAsk();                 // the turn ended: the held question goes out
  assert.equal(asked, 1);
  assert.equal(context.asPendingAsk, false);
  // The spoken question now sits after the turn's own messages, so the request ends with it.
  assert.deepEqual(context.asMessages.map(m => m.content), ['q1', 'a1', 'spoken mid-turn']);
  assert.equal(context.asMessages[2].queued, undefined);
  context.asDrainPendingAsk();                 // nothing held: no extra turn
  assert.equal(asked, 1);
});

test('the speak tool routes to the speech client', async () => {
  const { context } = makeContext();
  context.asCfg = { speak: false, audio: { model: '' } };
  const out = JSON.parse(await context.asExecTool('speak', { text: 'hi' }));
  assert.match(out.error, /audio output is off/i);
});

test('asCommentary does nothing while audio output is off', async () => {
  const { context } = makeContext();
  context.asCfg = { speak: false, audio: { model: 'tts' }, model: 'm' };
  context.asMessages.push({ role: 'user', content: 'hi' });
  context.asMessages.push({ role: 'assistant', content: 'hello' });
  let requests = 0;
  context.fetch = async () => { requests++; throw new Error('no network in this test'); };
  await context.asCommentary(0);
  assert.equal(requests, 0);
});

test('asCommentary forces a speak call when the model did not speak', async () => {
  const { context } = makeContext();
  context.asCfg = { speak: true, provider: 'llamacpp', base: 'http://localhost:9931/v1', auth: 'none', model: 'm', maxTokens: 1024, modelMax: 8192, audio: { provider: 'llamacpp', base: 'http://localhost:9931/v1', auth: 'none', model: 'tts', voice: 'v1' } };
  context.asMessages.push({ role: 'user', content: 'What is the state of security in okfy?' });
  context.asMessages.push({ role: 'assistant', content: 'It is thorough.' });
  const seen = [];
  context.fetch = async (url, opts) => {
    seen.push({ url: String(url), opts });
    if (String(url).indexOf('/audio/speech') >= 0) {
      return { ok: true, headers: { get: () => 'audio/mpeg' }, body: null, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
    }
    return { ok: true, headers: { get: () => 'application/json' }, json: async () => ({ choices: [{ message: { role: 'assistant', content: '', reasoning_content: 'thinking about what to say', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'speak', arguments: JSON.stringify({ text: 'Security looks solid.' }) } }] } }] }) };
  };
  await context.asCommentary(0);
  const chat = seen.find(s => s.url.indexOf('/chat/completions') >= 0);
  assert.ok(chat, 'asked the model for commentary');
  const sent = JSON.parse(chat.opts.body);
  assert.equal(sent.tool_choice.type, 'function');
  assert.equal(sent.tool_choice.function.name, 'speak');   // the tool is forced
  assert.equal(sent.stream, false);
  assert.equal(sent.max_tokens, context.AS_LIMITS.speakAskTokens);
  assert.ok(seen.some(s => s.url.indexOf('/audio/speech') >= 0), 'spoke the commentary it got');
  // A thinking-mode model requires the reasoning that produced the forced tool call to ride back
  // with it, so the next request is accepted.
  const spokeMsg = context.asMessages.filter(m => m.role === 'assistant' && m.tool_calls && m.tool_calls.length).pop();
  assert.equal(spokeMsg.reasoning_content, 'thinking about what to say');
  assert.equal(context.asWireMessages().filter(m => m.role === 'assistant' && m.tool_calls).pop().reasoning_content, 'thinking about what to say');
});

test('asCommentary reserves the speak reply so the tool call is never left unanswered', async () => {
  const { context } = makeContext();
  context.asCfg = { speak: true, provider: 'llamacpp', base: 'http://localhost:9931/v1', auth: 'none', model: 'm', maxTokens: 1024, modelMax: 8192, audio: { provider: 'llamacpp', base: 'http://localhost:9931/v1', auth: 'none', model: 'tts', voice: 'v1' } };
  context.asMessages.push({ role: 'user', content: 'q' });
  context.asMessages.push({ role: 'assistant', content: 'a' });
  context.fetch = async () => ({ ok: true, headers: { get: () => 'application/json' }, json: async () => ({ choices: [{ message: { role: 'assistant', content: '', tool_calls: [{ id: 's1', type: 'function', function: { name: 'speak', arguments: '{"text":"hi"}' } }] } }] }) });
  context.asExecTool = async () => { throw new Error('boom'); };   // the tool fails mid-call
  await context.asCommentary(0);
  // The reply is still present, next to the call and answering its id, so the history stays valid.
  const callAt = context.asMessages.findIndex(m => m.role === 'assistant' && m.tool_calls && m.tool_calls.length);
  assert.ok(callAt >= 0);
  // Even a forced call answered without reasoning keeps the field, or thinking mode rejects the
  // next request.
  assert.equal(context.asMessages[callAt].reasoning_content, '');
  assert.equal(context.asWireMessages().filter(m => m.role === 'assistant' && m.tool_calls).pop().reasoning_content, '');
  const reply = context.asMessages[callAt + 1];
  assert.equal(reply.role, 'tool');
  assert.equal(reply.tool_call_id, 's1');
  assert.match(reply.content, /The tool failed/);
});

// --- viewer scene tools: filters, the graph, the preview and the legend ---

test('the scene tools are offered to the model', () => {
  const { context } = makeContext();
  const names = Array.from(context.asToolSchema()).map(t => t.function.name);
  ['viewer_filters', 'viewer_legends', 'viewer_directory', 'viewer_tag',
   'viewer_preview', 'viewer_highlight', 'viewer_scroll', 'viewer_selection'].forEach(name => {
    assert.ok(names.indexOf(name) >= 0, `missing tool: ${name}`);
  });
  // The tools array is constant: `speak` is always present, so the prompt prefix stays cacheable.
  const before = JSON.stringify(context.asToolSchema());
  assert.ok(names.indexOf('speak') >= 0);
  context.asCfg = { speak: true, audio: { model: 'tts' } };
  assert.equal(JSON.stringify(context.asToolSchema()), before);
});

test('viewer_filters read reports the filter panel state', async () => {
  const { context } = makeContext();
  context.query = 'graph'; context.searchField = 'title';
  context.tagInclude.add('guide'); context.tagExclude.add('draft');
  context.kindExclude.add('Tag');
  context.typeInclude.add('Reference');
  context.statusInclude.add('stable');
  context.graphFocus = 'docs';
  context.legendFilter.add('Concepts');
  const out = JSON.parse(await context.asExecTool('viewer_filters', { action: 'read' }));
  assert.deepEqual(out.search, { query: 'graph', field: 'title' });
  assert.deepEqual(out.tags, { include: ['guide'], exclude: ['draft'] });
  assert.deepEqual(out.kinds, { include: [], exclude: ['Tag'] });
  assert.deepEqual(out.types, { include: ['Reference'], exclude: [] });
  assert.equal(out.directory, 'docs');
  assert.deepEqual(out.legends, ['Concepts']);
  assert.equal(out.active, 6);   // one per facet selection plus the search
});

test('viewer_filters set replaces a facet, sets the search and toggles Tags and Labels', async () => {
  const { context } = makeContext();
  context.tagInclude.add('old');
  const out = JSON.parse(await context.asExecTool('viewer_filters', {
    action: 'set',
    search: { query: 'nsm', field: 'tags' },
    ops: [
      { facet: 'tags', include: ['guide', 'security'] },
      { facet: 'kinds', exclude: ['Attachment'] },
      { facet: 'statuses', clear: true }
    ],
    showTags: true,
    showLabels: false
  }));
  assert.deepEqual(out.tags.include, ['guide', 'security']);   // replaced, not merged
  assert.deepEqual(out.kinds.exclude, ['Attachment']);
  assert.equal(out.search.query, 'nsm');
  assert.equal(out.showTags, true);
  assert.equal(out.showLabels, false);
  assert.equal(context.searchEl.value, 'nsm');
  assert.equal(context.searchFieldEl.value, 'tags');
});

test('viewer_filters clear empties the panel and can clear the legend', async () => {
  const { context } = makeContext();
  context.query = 'x'; context.searchField = 'title';
  context.tagInclude.add('a'); context.typeExclude.add('b'); context.statusInclude.add('c');
  context.legendFilter.add('Concepts');
  const out = JSON.parse(await context.asExecTool('viewer_filters', { action: 'clear', legends: true }));
  assert.equal(out.search.query, '');
  assert.deepEqual(out.tags, { include: [], exclude: [] });
  assert.deepEqual(out.legends, []);
  assert.equal(out.active, 0);
  assert.equal(context.searchEl.value, '');
});

test('viewer_filters list lists the values the bundle can be filtered by', async () => {
  const { context } = makeContext();
  context.allTags = ['guide', 'security/deep'];
  const out = JSON.parse(await context.asExecTool('viewer_filters', { action: 'list' }));
  assert.deepEqual(out.kinds, ['Concept', 'Directory']);
  assert.deepEqual(out.types, ['Reference', 'Guide']);
  assert.deepEqual(out.statuses, ['stable', 'draft']);
  assert.deepEqual(out.tags, ['guide', 'security/deep']);
  assert.ok(out.fields.indexOf('title') >= 0);
});

test('viewer_directory validates the path and moves the graph', async () => {
  const { context } = makeContext();
  context.dirNodes.set('docs', { path: 'docs', kind: 'dir' });
  let out = JSON.parse(await context.asExecTool('viewer_directory', { path: 'docs/' }));
  assert.deepEqual(out, { directory: 'docs', path: 'docs/' });
  assert.equal(context.graphFocus, 'docs');
  out = JSON.parse(await context.asExecTool('viewer_directory', { path: '' }));   // the root is always allowed
  assert.equal(out.directory, '');
  out = JSON.parse(await context.asExecTool('viewer_directory', { path: 'nope' }));
  assert.match(out.error, /No such directory/);
});

test('viewer_tag filters by the tag in the requested mode', async () => {
  const { context } = makeContext();
  let out = JSON.parse(await context.asExecTool('viewer_tag', { tag: 'guide' }));
  assert.deepEqual(out.tags.include, ['guide']);
  out = JSON.parse(await context.asExecTool('viewer_tag', { tag: 'guide', mode: 'exclude' }));
  assert.deepEqual(out.tags.include, []);
  assert.deepEqual(out.tags.exclude, ['guide']);
  out = JSON.parse(await context.asExecTool('viewer_tag', { tag: 'guide', mode: 'toggle' }));
  assert.deepEqual(out.tags.include, ['guide']);   // toggled back on
  assert.deepEqual(out.tags.exclude, []);
  out = JSON.parse(await context.asExecTool('viewer_tag', {}));
  assert.match(out.error, /tag/i);
});

test('viewer_legends lists and changes the selection', async () => {
  const { context } = makeContext();
  context.nodes = [{ kind: 'dir' }, { kind: 'concept' }, { kind: 'concept' }];
  let out = JSON.parse(await context.asExecTool('viewer_legends', { action: 'list' }));
  assert.deepEqual(out.groups, [
    { group: 'Concepts', count: 2, selected: false },
    { group: 'Directories', count: 1, selected: false }
  ]);
  const sel = async args => JSON.parse(await context.asExecTool('viewer_legends', Object.assign({ action: 'set' }, args))).groups;
  out = await sel({ select: ['Concepts'] });
  assert.equal(out.find(g => g.group === 'Concepts').selected, true);
  out = await sel({ unselect: ['Concepts'] });
  assert.equal(out.find(g => g.group === 'Concepts').selected, false);
  out = await sel({ select: ['Concepts', 'Directories'], clear: true });
  assert.equal(out.find(g => g.group === 'Concepts').selected, true);
  assert.equal(out.find(g => g.group === 'Directories').selected, true);
});

test('viewer_preview close reports whether a page was open', async () => {
  const { context } = makeContext();
  assert.equal(JSON.parse(await context.asExecTool('viewer_preview', { action: 'close' })).closed, false);
  context.preview = { classList: { contains: () => true } };
  assert.equal(JSON.parse(await context.asExecTool('viewer_preview', { action: 'close' })).closed, true);
});

test('the preview tools report when no page is open', async () => {
  const { context } = makeContext();
  assert.match(JSON.parse(await context.asExecTool('viewer_highlight', { texts: ['x'] })).error, /No page is open/);
  assert.match(JSON.parse(await context.asExecTool('viewer_scroll', { heading: 'X' })).error, /No heading matched/);
  assert.deepEqual(JSON.parse(await context.asExecTool('viewer_selection')), { text: '', chars: 0, inPreview: false });
});

test('viewer_preview history and back/forward read and step the history', async () => {
  const { context } = makeContext();
  context.preview = { classList: { contains: () => true } };
  context.pvStack = [
    { path: 'a.md', title: 'A', kind: 'concept' },
    { path: 'b.md', title: 'B', kind: 'concept' },
    { path: 'c.md', title: 'C', kind: 'concept' }
  ];
  context.pvIndex = 1;
  const listed = JSON.parse(await context.asExecTool('viewer_preview', { action: 'history' }));
  assert.equal(listed.open, true);
  assert.equal(listed.index, 1);
  assert.deepEqual(listed.entries.map(e => ({ i: e.index, cur: e.current, path: e.path })), [
    { i: 0, cur: false, path: 'a.md' },
    { i: 1, cur: true, path: 'b.md' },
    { i: 2, cur: false, path: 'c.md' }
  ]);
  // Stepping reports the page it moved to and drives the same Back/Forward path the buttons do.
  assert.deepEqual(JSON.parse(await context.asExecTool('viewer_preview', { action: 'back' })), { moved: true, index: 0, path: 'a.md', title: 'A' });
  assert.deepEqual(JSON.parse(await context.asExecTool('viewer_preview', { action: 'forward' })), { moved: true, index: 2, path: 'c.md', title: 'C' });
  assert.deepEqual(context.pvNavCalls, ['back', 'forward']);
});

test('the preview history tools report the ends and a closed preview', async () => {
  const { context } = makeContext();
  // No page open: nothing to step, and the history reads as closed and empty.
  assert.match(JSON.parse(await context.asExecTool('viewer_preview', { action: 'back' })).error, /No page is open/);
  const closed = JSON.parse(await context.asExecTool('viewer_preview', { action: 'history' }));
  assert.equal(closed.open, false);
  assert.deepEqual(closed.entries, []);
  // Open at the first entry: there is nothing before it, or after a single page.
  context.preview = { classList: { contains: () => true } };
  context.pvStack = [{ path: 'a.md', kind: 'concept' }];
  context.pvIndex = 0;
  assert.deepEqual(JSON.parse(await context.asExecTool('viewer_preview', { action: 'back' })), { moved: false, index: 0, note: 'No previous page.' });
  assert.deepEqual(JSON.parse(await context.asExecTool('viewer_preview', { action: 'forward' })), { moved: false, index: 0, note: 'No next page.' });
  assert.deepEqual(context.pvNavCalls, []);
});
