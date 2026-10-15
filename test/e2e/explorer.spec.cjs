const { test: base, expect } = require('@playwright/test');

const { explorerUrl: projectExplorer, fixtureExplorer, fixtureRoot, baseURL } = require('../support/paths.cjs');

// The fixture bundle is served as the root of a generated folder (support/prepare-roots.mjs),
// so the tool loads it with no bundle parameter.
const explorer = fixtureExplorer('basic');
const fixtureRootUrl = fixtureRoot('basic');

const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
        errors.push(message.text());
      }
    });

    // Styr animasjonsrammene, slik at grafen ikke flytter seg mellom avlesning og klikk.
    await page.clock.install({ time: new Date('2026-01-01T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-01-01T12:00:01Z'));
    await page.addInitScript(() => {
      // Les faktiske tegnekall uten å eksportere intern tilstand fra produksjonskoden.
      window.graphLabels = Object.create(null);
      const prototype = CanvasRenderingContext2D.prototype;
      const clearRect = prototype.clearRect;
      const arc = prototype.arc;
      const fillText = prototype.fillText;
      let point;
      prototype.clearRect = function (...args) {
        if (this.canvas.id === 'c') window.graphLabels = Object.create(null);
        return clearRect.apply(this, args);
      };
      prototype.arc = function (x, y, ...args) {
        if (this.canvas.id === 'c') point = { x, y };
        return arc.call(this, x, y, ...args);
      };
      prototype.fillText = function (text, ...args) {
        if (this.canvas.id === 'c' && point) {
          window.graphLabels[text] = { ...point, alpha: this.globalAlpha };
        }
        return fillText.call(this, text, ...args);
      };
    });

    await use(page);
    if (errors.length) {
      await testInfo.attach('browser-errors', {
        body: Buffer.from(JSON.stringify(errors, null, 2)),
        contentType: 'application/json',
      });
    }
    expect(errors, 'Nettleseren skal ikke ha JavaScript-feil').toEqual([]);
  },
});

async function loadBundle(page, depth = 'all', options = {}) {
  // Most tests drive the assistant's Settings, which is gated behind an acknowledgement of what
  // enabling a model means. Seed that acknowledgement before the page loads, unless a test opts
  // out with options.ack === false to exercise the gate itself.
  if (options.ack !== false) {
    await page.addInitScript(() => { try { localStorage.setItem('okfy.assistant.ack', '1'); } catch (e) {} });
  }
  await page.goto(`${explorer}?depth=${depth}`);
  await expect(page.locator('#overlay')).not.toHaveClass(/\bshow\b/);
  await expect(page.locator('#spinner')).toBeHidden();
  await expect(page.locator('#stats')).toContainText('files');
  // The viewer opens on the About panel and keeps it until the user interacts;
  // dismiss it so each test can drive the graph and panels unobstructed.
  await page.keyboard.press('Escape');
  await expect(page.locator('#aboutPop')).toBeHidden();
}

// The startup layout: the filter panel is collapsed and, on a desktop viewport, the
// assistant is enabled. These helpers put a test into the state it needs through the
// panels' own tabs, so a test does not depend on the default or on a slide transition.
async function setFilters(page, open) {
  await page.evaluate(open => {
    const h = document.getElementById('sideHandle');
    if ((h.getAttribute('aria-expanded') === 'true') !== open) h.click();
  }, open);
}
async function setAssistant(page, open) {
  await page.evaluate(open => {
    const b = document.getElementById('assistBtn');
    if ((b.getAttribute('aria-pressed') === 'true') !== open) b.click();
  }, open);
}

async function renderedLabels(page) {
  await page.clock.runFor(32);
  return page.evaluate(() => window.graphLabels);
}

async function clickNode(page, label, doubleClick = false) {
  await page.clock.runFor(2000);
  const point = await page.evaluate(label => window.graphLabels[label], label);
  expect(point, `Fant ikke den tegnede noden «${label}»`).toBeTruthy();
  const canvas = await page.locator('#c').boundingBox();
  expect(canvas).not.toBeNull();
  const x = canvas.x + point.x;
  const y = canvas.y + point.y;
  expect(x).toBeGreaterThan(0);
  expect(x).toBeLessThan(page.viewportSize().width);
  expect(y).toBeGreaterThan(0);
  expect(y).toBeLessThan(page.viewportSize().height);
  if (doubleClick) await page.mouse.dblclick(x, y);
  else await page.mouse.click(x, y);
}

test('assistenten er på som standard og gjør ingen ekstern forespørsel før et spørsmål', async ({ page }) => {
  const external = [];
  page.on('request', request => {
    const host = new URL(request.url()).hostname;
    if (host !== '127.0.0.1' && host !== 'localhost') external.push(request.url());
  });
  await loadBundle(page);
  // The assistant is enabled by default on a desktop viewport; the filter panel is collapsed.
  await expect(page.locator('#assistant')).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/\bas-open\b/);
  await expect(page.locator('body')).toHaveClass(/\bhide-side\b/);
  await expect(page.locator('#asInput')).toBeVisible();
  await expect(page.locator('#asWarn')).not.toBeEmpty();
  // The provider notice can be dismissed with its close button.
  await page.evaluate(() => document.getElementById('asWarnClose').click());
  await expect(page.locator('#asWarn')).toBeHidden();
  await expect(page.locator('#asUsage')).toBeVisible();   // always shown, zero until tokens arrive
  // The context-length ring sits left of the up-arrow and starts empty (offset = circumference).
  expect(await page.evaluate(() => {
    const ring = document.getElementById('asCtx');
    const up = document.getElementById('asUseOut');
    return !!(ring.compareDocumentPosition(up) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  expect(await page.evaluate(() => document.getElementById('asCtxArc').style.strokeDashoffset)).toBe((2 * Math.PI * 9).toFixed(2));
  // The transcript is content, so its text can be selected (the rest of the interface cannot).
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('asLog')).userSelect)).toBe('text');
  // Markdown links in the transcript use the accent colour, not the browser default
  // (which would be low-contrast here) and not the visited purple.
  const linkColor = await page.evaluate(() => {
    const wrap = document.createElement('span');
    wrap.className = 'as-md';
    wrap.innerHTML = '<a href="https://example.com/">x</a>';
    document.getElementById('assistant').appendChild(wrap);
    const color = getComputedStyle(wrap.querySelector('a')).color;
    wrap.remove();
    return color;
  });
  expect(linkColor).toBe('rgb(91, 141, 239)');   // --accent #5b8def
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await expect(page.locator('body')).toHaveClass(/\bas-settings-open\b/);
  await expect(page.locator('#asProvider')).toBeAttached();
  // Opening Settings hides the chat and shows the settings pane; closing restores it.
  await expect(page.locator('#asLog')).toBeHidden();
  await expect(page.locator('#asInput')).toBeHidden();
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await expect(page.locator('#asInput')).toBeVisible();
  // The settings toggle must not blank the page: the graph canvas keeps its size.
  const canvasWidth = await page.evaluate(() => Math.round(document.getElementById('c').getBoundingClientRect().width));
  expect(canvasWidth).toBeGreaterThan(0);
  // Nothing is sent until a question is asked, so no request left the page.
  expect(external).toEqual([]);
});

test('assistentinnstillingene er gated bak en bekreftelse', async ({ page }) => {
  // Without the stored acknowledgement, opening Settings shows only the gate: the provider
  // fields stay hidden until the user explicitly accepts what enabling a model means.
  await loadBundle(page, 'all', { ack: false });
  await expect(page.locator('#assistant')).toBeVisible();
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await expect(page.locator('#asGate')).toBeVisible();
  await expect(page.locator('#asProvider')).toBeHidden();
  // Continue stays disabled until the box is ticked.
  await expect(page.locator('#asAckEnable')).toBeDisabled();
  await page.evaluate(() => {
    const b = document.getElementById('asAckBox');
    b.checked = true;
    b.dispatchEvent(new Event('change'));
  });
  await expect(page.locator('#asAckEnable')).toBeEnabled();
  await page.evaluate(() => document.getElementById('asAckEnable').click());
  // The gate is gone and the config is revealed.
  await expect(page.locator('#asGate')).toBeHidden();
  await expect(page.locator('#asProvider')).toBeVisible();
  // The acknowledgement is remembered: a reload opens straight to the config.
  await loadBundle(page, 'all', { ack: false });
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await expect(page.locator('#asGate')).toBeHidden();
  await expect(page.locator('#asProvider')).toBeVisible();
});

test('avbryt lukker innstillingene uten å godta bekrefrelsen', async ({ page }) => {
  await loadBundle(page, 'all', { ack: false });
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await expect(page.locator('#asGate')).toBeVisible();
  await page.evaluate(() => document.getElementById('asAckCancel').click());
  await expect(page.locator('body')).not.toHaveClass(/\bas-settings-open\b/);
  // Reopening still shows the gate: nothing was accepted.
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await expect(page.locator('#asGate')).toBeVisible();
});

test('husker at varselnotisen er avvist for en vert', async ({ page }) => {
  await loadBundle(page);
  await expect(page.locator('#asWarn')).toBeVisible();
  await page.evaluate(() => document.getElementById('asWarnClose').click());
  await expect(page.locator('#asWarn')).toBeHidden();
  // The dismissal is remembered for this host across a reload.
  await loadBundle(page);
  await expect(page.locator('#asWarn')).toBeHidden();
  // Pointing at a different host warns again — adopting a new provider changes the chat host.
  await page.evaluate(() => {
    document.getElementById('asProvider').click();
    document.querySelector('#asProvList [data-kind="mistral"]').click();
    document.getElementById('asProvSave').click();
  });
  await expect(page.locator('#asWarn')).toBeVisible();
  await expect(page.locator('#asWarnText')).toContainText('api.mistral.ai');
});

test('setter et tokenbudsjett fra hurtigvalg', async ({ page }) => {
  await loadBundle(page);
  await expect(page.locator('#assistant')).toBeVisible();
  // The budget symbol sits right of the usage badge.
  expect(await page.evaluate(() => {
    const u = document.getElementById('asUsage');
    const b = document.getElementById('asBudget');
    return !!(u.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  // It opens the budget dialog with presets for common sessions.
  await page.evaluate(() => document.getElementById('asBudget').click());
  await expect(page.locator('#asBudgetPop')).toBeVisible();
  await expect(page.locator('#asBudgetPresets button')).toHaveCount(7);
  // A preset sets the budget, shown next to the symbol and kept in the field.
  await page.evaluate(() => document.querySelector('#asBudgetPresets button[data-v="100000"]').click());
  await expect(page.locator('#asBudgetLabel')).toHaveText('100k');
  await expect.poll(async () => page.evaluate(() => document.getElementById('asBudgetInput').value)).toBe('100000');
  // An outside press closes the dialog; the budget is remembered across a reload.
  await page.evaluate(() => document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
  await expect(page.locator('#asBudgetPop')).toBeHidden();
  await loadBundle(page);
  await expect(page.locator('#asBudgetLabel')).toHaveText('100k');
  // "No budget" clears it.
  await page.evaluate(() => document.getElementById('asBudget').click());
  await page.evaluate(() => document.getElementById('asBudgetClear').click());
  await expect(page.locator('#asBudgetLabel')).toHaveText('');
});

test('velger en lydutgangsmodell fra modellene som støtter det', async ({ page }) => {
  await loadBundle(page);
  await expect(page.locator('#assistant')).toBeVisible();
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  // Add the keyless local provider; the model roles that have no provider of their own adopt it.
  await page.evaluate(() => {
    document.getElementById('asProvider').click();
    document.querySelector('#asProvList [data-kind="llamacpp"]').click();
    document.getElementById('asProvSave').click();
  });
  await page.route('**/v1/models', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ object: 'list', data: [
      { id: 'text-only' },
      { id: 'audio-model', architecture: { output_modalities: ['audio', 'text'] } },
      { id: 'speech-in', capabilities: { audio: true } }
    ] })
  }));
  // The audio field's inline button opens the picker, listing only capable models.
  await page.evaluate(() => document.getElementById('asAudioOpen').click());
  await expect(page.locator('#asModelMenu')).toBeVisible();
  await expect(page.locator('#asModelList .as-model-row')).toHaveCount(1);
  await expect(page.locator('#asModelList .as-model-row')).toHaveAttribute('data-id', 'audio-model');
  await page.evaluate(() => document.querySelector('#asModelList .as-model-row').click());
  await expect(page.locator('#asModelMenu')).toBeHidden();
  await expect.poll(async () => page.evaluate(() => document.getElementById('asAudioModel').value)).toBe('audio-model');
  // Adopting the provider cleared the chat model with it: the local preset names no chat model.
  await expect.poll(async () => page.evaluate(() => document.getElementById('asModel').value)).toBe('');
});

test('en lokal leverandør med bind-adressen 0.0.0.0 normaliseres til loopback', async ({ page }) => {
  // A local server is often configured with the address it printed when it bound — 0.0.0.0 — which
  // a browser cannot connect to. It is accepted and rewritten to 127.0.0.1, so the model list loads.
  // The provider setup is shared, so the config is seeded the way the popup's editor would store it.
  await page.addInitScript(() => { try { localStorage.setItem('okfy.assistant', JSON.stringify({
    provider: 'llamacpp', model: '',
    providers: { llamacpp: { base: 'http://0.0.0.0:8004/v1', auth: 'none', apiVersion: '2024-10-21', oauth: {} } },
    audio: { model: '' }
  })); } catch (e) {} });
  await loadBundle(page);
  await expect(page.locator('#assistant')).toBeVisible();
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  let requested = '';
  await page.route('**/models', route => {
    requested = route.request().url();
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ object: 'list', data: [{ id: 'audio-model', architecture: { output_modalities: ['audio'] } }] })
    });
  });
  await page.evaluate(() => document.getElementById('asAudioOpen').click());
  await expect(page.locator('#asModelList .as-model-row')).toHaveCount(1);
  await expect(page.locator('#asModelList .as-model-row')).toHaveAttribute('data-id', 'audio-model');
  // The bind-all address reached the provider as loopback; its inline setup keeps what was stored.
  expect(requested).toContain('127.0.0.1:8004');
  await expect(page.locator('#asProvConfigured [data-provider="llamacpp"]')).toHaveCount(1);
  await page.evaluate(() => document.querySelector('#asProvConfigured [data-provider="llamacpp"] [data-act="configure"]').click());
  // The setup opens inline in the listing, with no provider kind list.
  await expect(page.locator('#asProvConfigured #asProvPanel')).toBeVisible();
  await expect(page.locator('#asProvList')).toBeHidden();
  await expect(page.locator('#asBase')).toHaveValue('http://0.0.0.0:8004/v1');
});

test('velger en stemme fra stemmene leverandøren oppgir', async ({ page }) => {
  // The audio provider's shared setup carries the key the voices endpoint needs; it is seeded the
  // way the popup's provider editor would store it.
  await page.addInitScript(() => { try { localStorage.setItem('okfy.assistant', JSON.stringify({
    provider: 'mistral', model: '',
    providers: { mistral: { base: 'https://api.mistral.ai/v1', auth: 'bearer', key: 'k', apiVersion: '2024-10-21', oauth: {} } },
    audio: { model: '' }
  })); } catch (e) {} });
  await loadBundle(page);
  await expect(page.locator('#assistant')).toBeVisible();
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.route('**/audio/voices**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ items: [
      { id: 'voice-en', name: 'Paul - Neutral', languages: ['en_us'], gender: 'male' },
      { id: 'voice-fr', name: 'Béatrice', languages: ['fr_fr'], gender: 'female' }
    ], total: 2, page_size: 100, total_pages: 1 })
  }));
  // The Voice field's inline button opens the picker, listing the provider's voices with the
  // languages each speaks (a region-qualified tag is named by its language).
  await page.evaluate(() => document.getElementById('asVoiceOpen').click());
  await expect(page.locator('#asModelList .as-model-row')).toHaveCount(2);
  // The voices are listed by display name, whatever order the provider returned them in.
  await expect(page.locator('#asModelList .as-model-row').first()).toContainText('Béatrice');
  await expect(page.locator('#asModelList .as-model-row').nth(1)).toContainText('Paul - Neutral');
  await expect(page.locator('#asModelList .as-model-row').nth(1)).toContainText('American English');
  // The search box narrows the voices.
  await page.evaluate(() => {
    const s = document.getElementById('asModelSearch');
    s.value = 'béa';
    s.dispatchEvent(new Event('input'));
  });
  await expect(page.locator('#asModelList .as-model-row')).toHaveCount(1);
  await page.evaluate(() => document.querySelector('#asModelList .as-model-row').click());
  await expect(page.locator('#asModelMenu')).toBeHidden();
  // The field shows the voice's display name; the id is what is stored and sent.
  await expect.poll(async () => page.evaluate(() => document.getElementById('asAudioVoice').value)).toBe('Béatrice');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('okfy.assistant')).audio.voice)).toBe('voice-fr');
});

test('leverandører legges til én gang, settes opp i raden sin og kan fjernes', async ({ page }) => {
  await loadBundle(page);
  await expect(page.locator('#assistant')).toBeVisible();
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());

  // DeepSeek is configured by default. A row is inert — only its gearwheel acts.
  await expect(page.locator('#asProvConfigured [data-provider="deepseek"]')).toHaveCount(1);
  await expect(page.locator('#asProvConfigured [data-provider="deepseek"] .as-provrow-btn')).toHaveCount(1);

  // The add symbol opens the provider kind list inside its own dashed row, and goes with it.
  await page.evaluate(() => document.getElementById('asProvider').click());
  await expect(page.locator('#asProvConfigured .as-provaddrow.open #asProvPanel')).toBeVisible();
  await expect(page.locator('#asProvider')).toBeHidden();
  await expect(page.locator('#asProvList')).toBeVisible();
  await expect(page.locator('#asProvList [data-kind]')).toHaveCount(5);
  await expect(page.locator('#asProvList [data-kind="deepseek"]')).toBeDisabled();
  await expect(page.locator('#asProvList [data-kind="llamacpp"]')).toBeEnabled();
  // The picking step keeps no heading, no options and no buttons at all.
  await expect(page.locator('#asProvHead')).toBeHidden();
  await expect(page.locator('#asProvFields')).toBeHidden();
  await expect(page.locator('#asProvButtons')).toBeHidden();

  // Picking a provider replaces the kind list with its options, in the same row.
  await page.evaluate(() => document.querySelector('#asProvList [data-kind="llamacpp"]').click());
  await expect(page.locator('#asProvList')).toBeHidden();
  await expect(page.locator('#asProvHead')).toBeVisible();
  await expect(page.locator('#asProvFields')).toBeVisible();
  await expect(page.locator('#asProvButtons')).toBeVisible();
  await expect(page.locator('#asProvName')).toHaveText('llama.cpp (local)');
  await expect(page.locator('#asBase')).toHaveValue('http://localhost:9931/v1');
  await expect(page.locator('#asProvSave')).toHaveText('Add');
  await expect(page.locator('#asProvRemove')).toBeHidden();
  // It is not added until Add.
  await expect(page.locator('#asProvConfigured [data-provider="llamacpp"]')).toHaveCount(0);

  // Add commits the setup, names it, and closes the row.
  await page.evaluate(() => {
    document.getElementById('asProvDisplay').value = 'Local llama';
    document.getElementById('asProvSave').click();
  });
  await expect(page.locator('#asProvPanel')).toBeHidden();
  await expect(page.locator('#asProvider')).toBeVisible();
  await expect(page.locator('#asProvConfigured [data-provider="llamacpp"] .as-provrow-name')).toHaveText('Local llama');
  await expect(page.locator('#asProvConfigured [data-provider="llamacpp"] .as-provrow-detail')).toContainText('localhost:9931');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('okfy.assistant')).modelProvider)).toBe('llamacpp');

  // Adding it again is refused — the kind listing greys it out — and a press outside closes it.
  await page.evaluate(() => document.getElementById('asProvider').click());
  await expect(page.locator('#asProvList [data-kind="llamacpp"]')).toBeDisabled();
  await page.locator('#assistant .as-head span').first().click();
  await expect(page.locator('#asProvPanel')).toBeHidden();
  await expect(page.locator('#asProvider')).toBeVisible();

  // Cancel closes the options step too, leaving nothing added.
  await page.evaluate(() => {
    document.getElementById('asProvider').click();
    document.querySelector('#asProvList [data-kind="azure"]').click();
  });
  await expect(page.locator('#asProvButtons')).toBeVisible();
  await page.evaluate(() => document.getElementById('asProvCancel').click());
  await expect(page.locator('#asProvPanel')).toBeHidden();
  await expect(page.locator('#asProvConfigured [data-provider="azure"]')).toHaveCount(0);

  // The gearwheel opens a configured provider's options inside its own row, without the kind list,
  // and a press outside leaves it alone.
  await page.evaluate(() => document.querySelector('#asProvConfigured [data-provider="llamacpp"] [data-act="configure"]').click());
  await expect(page.locator('#asProvConfigured [data-provider="llamacpp"].open #asProvPanel')).toBeVisible();
  await expect(page.locator('#asProvList')).toBeHidden();
  await expect(page.locator('#asProvDisplay')).toHaveValue('Local llama');
  await expect(page.locator('#asProvSave')).toHaveText('Update');
  await expect(page.locator('#asProvRemove')).toBeVisible();
  await page.locator('#assistant .as-head span').first().click();
  await expect(page.locator('#asProvPanel')).toBeVisible();

  // Editing the base URL updates the listing's details, and Update closes it.
  await page.evaluate(() => {
    const b = document.getElementById('asBase');
    b.value = 'http://localhost:8004/v1';
    b.dispatchEvent(new Event('change'));
  });
  await expect(page.locator('#asProvConfigured [data-provider="llamacpp"] .as-provrow-detail')).toContainText('localhost:8004');
  await page.evaluate(() => document.getElementById('asProvSave').click());
  await expect(page.locator('#asProvPanel')).toBeHidden();
  // The gearwheel toggles the options closed for the provider it is already showing.
  await page.evaluate(() => document.querySelector('#asProvConfigured [data-provider="llamacpp"] [data-act="configure"]').click());
  await expect(page.locator('#asProvPanel')).toBeVisible();
  await page.evaluate(() => document.querySelector('#asProvConfigured [data-provider="llamacpp"] [data-act="configure"]').click());
  await expect(page.locator('#asProvPanel')).toBeHidden();

  // Remove deletes it, and the model roles that used it fall back.
  await page.evaluate(() => document.querySelector('#asProvConfigured [data-provider="llamacpp"] [data-act="configure"]').click());
  await page.evaluate(() => document.getElementById('asProvRemove').click());
  await expect(page.locator('#asProvConfigured [data-provider="llamacpp"]')).toHaveCount(0);
  await expect(page.locator('#asProvPanel')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('okfy.assistant')).modelProvider)).toBe('');
  expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('okfy.assistant')).providers))).toEqual(['deepseek']);
  // And it can be added again afterwards.
  await page.evaluate(() => document.getElementById('asProvider').click());
  await expect(page.locator('#asProvList [data-kind="llamacpp"]')).toBeEnabled();
});

test('assistenten snakker svaret og kan avbrytes', async ({ page }) => {
  // A stand-in Web Audio API: decoding succeeds and playback never ends, so the speaking
  // indicator stays up until it is interrupted.
  await page.addInitScript(() => {
    window.__speechStarts = 0;
    window.__speechStops = 0;
    window.AudioContext = class {
      constructor() { this.state = 'running'; this.destination = {}; }
      resume() { this.state = 'running'; return Promise.resolve(); }
      decodeAudioData(buf, ok) { const decoded = { duration: 1 }; if (ok) ok(decoded); return Promise.resolve(decoded); }
      createBufferSource() { return { buffer: null, onended: null, connect() {}, start() { window.__speechStarts++; }, stop() { window.__speechStops++; } }; }
    };
  });
  await loadBundle(page);
  await expect(page.locator('#assistant')).toBeVisible();
  // Point both providers at the keyless local one; give the audio setup a model.
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    document.getElementById('asProvider').click();
    document.querySelector('#asProvList [data-kind="llamacpp"]').click();
    document.getElementById('asProvSave').click();
    const m = document.getElementById('asAudioModel');
    m.value = 'tts';
    m.dispatchEvent(new Event('change'));
    const v = document.getElementById('asAudioVoice');
    v.value = 'voice-1';
    v.dispatchEvent(new Event('change'));
    const s = document.getElementById('asStream');
    s.checked = false;
    s.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  // The speaker toggle in the header turns audio output on.
  await page.evaluate(() => document.getElementById('asSpeakToggle').click());
  await expect(page.locator('#asSpeakToggle')).toHaveAttribute('aria-pressed', 'true');
  let chats = 0;
  let speechBody = null;
  await page.route('**/v1/chat/completions', route => {
    chats++;
    const body = chats === 1
      ? { choices: [{ message: { role: 'assistant', content: '', tool_calls: [{ id: 's1', type: 'function', function: { name: 'speak', arguments: JSON.stringify({ text: 'Hello from the assistant.' }) } }] } }] }
      : { choices: [{ message: { role: 'assistant', content: 'Done.' } }] };
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('**/audio/speech', route => {
    speechBody = route.request().postDataJSON();
    route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.from([0, 1, 2, 3]) });
  });
  await page.evaluate(() => {
    document.getElementById('asInput').value = 'Say hello';
    document.getElementById('asSend').click();
  });
  // While the clip plays, the input prompt shows the inline speaker, and playback through
  // the Web Audio API actually started (the CSP has no media-src, so a media element
  // cannot play — the bytes are decoded and played instead).
  await expect.poll(async () => page.evaluate(() => !document.getElementById('asSpeaking').hidden), { timeout: 5000 }).toBe(true);
  await expect.poll(async () => page.evaluate(() => window.__speechStarts)).toBeGreaterThan(0);
  // The spoken commentary is its own bubble, separate from the written answer, that carries
  // the live mel-spectrogram canvas and the text it is saying.
  await expect.poll(async () => page.evaluate(() => {
    const msg = document.querySelector('#asLog .as-msg.commentary.speaking');
    return !!(msg && msg.querySelector('canvas.as-wave'));
  })).toBe(true);
  // The commentary is its own bubble, and the raw `speak` call is not repeated as a tool line.
  await expect(page.locator('#asLog .as-msg.commentary')).toHaveCount(1);
  await expect(page.locator('#asLog .as-msg.commentary')).toContainText('Hello from the assistant.');
  await expect(page.locator('#asLog .as-msg.assistant .as-tool')).toHaveCount(0);
  // The written answer lands in its own bubble below the commentary.
  await expect(page.locator('#asLog .as-msg.assistant')).toContainText('Done.');
  // While it plays, the active bubble sticks to the top or bottom edge of the transcript.
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('#asLog .as-msg.commentary.speaking')).position)).toBe('sticky');
  // Mistral's Voxtral TTS needs a voice id; the configured voice is sent as voice_id.
  expect(speechBody.voice_id).toBe('voice-1');
  expect(speechBody.input).toBe('Hello from the assistant.');
  // While it plays the bubble offers a stop symbol in place of the replay symbol.
  await expect(page.locator('#asLog .as-msg.commentary .as-stop')).toBeVisible();
  await expect(page.locator('#asLog .as-msg.commentary .as-replay')).toBeHidden();
  // Clicking the stop symbol interrupts playback and hides the indicator.
  await page.evaluate(() => document.querySelector('#asLog .as-msg.commentary .as-stop').click());
  await expect.poll(async () => page.evaluate(() => document.getElementById('asSpeaking').hidden)).toBe(true);
  expect(await page.evaluate(() => window.__speechStops)).toBeGreaterThan(0);
  // The marker clears on interrupt, the stop symbol gives way to the replay symbol, and the
  // rendered spectrogram stays.
  await expect.poll(async () => page.evaluate(() => document.querySelectorAll('#asLog .as-msg.speaking').length)).toBe(0);
  await expect(page.locator('#asLog .as-msg.commentary .as-stop')).toBeHidden();
  await expect(page.locator('#asLog .as-msg.commentary .as-replay')).toBeVisible();
  await expect(page.locator('#asLog canvas.as-wave')).toHaveCount(1);
  // Replaying the bubble plays the kept audio again.
  const startsBefore = await page.evaluate(() => window.__speechStarts);
  await page.evaluate(() => document.querySelector('#asLog .as-msg.commentary .as-replay').click());
  await expect.poll(async () => page.evaluate(() => window.__speechStarts)).toBeGreaterThan(startsBefore);
});

test('avbrytelse mens klippet dekodes spiller ikke av lyden', async ({ page }) => {
  // A Web Audio API whose decode resolves on a timer, so the interruption lands in the window
  // between the request and the start of playback: the clip must not start when it resolves.
  await page.addInitScript(() => {
    window.__speechStarts = 0;
    window.__decodeDone = 0;
    window.AudioContext = class {
      constructor() { this.state = 'running'; this.destination = {}; }
      resume() { this.state = 'running'; return Promise.resolve(); }
      decodeAudioData(buf, ok) {
        const decoded = { duration: 1 };
        setTimeout(() => { window.__decodeDone++; if (ok) ok(decoded); }, 1000);
        return Promise.resolve(decoded);
      }
      createBufferSource() { return { buffer: null, onended: null, connect() {}, start() { window.__speechStarts++; }, stop() {} }; }
    };
  });
  await loadBundle(page);
  await expect(page.locator('#assistant')).toBeVisible();
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    document.getElementById('asProvider').click();
    document.querySelector('#asProvList [data-kind="llamacpp"]').click();
    document.getElementById('asProvSave').click();
    const m = document.getElementById('asAudioModel');
    m.value = 'tts';
    m.dispatchEvent(new Event('change'));
    const s = document.getElementById('asStream');
    s.checked = false;
    s.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => document.getElementById('asSpeakToggle').click());
  await expect(page.locator('#asSpeakToggle')).toHaveAttribute('aria-pressed', 'true');
  let chats = 0;
  await page.route('**/v1/chat/completions', route => {
    chats++;
    const body = chats === 1
      ? { choices: [{ message: { role: 'assistant', content: '', tool_calls: [{ id: 's1', type: 'function', function: { name: 'speak', arguments: JSON.stringify({ text: 'A long spoken clip.' }) } }] } }] }
      : { choices: [{ message: { role: 'assistant', content: 'Done.' } }] };
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('**/audio/speech', route => route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.from([0, 1, 2, 3]) }));
  await page.evaluate(() => {
    document.getElementById('asInput').value = 'Say something long';
    document.getElementById('asSend').click();
  });
  // The clip is being decoded; playback has not started yet, but the inline speaker is up.
  await expect.poll(async () => page.evaluate(() => !document.getElementById('asSpeaking').hidden), { timeout: 5000 }).toBe(true);
  expect(await page.evaluate(() => window.__speechStarts)).toBe(0);
  // Interrupt now: the decode still resolves, but the clip must not start playing.
  await page.evaluate(() => document.getElementById('asSpeaking').click());
  await page.clock.runFor(1500);
  expect(await page.evaluate(() => window.__decodeDone)).toBeGreaterThan(0);   // the decode did resolve
  expect(await page.evaluate(() => window.__speechStarts)).toBe(0);            // but it was not played
  await expect(page.locator('#asSpeaking')).toBeHidden();
});

test('assistenten anbefaler grensesnittspråket når modellen ikke lister det', async ({ page }) => {
  // The interface language is Norwegian, but the audio output model's voices speak English and
  // French only. That coverage is a recommendation, not a requirement: the assistant is still
  // told to speak Norwegian, with English offered as a fallback, and a voice is still used.
  await page.addInitScript(() => { try { localStorage.setItem('okfy.lang', 'nb'); } catch (e) {} });
  // This test drives Settings directly (a custom goto), so seed the acknowledgement it is gated behind.
  await page.addInitScript(() => { try { localStorage.setItem('okfy.assistant.ack', '1'); } catch (e) {} });
  await page.addInitScript(() => {
    window.AudioContext = class {
      constructor() { this.state = 'running'; this.destination = {}; }
      resume() { return Promise.resolve(); }
      decodeAudioData(buf, ok) { const d = { duration: 1 }; if (ok) ok(d); return Promise.resolve(d); }
      createBufferSource() { return { buffer: null, onended: null, connect() {}, start() {}, stop() {} }; }
    };
  });
  await page.goto(`${explorer}?depth=all`);
  await expect(page.locator('#overlay')).not.toHaveClass(/\bshow\b/);
  await expect(page.locator('#spinner')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#aboutPop')).toBeHidden();
  await expect(page.locator('#assistant')).toBeVisible();
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    document.getElementById('asProvider').click();
    document.querySelector('#asProvList [data-kind="llamacpp"]').click();
    document.getElementById('asProvSave').click();
    const m = document.getElementById('asAudioModel');
    m.value = 'tts';
    m.dispatchEvent(new Event('change'));
    const s = document.getElementById('asStream');
    s.checked = false;
    s.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => document.getElementById('asSpeakToggle').click());
  await page.route('**/audio/voices**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ items: [
      { id: 'en-voice', type: 'preset', languages: ['en'] },
      { id: 'fr-voice', type: 'preset', languages: ['fr', 'en'] }
    ], total: 2, page_size: 100, total_pages: 1 })
  }));
  let chat = null, speech = null, chats = 0;
  await page.route('**/v1/chat/completions', route => {
    chats++;
    chat = route.request().postDataJSON();
    const body = chats === 1
      ? { choices: [{ message: { role: 'assistant', content: '', tool_calls: [{ id: 's1', type: 'function', function: { name: 'speak', arguments: JSON.stringify({ text: 'Hello.' }) } }] } }] }
      : { choices: [{ message: { role: 'assistant', content: 'Done.' } }] };
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('**/audio/speech', route => {
    speech = route.request().postDataJSON();
    route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.from([0, 1, 2, 3]) });
  });
  await page.evaluate(() => {
    document.getElementById('asInput').value = 'Say hi';
    document.getElementById('asSend').click();
  });
  await expect.poll(async () => speech).not.toBeNull();
  const systems = (chat.messages || []).filter(m => m.role === 'system').map(m => String(m.content));
  // The generated instructions name the interface language as the preferred output language for
  // the written reply and the spoken commentary.
  expect(systems.some(c => /## Output language/.test(c) && /Norwegian Bokm/.test(c) && /the interface language/.test(c))).toBe(true);
  // The per-turn speech note names the interface language and recommends it, offering English as
  // a fallback; no voice lists Norwegian, so the provider's first voice is used.
  const note = systems.find(c => /Speak the text for the `speak` tool/.test(c));
  expect(note).toBeTruthy();
  expect(note).toMatch(/English is an acceptable fallback/);
  expect(speech.voice_id).toBe('en-voice');
});

test('sender tenkningen tilbake med det påtvungne speak-kallet', async ({ page }) => {
  // Audio output on: when the model answers without calling `speak`, the viewer forces a
  // `speak` call and keeps it in the transcript. A thinking-mode provider requires that call's
  // reasoning to ride back on the next request, or it rejects it.
  await page.addInitScript(() => {
    window.AudioContext = class {
      constructor() { this.state = 'running'; this.destination = {}; }
      resume() { return Promise.resolve(); }
      decodeAudioData(buf, ok) { const d = { duration: 1 }; if (ok) ok(d); return Promise.resolve(d); }
      createBufferSource() { return { buffer: null, onended: null, connect() {}, start() {}, stop() {} }; }
    };
  });
  await loadBundle(page);
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    document.getElementById('asProvider').click();
    document.querySelector('#asProvList [data-kind="llamacpp"]').click();
    document.getElementById('asProvSave').click();
    const m = document.getElementById('asAudioModel'); m.value = 'tts'; m.dispatchEvent(new Event('change'));
    const v = document.getElementById('asAudioVoice'); v.value = 'v1'; v.dispatchEvent(new Event('change'));
    const s = document.getElementById('asStream'); s.checked = false; s.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => document.getElementById('asSpeakToggle').click());
  await page.route('**/audio/voices**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ id: 'v1', languages: ['en'] }], total: 1, page_size: 100, total_pages: 1 }) }));
  await page.route('**/audio/speech', route => route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.from([0, 1, 2, 3]) }));
  const bodies = [];
  await page.route('**/v1/chat/completions', route => {
    const body = route.request().postDataJSON();
    bodies.push(body);
    const forced = !!(body.tool_choice && body.tool_choice.type === 'function' && body.tool_choice.function && body.tool_choice.function.name === 'speak');
    const reply = forced
      ? { choices: [{ message: { role: 'assistant', content: '', reasoning_content: 'commentary thoughts', tool_calls: [{ id: 's1', type: 'function', function: { name: 'speak', arguments: JSON.stringify({ text: 'It is thorough.' }) } }] } }] }
      : { choices: [{ message: { role: 'assistant', content: 'It is thorough.', reasoning_content: 'answer thoughts' } }] };
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) });
  });

  // First question: the answer carries thinking-mode reasoning and no `speak`, so the viewer
  // forces a commentary call; wait for that turn to end before asking again.
  await page.evaluate(() => { document.getElementById('asInput').value = 'What is this?'; document.getElementById('asSend').click(); });
  await expect.poll(async () => bodies.length).toBe(2);   // question + forced commentary
  await expect(page.locator('#asStop')).toBeHidden();

  // Second question: the history carries the forced call's reasoning back with it.
  await page.evaluate(() => { document.getElementById('asInput').value = 'And again?'; document.getElementById('asSend').click(); });
  await expect.poll(async () => bodies.length).toBe(3);
  const speakMsg = (bodies[2].messages || []).filter(m => m.role === 'assistant' && m.tool_calls && m.tool_calls.length).pop();
  expect(speakMsg).toBeTruthy();
  expect(speakMsg.reasoning_content).toBe('commentary thoughts');
});

test('et påtvunget speak-kall uten tenkning beholder reasoning_content-feltet', async ({ page }) => {
  // Some thinking-mode providers answer the forced `speak` call with no reasoning_content. The
  // field must still ride back on the next request, or the provider rejects it (HTTP 400).
  await page.addInitScript(() => {
    window.AudioContext = class {
      constructor() { this.state = 'running'; this.destination = {}; }
      resume() { return Promise.resolve(); }
      decodeAudioData(buf, ok) { const d = { duration: 1 }; if (ok) ok(d); return Promise.resolve(d); }
      createBufferSource() { return { buffer: null, onended: null, connect() {}, start() {}, stop() {} }; }
    };
  });
  await loadBundle(page);
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    document.getElementById('asProvider').click();
    document.querySelector('#asProvList [data-kind="llamacpp"]').click();
    document.getElementById('asProvSave').click();
    const m = document.getElementById('asAudioModel'); m.value = 'tts'; m.dispatchEvent(new Event('change'));
    const v = document.getElementById('asAudioVoice'); v.value = 'v1'; v.dispatchEvent(new Event('change'));
    const s = document.getElementById('asStream'); s.checked = false; s.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => document.getElementById('asSpeakToggle').click());
  await page.route('**/audio/voices**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ id: 'v1', languages: ['en'] }], total: 1, page_size: 100, total_pages: 1 }) }));
  await page.route('**/audio/speech', route => route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.from([0, 1, 2, 3]) }));
  const bodies = [];
  await page.route('**/v1/chat/completions', route => {
    const body = route.request().postDataJSON();
    bodies.push(body);
    const forced = !!(body.tool_choice && body.tool_choice.type === 'function');
    // The forced call is answered with no reasoning_content at all.
    const reply = forced
      ? { choices: [{ message: { role: 'assistant', content: '', tool_calls: [{ id: 's1', type: 'function', function: { name: 'speak', arguments: JSON.stringify({ text: 'It is thorough.' }) } }] } }] }
      : { choices: [{ message: { role: 'assistant', content: 'It is thorough.' } }] };
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) });
  });

  await page.evaluate(() => { document.getElementById('asInput').value = 'What is this?'; document.getElementById('asSend').click(); });
  await expect.poll(async () => bodies.length).toBe(2);
  await page.evaluate(() => { document.getElementById('asInput').value = 'And again?'; document.getElementById('asSend').click(); });
  await expect.poll(async () => bodies.length).toBe(3);
  const call = (bodies[2].messages || []).filter(m => m.role === 'assistant' && m.tool_calls && m.tool_calls.length).pop();
  expect(call).toBeTruthy();
  expect(Object.prototype.hasOwnProperty.call(call, 'reasoning_content')).toBe(true);
  expect(call.reasoning_content).toBe('');
});

test('assistenten styrer filterpanelet og oversikten', async ({ page }) => {
  await loadBundle(page);
  await expect(page.locator('#assistant')).toBeVisible();
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    document.getElementById('asProvider').click();
    document.querySelector('#asProvList [data-kind="llamacpp"]').click();
    document.getElementById('asProvSave').click();
    const s = document.getElementById('asStream'); s.checked = false; s.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());

  let turn = 0;
  await page.route('**/v1/chat/completions', route => {
    turn++;
    const message = turn === 1
      ? { role: 'assistant', content: '', tool_calls: [
          { id: 'c1', type: 'function', function: { name: 'viewer_filters', arguments: JSON.stringify({ action: 'set', search: { query: 'guide' }, ops: [{ facet: 'kinds', include: ['Concept'] }] }) } },
          { id: 'c2', type: 'function', function: { name: 'viewer_legends', arguments: JSON.stringify({ action: 'set', select: ['Guide'] }) } }
        ] }
      : { role: 'assistant', content: 'Filtered.' };
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message }] }) });
  });

  await page.evaluate(() => { document.getElementById('asInput').value = 'Filter to the guide'; document.getElementById('asSend').click(); });
  await expect.poll(async () => page.inputValue('#search')).toBe('guide');   // the search field follows the tool
  // The legend selection dims the other groups; only the chosen group stays selected.
  await expect(page.locator('#legendBody .lg.sel')).toHaveCount(1);
  await expect(page.locator('#legendBody .lg.sel')).toContainText('Guide');
});

test('search_concepts søker med filterpanelets parametere uten å endre panelet', async ({ page }) => {
  await loadBundle(page);
  await expect(page.locator('#assistant')).toBeVisible();
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    document.getElementById('asProvider').click();
    document.querySelector('#asProvList [data-kind="llamacpp"]').click();
    document.getElementById('asProvSave').click();
    const s = document.getElementById('asStream'); s.checked = false; s.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());

  const bodies = [];
  let turn = 0;
  await page.route('**/v1/chat/completions', route => {
    bodies.push(route.request().postDataJSON());
    turn++;
    const message = turn === 1
      ? { role: 'assistant', content: '', tool_calls: [
          { id: 's1', type: 'function', function: { name: 'search_concepts', arguments: JSON.stringify({ query: 'referansekonsept', field: 'description', types: { include: ['Reference'] } }) } },
          { id: 's2', type: 'function', function: { name: 'search_concepts', arguments: JSON.stringify({ tags: { include: ['testing/reference'] } }) } }
        ] }
      : { role: 'assistant', content: 'Funnet.' };
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message }] }) });
  });

  await page.evaluate(() => { document.getElementById('asInput').value = 'Hva sier referansen?'; document.getElementById('asSend').click(); });
  // The tool results carry the concepts the panel's parameters select - a field-scoped query with a
  // type facet, then a tag facet alone - and neither call touches the panel or the view.
  const searchResults = () => (bodies[1] ? bodies[1].messages.filter(m => m.role === 'tool' && m.name === 'search_concepts') : []);
  await expect.poll(async () => searchResults().length).toBe(2);
  expect(JSON.parse(searchResults()[0].content).results.map(r => r.path)).toEqual(['nested/reference.md']);
  const byTag = JSON.parse(searchResults()[1].content);
  expect(byTag.results.map(r => r.path)).toEqual(['nested/reference.md']);
  expect(byTag.filter.tags).toEqual({ include: ['testing/reference'], exclude: [] });
  await expect(page.locator('#search')).toHaveValue('');
});

test('assistenten markerer, leser og lukker forhåndsvisningen', async ({ page }) => {
  await loadBundle(page);
  await expect(page.locator('#assistant')).toBeVisible();
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    document.getElementById('asProvider').click();
    document.querySelector('#asProvList [data-kind="llamacpp"]').click();
    document.getElementById('asProvSave').click();
    const s = document.getElementById('asStream'); s.checked = false; s.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());

  let turn = 0, releaseRead;
  const readGate = new Promise(resolve => { releaseRead = resolve; });
  await page.route('**/v1/chat/completions', async route => {
    turn++;
    if (turn === 3) await readGate;   // wait until the test has made a selection on the page
    let message;
    if (turn === 1) {
      message = { role: 'assistant', content: '', tool_calls: [
        { id: 'c1', type: 'function', function: { name: 'open_concept', arguments: JSON.stringify({ path: 'guide.md' }) } },
        { id: 'c2', type: 'function', function: { name: 'viewer_highlight', arguments: JSON.stringify({ texts: ['Referanse'], headings: ['Veiledning'], scroll: false }) } },
        { id: 'c3', type: 'function', function: { name: 'viewer_scroll', arguments: JSON.stringify({ heading: 'Veiledning' }) } }
      ] };
    } else if (turn === 3) {
      message = { role: 'assistant', content: '', tool_calls: [{ id: 'c4', type: 'function', function: { name: 'viewer_selection', arguments: '{}' } }] };
    } else if (turn === 5) {
      message = { role: 'assistant', content: '', tool_calls: [{ id: 'c5', type: 'function', function: { name: 'viewer_preview', arguments: JSON.stringify({ action: 'close' }) } }] };
    } else {
      message = { role: 'assistant', content: 'Done.' };
    }
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message }] }) });
  });

  // Ask 1: the tools open the page, then highlight the text and the heading.
  await page.evaluate(() => { document.getElementById('asInput').value = 'Open the guide'; document.getElementById('asSend').click(); });
  await expect(page.locator('#preview')).toHaveClass(/\bshow\b/);
  await expect(page.locator('#pvPath')).toHaveText('guide.md');
  await expect(page.locator('#pvBody mark.pv-hl')).toHaveCount(1);   // the link text “Referanse”
  await expect(page.locator('#pvBody .pv-hl-head')).toHaveCount(1);  // the “Veiledning” heading
  // Each highlight carries a ● badge at its top-right, tinted with the page's node colour.
  const badge = await page.evaluate(() => {
    const body = document.getElementById('pvBody');
    const after = getComputedStyle(body.querySelector('mark.pv-hl'), '::after');
    return { content: after.content, color: after.color, tint: getComputedStyle(body).getPropertyValue('--pv-hl-color').trim() };
  });
  expect(badge.content).toContain('●');
  expect(badge.tint).toBe('#3fb98a');   // the Guide type colour, the open page's kind colour
  expect(badge.color).toBe('rgb(63, 185, 138)');
  await expect.poll(async () => turn).toBe(2);
  await expect(page.locator('#asStop')).toBeHidden();

  // Ask 2: the assistant reads the user's selection from the page.
  await page.evaluate(() => { document.getElementById('asInput').value = 'Read my selection'; document.getElementById('asSend').click(); });
  await expect.poll(async () => turn).toBe(3);
  await page.evaluate(() => {
    const p = document.getElementById('pvBody').querySelector('p');
    const range = document.createRange();
    range.selectNodeContents(p);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  releaseRead();
  await expect(page.locator('#asLog .as-msg.tool .as-tool').last()).toContainText('"inPreview":true');
  await expect.poll(async () => turn).toBe(4);
  await expect(page.locator('#asStop')).toBeHidden();

  // Ask 3: the assistant closes the page.
  await page.evaluate(() => { document.getElementById('asInput').value = 'Close it'; document.getElementById('asSend').click(); });
  await expect(page.locator('#preview')).not.toHaveClass(/\bshow\b/);
});

test('assistenten navigerer forhåndsvisningens historikk', async ({ page }) => {
  await loadBundle(page);
  await expect(page.locator('#assistant')).toBeVisible();
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    document.getElementById('asProvider').click();
    document.querySelector('#asProvList [data-kind="llamacpp"]').click();
    document.getElementById('asProvSave').click();
    const s = document.getElementById('asStream'); s.checked = false; s.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());

  const tool = (id, name, args) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args || {}) } });
  let turn = 0;
  await page.route('**/v1/chat/completions', route => {
    turn++;
    let message;
    if (turn === 1) message = { role: 'assistant', content: '', tool_calls: [tool('c1', 'open_concept', { path: 'guide.md' }), tool('c2', 'open_concept', { path: 'nested/reference.md' })] };
    else if (turn === 3) message = { role: 'assistant', content: '', tool_calls: [tool('c3', 'viewer_preview', { action: 'back' })] };
    else if (turn === 5) message = { role: 'assistant', content: '', tool_calls: [tool('c4', 'viewer_preview', { action: 'history' })] };
    else if (turn === 7) message = { role: 'assistant', content: '', tool_calls: [tool('c5', 'viewer_preview', { action: 'forward' })] };
    else message = { role: 'assistant', content: 'Done.' };
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message }] }) });
  });
  const ask = async text => { await page.evaluate(t => { document.getElementById('asInput').value = t; document.getElementById('asSend').click(); }, text); };
  const idleAt = async n => { await expect.poll(async () => turn).toBe(n); await expect(page.locator('#asStop')).toBeHidden(); };

  // Ask 1: two pages are opened, so the history has two entries and shows the second.
  await ask('open two pages');
  await idleAt(2);
  await expect(page.locator('#pvPath')).toHaveText('nested/reference.md');

  // Ask 2: back to the first page.
  await ask('go back');
  await idleAt(4);
  await expect(page.locator('#pvPath')).toHaveText('guide.md');

  // Ask 3: list the history — it reports the current position and both pages.
  await ask('where am I');
  await idleAt(6);
  const listed = page.locator('#asLog .as-msg.tool .as-tool').last();
  await expect(listed).toContainText('"current":true');
  await expect(listed).toContainText('"path":"guide.md"');
  await expect(listed).toContainText('"path":"nested/reference.md"');

  // Ask 4: forward again to the second page.
  await ask('go forward');
  await idleAt(8);
  await expect(page.locator('#pvPath')).toHaveText('nested/reference.md');
});

test('tokenbruk-popupen viser bytes sendt og mottatt', async ({ page }) => {
  await loadBundle(page);
  await expect(page.locator('#assistant')).toBeVisible();
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    document.getElementById('asProvider').click();
    document.querySelector('#asProvList [data-kind="llamacpp"]').click();
    document.getElementById('asProvSave').click();
    const s = document.getElementById('asStream'); s.checked = false; s.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.route('**/v1/chat/completions', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'It is thorough.' } }], usage: { prompt_tokens: 1200, completion_tokens: 340 } })
  }));

  await page.evaluate(() => { document.getElementById('asInput').value = 'What is this?'; document.getElementById('asSend').click(); });
  await expect.poll(async () => page.locator('#asUsageTip').textContent()).toMatch(/Requests: 1/);
  const tip = await page.locator('#asUsageTip').textContent();
  // The popup reports the wire sizes in data-size units, for the session and the last request.
  expect(tip).toMatch(/Sent: [\d.]+ (B|KB|MB)/);
  expect(tip).toMatch(/Received: [\d.]+ (B|KB|MB)/);
  expect(tip).not.toMatch(/Sent: 0 B/);   // the request body was measured, not left at zero
  // The context-length ring filled by the prompt's share of the limit, and the popup names it.
  expect(tip).toMatch(/Context length: /);
  const circ = 2 * Math.PI * 9;
  const ringOffset = await page.evaluate(() => parseFloat(document.getElementById('asCtxArc').style.strokeDashoffset));
  expect(ringOffset).toBeLessThan(circ);
  expect(ringOffset).toBeGreaterThan(0);
});

test('komprimerer konteksten når den nærmer seg vindusgrensen', async ({ page }) => {
  await loadBundle(page);
  await expect(page.locator('#assistant')).toBeVisible();
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    document.getElementById('asProvider').click();
    document.querySelector('#asProvList [data-kind="llamacpp"]').click();
    document.getElementById('asProvSave').click();
    const s = document.getElementById('asStream'); s.checked = false; s.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());

  const bodies = [];
  await page.route('**/v1/chat/completions', route => {
    const body = route.request().postDataJSON();
    bodies.push(body);
    const summary = (body.messages || []).some(m => m.role === 'system' && /own memory/.test(m.content || ''));
    // The compactification request is the one with no tools; it answers with a marked summary.
    const content = summary ? 'SUMMARY-MARK: earlier the user asked several questions.' : 'ack';
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { role: 'assistant', content } }], usage: { prompt_tokens: 20000, completion_tokens: 5 } }) });
  });

  // Each reply reports a prompt well past the compactAt share of the 16k window; the seventh
  // question is the first with enough history to drop (compactKeep recent turns are kept).
  for (let i = 0; i < 7; i++) {
    await page.evaluate(n => { document.getElementById('asInput').value = 'question ' + n; document.getElementById('asSend').click(); }, i);
    await expect.poll(async () => page.evaluate(() => document.querySelectorAll('#asLog .as-msg.assistant').length)).toBe(i + 1);
  }
  // A summary request was made (no tools) and is followed by chat requests that carry the
  // compacted summary as a system message, with the earliest questions no longer replayed.
  const summaryAt = bodies.findIndex(b => !b.tools && (b.messages || []).some(m => m.role === 'system' && /own memory/.test(m.content || '')));
  expect(summaryAt).toBeGreaterThan(-1);
  const after = bodies.slice(summaryAt + 1);
  expect(after.some(b => b.tools && (b.messages || []).some(m => m.role === 'system' && /SUMMARY-MARK/.test(m.content || '')))).toBe(true);
  expect(after.some(b => b.tools && (b.messages || []).some(m => m.role === 'user' && m.content === 'question 0'))).toBe(false);
  // The transcript marks the compaction with a notice.
  await expect(page.locator('#asLog .as-msg.notice')).toHaveCount(1);
});

test('assistenten avslutter med et svar når verktøystegene er brukt opp', async ({ page }) => {
  await loadBundle(page);
  await expect(page.locator('#assistant')).toBeVisible();
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    document.getElementById('asProvider').click();
    document.querySelector('#asProvList [data-kind="llamacpp"]').click();
    document.getElementById('asProvSave').click();
    const s = document.getElementById('asStream');
    s.checked = false;
    s.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  // A model that only ever asks for tools: after the step cap (8) the viewer must not end on
  // an error but ask once more without tools, so the turn closes with an answer.
  const bodies = [];
  await page.route('**/v1/chat/completions', route => {
    bodies.push(route.request().postDataJSON());
    const body = bodies.length <= 8
      ? { choices: [{ message: { role: 'assistant', content: '', tool_calls: [{ id: 'c' + bodies.length, type: 'function', function: { name: 'search_concepts', arguments: '{"query":"docs"}' } }] } }] }
      : { choices: [{ message: { role: 'assistant', content: 'Here is what I found.' } }] };
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.evaluate(() => {
    document.getElementById('asInput').value = 'find documents';
    document.getElementById('asSend').click();
  });
  await expect(page.locator('#asLog .as-msg.assistant', { hasText: 'Here is what I found.' })).toHaveCount(1);
  // The closing request went out without the tools, and no error was shown.
  expect(bodies.length).toBe(9);
  expect(Array.isArray(bodies[7].tools)).toBe(true);
  expect(bodies[8].tools).toBeUndefined();
  await expect(page.locator('#asLog .as-msg.error')).toHaveCount(0);
});

test('assistenten sender tenkningen tilbake med verktøykallet', async ({ page }) => {
  await loadBundle(page);
  await expect(page.locator('#assistant')).toBeVisible();
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    document.getElementById('asProvider').click();
    document.querySelector('#asProvList [data-kind="llamacpp"]').click();
    document.getElementById('asProvSave').click();
    const s = document.getElementById('asStream');
    s.checked = false;
    s.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  // A thinking-mode reply: the reasoning must ride back with the tool call on the next request.
  const bodies = [];
  await page.route('**/v1/chat/completions', route => {
    bodies.push(route.request().postDataJSON());
    const body = bodies.length === 1
      ? { choices: [{ message: { role: 'assistant', content: '', reasoning_content: 'let me think', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'list_facets', arguments: '{}' } }] } }] }
      : { choices: [{ message: { role: 'assistant', content: 'Done.' } }] };
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.evaluate(() => {
    document.getElementById('asInput').value = 'list the facets';
    document.getElementById('asSend').click();
  });
  await expect(page.locator('#asLog .as-msg.assistant', { hasText: 'Done.' })).toHaveCount(1);
  const withReasoning = bodies[1].messages.filter(m => m.role === 'assistant' && m.reasoning_content);
  expect(withReasoning).toHaveLength(1);
  expect(withReasoning[0].reasoning_content).toBe('let me think');
  expect(Array.isArray(withReasoning[0].tool_calls)).toBe(true);
});

test('assistenten får kommentar selv når modellen glemmer å snakke', async ({ page }) => {
  // A stand-in Web Audio API so playback counts as started without a real device.
  await page.addInitScript(() => {
    window.__speechStarts = 0;
    window.AudioContext = class {
      constructor() { this.state = 'running'; this.destination = {}; }
      resume() { this.state = 'running'; return Promise.resolve(); }
      decodeAudioData(buf, ok) { const decoded = { duration: 1 }; if (ok) ok(decoded); return Promise.resolve(decoded); }
      createBufferSource() { return { buffer: null, onended: null, connect() {}, start() { window.__speechStarts++; }, stop() {} }; }
    };
  });
  await loadBundle(page);
  await expect(page.locator('#assistant')).toBeVisible();
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    document.getElementById('asProvider').click();
    document.querySelector('#asProvList [data-kind="llamacpp"]').click();
    document.getElementById('asProvSave').click();
    const m = document.getElementById('asAudioModel'); m.value = 'tts'; m.dispatchEvent(new Event('change'));
    const v = document.getElementById('asAudioVoice'); v.value = 'voice-1'; v.dispatchEvent(new Event('change'));
    const s = document.getElementById('asStream'); s.checked = false; s.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => document.getElementById('asSpeakToggle').click());

  let chats = 0, asks = 0;
  await page.route('**/v1/chat/completions', route => {
    const b = route.request().postDataJSON();
    const asking = !!(b.tool_choice && typeof b.tool_choice === 'object');   // the forced commentary pass
    let message;
    if (asking) {
      asks++;
      message = { role: 'assistant', content: '', tool_calls: [{ id: 's1', type: 'function', function: { name: 'speak', arguments: JSON.stringify({ text: 'Security looks solid, with a few gaps flagged.' }) } }] };
    } else {
      chats++;
      // The model answers the question and never calls `speak`.
      message = chats === 1
        ? { role: 'assistant', content: '', tool_calls: [{ id: 'g1', type: 'function', function: { name: 'graph_overview', arguments: '{}' } }] }
        : { role: 'assistant', content: 'The security review is thorough.' };
    }
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message }] }) });
  });
  await page.route('**/audio/speech', route => route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.from([0, 1, 2, 3]) }));

  await page.evaluate(() => {
    document.getElementById('asInput').value = 'What is the state of security in okfy?';
    document.getElementById('asSend').click();
  });

  // The model never spoke on its own, so the viewer asks once more with `speak` forced and
  // the reply is still spoken.
  await expect.poll(async () => page.evaluate(() => window.__speechStarts), { timeout: 5000 }).toBeGreaterThan(0);
  expect(asks).toBe(1);
  await expect(page.locator('#asLog .as-msg.commentary', { hasText: 'Security looks solid' })).toHaveCount(1);
  await expect(page.locator('#asLog .as-msg.assistant', { hasText: 'The security review is thorough.' })).toHaveCount(1);
});

test('assistenten er på som standard og filterpanelet dokker til venstre når det gjenåpnes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loadBundle(page);
  await expect(page.locator('#assistant')).toBeVisible();                 // assistant enabled by default
  await expect(page.locator('body')).toHaveClass(/\bas-open\b/);
  await expect(page.locator('body')).toHaveClass(/\bhide-side\b/);        // filters collapsed by default
  // Reopen the filters: they slide out docked to the left of the assistant.
  await page.evaluate(() => document.getElementById('sideHandle').click());
  await expect(page.locator('body')).not.toHaveClass(/\bhide-side\b/);
  // The panel slides (transition), so poll until it settles left of the assistant.
  await expect.poll(async () => page.evaluate(() => {
    const s = document.getElementById('sidebar').getBoundingClientRect();
    const a = document.getElementById('assistant').getBoundingClientRect();
    return Math.round(s.right) - Math.round(a.left);
  }), { timeout: 3000 }).toBeLessThanOrEqual(1);
  const sidebarWidth = await page.evaluate(() => Math.round(document.getElementById('sidebar').getBoundingClientRect().width));
  expect(sidebarWidth).toBeGreaterThan(0);
});

test('assistentpanelet kan endres i bredde', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loadBundle(page);
  await expect(page.locator('#assistant')).toBeVisible();
  const before = await page.evaluate(() => Math.round(document.getElementById('assistant').getBoundingClientRect().width));
  // Drag the left-edge handle leftward to widen the panel.
  const handle = await page.locator('#asResize').boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x - 120, handle.y + handle.height / 2, { steps: 5 });
  await page.mouse.up();
  const after = await page.evaluate(() => Math.round(document.getElementById('assistant').getBoundingClientRect().width));
  expect(after).toBeGreaterThan(before);
});

test('assistenten viser legend og kortstokk, og kortstokken dokker til venstre', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // The project bundle declares decks, so the deck column is shown.
  await page.goto(`${projectExplorer}?depth=all`);
  await expect(page.locator('#spinner')).toBeHidden();
  await page.keyboard.press('Escape');
  await page.clock.runFor(1500);
  await expect(page.locator('#assistant')).toBeVisible();
  // The deck stays shown and docks to the assistant's left.
  await expect.poll(async () => page.evaluate(() => getComputedStyle(document.getElementById('deck')).display), { timeout: 3000 }).toBe('flex');
  await expect.poll(async () => page.evaluate(() => {
    const a = document.getElementById('assistant').getBoundingClientRect();
    const d = document.getElementById('deck').getBoundingClientRect();
    return Math.round(d.right) - Math.round(a.left);
  }), { timeout: 3000 }).toBeLessThanOrEqual(1);
  const legendDisplay = await page.evaluate(() => getComputedStyle(document.getElementById('legend')).display);
  expect(legendDisplay).not.toBe('none');
});

test('assistenten: interne lenker åpner i viseren, eksterne i nettleseren', async ({ page }) => {
  await loadBundle(page);
  await expect(page.locator('#assistant')).toBeVisible();
  // An internal bundle link opens the concept in the viewer's preview modal.
  await page.evaluate(() => {
    const wrap = document.createElement('div');
    wrap.className = 'as-md';
    wrap.innerHTML = '<a href="#" data-link="guide.md">guide</a>';
    document.getElementById('asLog').appendChild(wrap);
  });
  await page.evaluate(() => document.querySelector('#asLog .as-md a').click());
  await expect(page.locator('#preview')).toHaveClass(/\bshow\b/);
  // A directory link enters that directory.
  await page.evaluate(() => {
    const wrap = document.createElement('div');
    wrap.className = 'as-md';
    wrap.innerHTML = '<a href="#" data-link="nested/">nested</a>';
    document.getElementById('asLog').appendChild(wrap);
    wrap.querySelector('a').click();
  });
  await expect(page.locator('#graphPath')).toHaveText('nested/');
  await page.keyboard.press('Escape');   // close the preview before the next check
  // A #tag link toggles the tag filter.
  await page.evaluate(() => {
    const wrap = document.createElement('div');
    wrap.className = 'as-md';
    wrap.innerHTML = '<a href="#" data-link="#testing">#testing</a>';
    document.getElementById('asLog').appendChild(wrap);
    wrap.querySelector('a').click();
  });
  await expect(page.locator('#filterSummary')).toHaveText('1 active');
  // An external link opens in a new browser tab instead of navigating the page.
  await page.evaluate(() => { window.__opened = []; window.open = url => { window.__opened.push(url); return null; }; });
  await page.evaluate(() => {
    const wrap = document.createElement('div');
    wrap.className = 'as-md';
    wrap.innerHTML = '<a href="https://example.com/" data-link="https://example.com/">ext</a>';
    document.getElementById('asLog').appendChild(wrap);
  });
  await page.evaluate(() => Array.from(document.querySelectorAll('#asLog .as-md a')).pop().click());
  expect(await page.evaluate(() => window.__opened)).toEqual(['https://example.com/']);
});

test('token-indikatoren ligger ved modellvelgeren med fyll-piler', async ({ page }) => {
  await loadBundle(page);
  await expect(page.locator('#assistant')).toBeVisible();
  const info = await page.evaluate(() => {
    const usage = document.getElementById('asUsage');
    const chip = document.getElementById('asModelBtn');
    const up = usage.querySelector('.as-ar.up');
    const down = usage.querySelector('.as-ar.down');
    return {
      inForm: !!usage.closest('.as-form'),
      afterModel: !!(chip.compareDocumentPosition(usage) & Node.DOCUMENT_POSITION_FOLLOWING),
      arrows: !!document.getElementById('asUseIn') && !!document.getElementById('asUseOut'),
      fills: !!document.getElementById('asUseInFill') && !!document.getElementById('asUseOutFill'),
      hidden: usage.hidden,
      upId: up && up.id,
      downId: down && down.id,
      upTitle: up && up.getAttribute('title'),
      downTitle: down && down.getAttribute('title')
    };
  });
  expect(info.inForm).toBe(true);        // moved down into the chat form
  expect(info.afterModel).toBe(true);    // and right of the model chip
  expect(info.arrows).toBe(true);
  expect(info.fills).toBe(true);
  expect(info.hidden).toBe(false);       // always shown, even with nothing consumed yet
  // The up-arrow carries output tokens, the down-arrow carries input tokens.
  expect(info.upId).toBe('asUseOut');
  expect(info.upTitle).toBe('Output tokens');
  expect(info.downId).toBe('asUseIn');
  expect(info.downTitle).toBe('Input tokens');
});

test('assistenten henter og søker i modellisten fra leverandøren', async ({ page }) => {
  await loadBundle(page);
  await expect(page.locator('#assistant')).toBeVisible();
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await expect(page.locator('body')).toHaveClass(/\bas-settings-open\b/);
  // Point at a keyless local provider so no real host is contacted, and stub its list.
  await page.evaluate(() => {
    document.getElementById('asProvider').click();
    document.querySelector('#asProvList [data-kind="llamacpp"]').click();
    document.getElementById('asProvSave').click();
  });
  await page.route('**/v1/models', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ object: 'list', data: [
      { id: 'llama-3.2-1b' },
      { id: 'qwen2.5-7b', pricing: { prompt: '0.00000015', completion: '0.0000006' } },
      { id: 'mistral-7b' }
    ] })
  }));
  // The inline button in the model field fetches and opens the list.
  await page.evaluate(() => document.getElementById('asModelOpen').click());
  await expect(page.locator('#asModelMenu')).toBeVisible();
  await expect(page.locator('#asModelList .as-model-row')).toHaveCount(4);
  await expect(page.locator('#asModel')).toHaveValue('llama-3.2-1b');
  // Models are grouped by provider: the configured default plus the one just added.
  await expect(page.locator('#asModelList .as-model-group')).toHaveCount(2);
  await expect(page.locator('#asModelList .as-model-group').first()).toHaveText('DeepSeek');
  await expect(page.locator('#asModelList .as-model-row[data-provider="llamacpp"]')).toHaveCount(3);
  // A price the endpoint reports is shown dimmed on the model's next line.
  const qwenRow = page.locator('#asModelList .as-model-row[data-id="qwen2.5-7b"]');
  await expect(qwenRow.locator('.as-model-cost')).toHaveText('$0.15 in · $0.6 out per 1M tokens');
  await expect(qwenRow.locator('.as-model-cost')).toHaveCSS('color', 'rgb(154, 162, 179)');
  await expect(page.locator('#asModelList .as-model-row[data-id="llama-3.2-1b"] .as-model-cost')).toHaveText('No cost information');
  // The inline search filters the list.
  await page.evaluate(() => {
    const s = document.getElementById('asModelSearch');
    s.value = 'qwen';
    s.dispatchEvent(new Event('input'));
  });
  await expect(page.locator('#asModelList .as-model-row')).toHaveCount(1);
  // Choosing a row sets the field and closes the picker.
  await page.evaluate(() => document.querySelector('#asModelList .as-model-row').click());
  await expect(page.locator('#asModel')).toHaveValue('qwen2.5-7b');
  await expect(page.locator('#asModelMenu')).toBeHidden();
  // The chip below the chat input shows the current model and reopens the picker.
  await expect(page.locator('#asModelBtnLabel')).toHaveText('qwen2.5-7b');
  await page.evaluate(() => document.getElementById('asModelBtn').click());
  await expect(page.locator('#asModelMenu')).toBeVisible();
  await expect(page.locator('#asModelList .as-model-row')).toHaveCount(4);
});

test('modellisten viser verktøystøtte og setter maks output-tokens fra modellen', async ({ page }) => {
  await loadBundle(page);
  await expect(page.locator('#assistant')).toBeVisible();
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await expect(page.locator('body')).toHaveClass(/\bas-settings-open\b/);
  // Point at a keyless local provider and stub its list with tool and context metadata.
  await page.evaluate(() => {
    document.getElementById('asProvider').click();
    document.querySelector('#asProvList [data-kind="llamacpp"]').click();
    document.getElementById('asProvSave').click();
  });
  await page.route('**/v1/models', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ object: 'list', data: [
      { id: 'tool-model', capabilities: { function_calling: true }, max_context_length: 32000 },
      { id: 'plain-model' }
    ] })
  }));
  await page.evaluate(() => document.getElementById('asModelOpen').click());
  await expect(page.locator('#asModelMenu')).toBeVisible();
  // Tool support and the reported maximum are shown on a dimmed line; a model that
  // reports neither shows no such line.
  await expect(page.locator('#asModelList .as-model-row[data-id="tool-model"] .as-model-meta')).toHaveText('tool calling · max 32k');
  await expect(page.locator('#asModelList .as-model-row[data-id="plain-model"] .as-model-meta')).toHaveCount(0);
  // Choosing the model sets Max output tokens to its maximum, so Default is not offered yet.
  await page.evaluate(() => document.querySelector('#asModelList .as-model-row[data-id="tool-model"]').click());
  await expect.poll(async () => page.evaluate(() => document.getElementById('asMaxTokens').value)).toBe('32000');
  await expect.poll(async () => page.evaluate(() => document.getElementById('asMaxTokens').max)).toBe('32000');
  await expect(page.locator('#asMaxTokensDefault')).toBeHidden();
  // A manual value within the bound is kept, and Default reverts it to the model maximum.
  await page.evaluate(() => {
    const t = document.getElementById('asMaxTokens');
    t.value = '1000';
    t.dispatchEvent(new Event('change'));
  });
  await expect.poll(async () => page.evaluate(() => !document.getElementById('asMaxTokensDefault').hidden)).toBe(true);
  await page.evaluate(() => document.getElementById('asMaxTokensDefault').click());
  await expect.poll(async () => page.evaluate(() => document.getElementById('asMaxTokens').value)).toBe('32000');
  await expect(page.locator('#asMaxTokensDefault')).toBeHidden();
});

test('laster testpakken med tre filer og tre lenker', async ({ page }) => {
  await loadBundle(page);
  await expect(page.locator('#stats')).toHaveText('3 files · 3 links');
  await expect(page.locator('#graphPath')).toHaveText('/');
  await expect(page.locator('#graphBack')).toBeDisabled();
  await expect(page.locator('#graphFwd')).toBeDisabled();
  await expect(page.locator('#legendBody')).toContainText('Guide');
  await expect(page.locator('#legendBody')).toContainText('Reference');
});

test('søker i valgt felt og demper noder som ikke passer', async ({ page }) => {
  await loadBundle(page);
  await setFilters(page, true);   // the filter panel starts collapsed
  await page.locator('#searchField').selectOption('title');
  await page.locator('#search').fill('Veiledning');
  let labels = await renderedLabels(page);
  expect(labels.Veiledning.alpha).toBeGreaterThan(0.9);
  expect(labels.Referanse.alpha).toBeLessThanOrEqual(0.2);
  await expect(page.locator('#filterSummary')).toHaveText('search');

  await page.locator('#searchField').selectOption('path');
  await page.locator('#search').fill('nested/');
  labels = await renderedLabels(page);
  expect(labels.Referanse.alpha).toBeGreaterThan(0.9);
  expect(labels.Veiledning.alpha).toBeLessThanOrEqual(0.2);

  await page.locator('#clearFilters').click();
  await expect(page.locator('#search')).toHaveValue('');
  await expect(page.locator('#searchField')).toHaveValue('');
  await expect(page.locator('#filterSummary')).toHaveText('');
});

test('typefilter veksler mellom inkludering, ekskludering og fjerning', async ({ page }) => {
  await loadBundle(page);
  await setFilters(page, true);   // the filter panel starts collapsed
  await page.locator('#typeOpen').click();
  const option = page.locator('#typeList [data-t="Guide"]');
  await option.click();
  await expect(page.locator('#typeChips .chip')).toHaveClass(/\binc\b/);
  await expect(page.locator('#stats')).toHaveText('1 files · 0 links');
  await option.click();
  await expect(page.locator('#typeChips .chip')).toHaveClass(/\bexc\b/);
  await expect(page.locator('#stats')).toHaveText('2 files · 0 links');
  await option.click();
  await expect(page.locator('#typeChips .chip')).toHaveCount(0);
  await expect(page.locator('#stats')).toHaveText('3 files · 3 links');
});

test('filtrerer på nodetype og status, og nullstiller filtrene', async ({ page }) => {
  await loadBundle(page);
  await setFilters(page, true);   // the filter panel starts collapsed
  await page.locator('#kindOpen').click();
  await page.locator('#kindList [data-t="Concept"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#stats')).toHaveText('2 files · 2 links');
  await page.locator('#statusOpen').click();
  await page.locator('#statusList [data-t="draft"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#stats')).toHaveText('1 files · 0 links');
  await expect(page.locator('#filterSummary')).toHaveText('2 active');
  await page.locator('#clearFilters').click();
  await expect(page.locator('#kindChips .chip')).toHaveCount(0);
  await expect(page.locator('#statusChips .chip')).toHaveCount(0);
  await expect(page.locator('#stats')).toHaveText('3 files · 3 links');
});

test('emneknagger kan inkluderes, ekskluderes og fjernes som brikker', async ({ page }) => {
  await loadBundle(page);
  await setFilters(page, true);   // the filter panel starts collapsed
  await page.locator('#tagOpen').click();
  await page.locator('#tagList [data-t="testing/ui"]').click();
  await page.keyboard.press('Escape');
  const chip = page.locator('#tagChips [data-t="testing/ui"]');
  await expect(chip).toHaveClass(/\binc\b/);
  let labels = await renderedLabels(page);
  expect(labels).toHaveProperty('Veiledning');
  expect(labels).not.toHaveProperty('Referanse');
  await chip.locator('.ct').click();
  await expect(chip).toHaveClass(/\bexc\b/);
  labels = await renderedLabels(page);
  expect(labels).not.toHaveProperty('Veiledning');
  expect(labels).toHaveProperty('Referanse');
  await chip.locator('.cx').click();
  await expect(chip).toHaveCount(0);
  await expect(page.locator('#filterSummary')).toHaveText('');
});

test('slår etiketter og emneknaggnoder av og på', async ({ page }) => {
  await loadBundle(page);
  await page.locator('#labels').click();
  await expect(page.locator('#labels')).toHaveAttribute('aria-pressed', 'false');
  expect(await renderedLabels(page)).toEqual({});
  await page.locator('#labels').click();
  await expect(page.locator('#labels')).toHaveAttribute('aria-pressed', 'true');
  expect(await renderedLabels(page)).toHaveProperty('Veiledning');
  await page.locator('#tags').click();
  await expect(page.locator('#tags')).toHaveAttribute('aria-pressed', 'true');
  expect(await renderedLabels(page)).toHaveProperty('#testing/ui');
  await page.locator('#tags').click();
  await expect(page.locator('#tags')).toHaveAttribute('aria-pressed', 'false');
  expect(await renderedLabels(page)).not.toHaveProperty('#testing/ui');
  await expect(page.locator('#stats')).toHaveText('3 files · 3 links');
});

test('forhåndsviser Markdown og navigerer tilbake og frem', async ({ page }) => {
  await loadBundle(page);
  await clickNode(page, 'Veiledning');
  await expect(page.locator('#preview')).toHaveClass(/\bshow\b/);
  await expect(page.locator('#pvTitle')).toHaveText('Veiledning');
  await expect(page.locator('#pvBack')).toBeDisabled();
  await page.locator('#pvBody').getByRole('link', { name: 'Referanse', exact: true }).click();
  await expect(page.locator('#pvTitle')).toHaveText('Referanse');
  await expect(page.locator('#pvBody table')).toContainText('Nettlesertest');
  await page.locator('#pvBack').click();
  await expect(page.locator('#pvTitle')).toHaveText('Veiledning');
  await page.locator('#pvFwd').click();
  await expect(page.locator('#pvTitle')).toHaveText('Referanse');
  await page.locator('#pvClose').click();
  await expect(page.locator('#preview')).not.toHaveClass(/\bshow\b/);
});

test('navigerer inn i en katalog og bruker grafhistorikken', async ({ page }) => {
  await loadBundle(page);
  await clickNode(page, 'nested/', true);
  await expect(page.locator('#graphPath')).toHaveText('nested/');
  await expect(page.locator('#stats')).toHaveText('1 files · 0 links');
  await page.locator('#graphBack').click();
  await expect(page.locator('#graphPath')).toHaveText('/');
  await page.locator('#graphFwd').click();
  await expect(page.locator('#graphPath')).toHaveText('nested/');
  await page.locator('#graphTop').click();
  await expect(page.locator('#graphPath')).toHaveText('/');
});

test('depth=0 laster neste nivå ved klikk, ikke ved oppstart', async ({ page }) => {
  const paths = [];
  page.on('request', request => paths.push(new URL(request.url()).pathname));
  await loadBundle(page, '0');
  await expect(page.locator('#stats')).toHaveText('1 files · 0 links');
  expect(paths).not.toContain(`${fixtureRootUrl}guide.md`);
  await clickNode(page, 'index.md');
  await expect(page.locator('#stats')).toHaveText('2 files · 1 links');
  expect(paths).not.toContain(`${fixtureRootUrl}nested/reference.md`);
  await clickNode(page, 'Veiledning');
  await expect(page.locator('#stats')).toHaveText('3 files · 3 links');
  await expect(page.locator('#spinner')).toBeHidden();
  await clickNode(page, 'Referanse');
  await expect(page.locator('#pvTitle')).toHaveText('Referanse');
});

test('viser en forståelig melding når pakken mangler', async ({ page }) => {
  await page.goto(fixtureExplorer('missing'));
  await expect(page.locator('#spinner')).toBeHidden();
  // The root has no index.md, so nothing loads at startup; a forced reload reports it.
  await page.locator('#reload').click();
  await expect(page.locator('#overlay')).toHaveClass(/\bshow\b/);
  await expect(page.locator('#overlayMsg')).toContainText('Nothing to load');
  await expect(page.locator('#spinner')).toBeHidden();
});

test('ignorerer en ekstern start uten å sende forespørsler til den', async ({ page }) => {
  const externalRequests = [];
  page.on('request', request => {
    if (new URL(request.url()).origin !== baseURL) {
      externalRequests.push(request.url());
    }
  });
  await page.goto(`${explorer}?start=https://example.invalid/private/x.md`);
  // An external ?start is refused and the bundle at the root loads instead.
  await expect(page.locator('#overlay')).not.toHaveClass(/\bshow\b/);
  await expect(page.locator('#stats')).toContainText('files');
  expect(externalRequests).toEqual([]);
});

test('viser mobilmeny og filtre ved 390 × 844', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadBundle(page);
  await expect(page.locator('#navToggle')).toBeVisible();
  await expect(page.locator('#navToggle')).toHaveAttribute('aria-expanded', 'false');
  await page.locator('#navToggle').click();
  await expect(page.locator('#navToggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#labels')).toBeVisible();
  await page.locator('#navToggle').click();
  await page.locator('#sideHandle').click();
  await expect(page.locator('#sideHandle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#search')).toBeInViewport();
  await page.locator('#search').fill('Veiledning');
  await expect(page.locator('#filterSummary')).toHaveText('search');
  await page.locator('#sideHandle').click();
  await expect(page.locator('#sideHandle')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#search')).not.toBeInViewport();
});

test('Om-panelet på mobil viser språkvalg og lenker og utvider resten', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${explorer}?depth=all`);
  await expect(page.locator('#spinner')).toBeHidden();
  // The startup About panel is open and collapsed on a small screen: the banner, revision,
  // language picker and links show, with the middle toggle hiding the rest.
  await expect(page.locator('#aboutPop')).toBeVisible();
  await expect(page.locator('#aboutToggle')).toBeVisible();
  await expect(page.locator('#langOpen')).toBeVisible();
  await expect(page.locator('#aboutPop .about-links')).toBeVisible();
  await expect(page.locator('#aboutPop .about-more')).toBeHidden();
  // The toggle reveals the rest and is then removed.
  await page.locator('#aboutToggle').click();
  await expect(page.locator('#aboutPop .about-more')).toBeVisible();
  await expect(page.locator('#aboutToggle')).toBeHidden();
  await expect(page.locator('#langOpen')).toBeVisible();
});

test('åpner .runtime fra Om-panelet og oppdaterer siden mens den leses', async ({ page }) => {
  await loadBundle(page);
  await page.locator('#titleBtn').click();
  await expect(page.locator('#aboutPop')).toBeVisible();
  // The toolbar shows the node mark; the About panel prints the brand as plain text.
  await expect(page.locator('#titleBtn svg.brand')).toBeVisible();
  await expect(page.locator('#aboutPop .about-body')).toContainText('okfy');
  await expect(page.locator('#aboutPop .wordmark')).toHaveCount(0);
  // The title carries the logo and stays flat on hover: no fill and no accent ring.
  await page.locator('#titleBtn').hover();
  await expect(page.locator('#titleBtn')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('#titleBtn')).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('#aboutRuntime')).toBeVisible();
  await expect(page.locator('#aboutRuntime')).toHaveCSS('color', 'rgb(139, 147, 167)');   // the Directory node colour
  // The About panel discloses the AI assistance and links to the transparency statement.
  await expect(page.locator('#aboutPop .about-note')).toContainText('assistant is an AI');
  await expect(page.locator('#aboutPop .about-links a[data-i18n="about.ai"]')).toHaveAttribute('id', 'aboutAi');
  const sourceBox = await page.locator('#aboutPop .about-links a').first().boundingBox();
  const runtimeBox = await page.locator('#aboutRuntime').boundingBox();
  expect(runtimeBox.x).toBeGreaterThan(sourceBox.x + sourceBox.width - 1);
  await page.locator('#aboutRuntime').click();
  await expect(page.locator('#aboutPop')).toBeHidden();
  await expect(page.locator('#graphPath')).toHaveText('.runtime/');
  await expect(page.locator('#preview')).toHaveClass(/\bshow\b/);
  await expect(page.locator('#pvPath')).toHaveText('.runtime/index.md');
  await expect(page.locator('#pvTitle')).toHaveText('Runtime');
  await expect(page.locator('#pvBody')).toContainText('synthetic directory');
  // The loaded-file and link counts belong to the bundle page, not the index.
  await expect(page.locator('#pvBody')).not.toContainText('Loaded');

  // The AI transparency statement is embedded as a generated page and linked from the About panel.
  await page.locator('#pvBody').getByRole('link', { name: 'AI transparency', exact: true }).click();
  await expect(page.locator('#pvPath')).toHaveText('.runtime/transparency.md');
  await expect(page.locator('#pvBody')).toContainText('Article 50');
  await page.locator('#pvBack').click();
  await expect(page.locator('#pvPath')).toHaveText('.runtime/index.md');

  // The performance page reports the browser's own measurements.
  await page.locator('#pvBody').getByRole('link', { name: 'Performance', exact: true }).click();
  await expect(page.locator('#pvPath')).toHaveText('.runtime/performance.md');
  await expect(page.locator('#pvBody')).toContainText('CPU threads');
  await expect(page.locator('#pvBody')).toContainText('Frame rate');
  // The trends are vector charts, collected one sample per second.
  await expect(page.locator('#pvBody .pv-charts')).toContainText('Collecting samples');
  await page.clock.runFor(3000);
  await expect(page.locator('#pvBody .pv-charts svg').first()).toBeVisible();
  await expect(page.locator('#pvBody .pv-chart-head').first()).toContainText('Frame rate');
  await page.locator('#pvBack').click();
  await expect(page.locator('#pvPath')).toHaveText('.runtime/index.md');

  // The bundle page lists statistics for the URL hosts the files reference.
  await page.locator('#pvBody').getByRole('link', { name: 'Bundle files', exact: true }).click();
  await expect(page.locator('#pvPath')).toHaveText('.runtime/bundle.md');
  await expect(page.locator('#pvBody')).toContainText('Loaded');
  await expect(page.locator('#pvBody')).toContainText('Links');
  await expect(page.locator('#pvBody')).toContainText('Domains');
  await expect(page.locator('#pvBody')).toContainText('No external links');
  await page.locator('#pvBack').click();
  await expect(page.locator('#pvPath')).toHaveText('.runtime/index.md');

  // The AGENTS.md page exposes the generated instructions given to the assistant.
  await page.locator('#pvBody').getByRole('link', { name: 'Agent instructions', exact: true }).click();
  await expect(page.locator('#pvPath')).toHaveText('.runtime/AGENTS.md');
  await expect(page.locator('#pvBody')).toContainText('read_concept');
  await page.locator('#pvBack').click();
  await expect(page.locator('#pvPath')).toHaveText('.runtime/index.md');

  // The assistant statistics page reports session state (and never the key).
  await page.locator('#pvBody').getByRole('link', { name: 'Assistant statistics', exact: true }).click();
  await expect(page.locator('#pvPath')).toHaveText('.runtime/assistant.md');
  await expect(page.locator('#pvBody')).toContainText('Requests');
  await expect(page.locator('#pvBody')).toContainText('No tool calls yet.');
  await page.locator('#pvBack').click();
  await expect(page.locator('#pvPath')).toHaveText('.runtime/index.md');

  // Follow a generated link, then watch the page update while it is read.
  await page.locator('#pvBody').getByRole('link', { name: 'Status', exact: true }).click();
  await expect(page.locator('#pvPath')).toHaveText('.runtime/status.md');
  await expect(page.locator('#pvBody')).toContainText('Search: (none)');
  await setFilters(page, true);   // the filter panel starts collapsed
  await page.locator('#search').fill('guide');
  await expect(page.locator('#pvBody')).toContainText('Search: guide');
});

test('agentinstruksjonene følger språkinnstillingen', async ({ page }) => {
  await loadBundle(page);
  // Choose French from the About picker, then read the generated agent instructions.
  await page.locator('#titleBtn').click();
  await page.locator('#langOpen').click();
  await page.locator('#langSearch').fill('french');
  await page.locator('#langList .lang-row[data-tag="fr"]').first().click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.locator('#aboutRuntime').click();
  await expect(page.locator('#pvPath')).toHaveText('.runtime/index.md');
  await page.locator('#pvBody').getByRole('link', { name: 'Agent instructions', exact: true }).click();
  await expect(page.locator('#pvPath')).toHaveText('.runtime/AGENTS.md');
  // The instructions name the preferred output language for the reply and the spoken commentary.
  await expect(page.locator('#pvBody')).toContainText('Output language');
  await expect(page.locator('#pvBody')).toContainText('French (fr), the interface language');
});

test('oversetter grensesnittet og støtter høyre-til-venstre', async ({ page }) => {
  // Arabic: chosen from the language dialog, which persists it in the browser (there is
  // no ?lang URL parameter any more). Right-to-left orientation and translated controls.
  await page.goto(`${explorer}?depth=all`);
  await expect(page.locator('#overlay')).not.toHaveClass(/\bshow\b/);
  await expect(page.locator('#spinner')).toBeHidden();
  await expect(page.locator('#stats')).toHaveText(/\S/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#aboutPop')).toBeHidden();
  await page.locator('#titleBtn').click();
  await page.locator('#langOpen').click();
  await page.locator('#langSearch').fill('arabic');
  await page.locator('#langList .lang-row[data-tag="ar"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#resetView')).toHaveText('إعادة ضبط العرض');
  await expect(page.locator('#search')).toHaveAttribute('placeholder', 'مثال: json, guide, nsm…');
  await expect(page.locator('#stats')).toContainText('ملف');

  // The layout mirrors for right-to-left: the filter sidebar and the toolbar dock to
  // the inline-start edge, and the back/forward chevrons flip.
  const vw = page.viewportSize().width;
  const sideAr = await page.locator('#sidebar').boundingBox();
  expect(sideAr.x).toBeLessThan(48);
  const barAr = await page.locator('.bar').boundingBox();
  expect(barAr.x).toBeGreaterThan(300);
  await expect(page.locator('#graphBack')).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)');
  await expect(page.locator('#graphFwd')).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)');
  // The rotated panel tab sits on-screen on the sidebar's inner edge; because its
  // inline axis is vertical it uses a physical offset, mirrored for RTL.
  const handleAr = await page.locator('#sideHandle').boundingBox();
  expect(handleAr.x + handleAr.width).toBeLessThanOrEqual(vw);

  // Spanish: chosen from the dialog too — left-to-right again, with Spanish plural nouns.
  await page.locator('#titleBtn').click();
  await page.locator('#langOpen').click();
  await page.locator('#langSearch').fill('spanish');
  await page.locator('#langList .lang-row[data-tag="es"]').first().click();
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('#resetView')).toHaveText('Restablecer vista');
  await expect(page.locator('#stats')).toContainText('archivos');
  await expect(page.locator('#stats')).toContainText('enlaces');

  // Left-to-right: the same panels dock to the opposite (inline-end) edge and the
  // chevrons point the other way.
  const sideEs = await page.locator('#sidebar').boundingBox();
  expect(sideEs.x).toBeGreaterThan(vw - 360);
  const barEs = await page.locator('.bar').boundingBox();
  expect(barEs.x).toBeLessThan(48);
  await expect(page.locator('#graphBack')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  const handleEs = await page.locator('#sideHandle').boundingBox();
  expect(handleEs.x).toBeGreaterThanOrEqual(0);

  // The language picker now lives in the About panel: its trigger opens a searchable
  // dialog, and choosing a language flips the interface (and the panel's anchor) in place.
  await expect(page.locator('#sidebar #langOpen')).toHaveCount(0);
  await page.locator('#titleBtn').click();
  await expect(page.locator('#langCurrent')).not.toBeEmpty();
  // The picker carries the Directory node colour (#8b93a7), like the runtime link and File colour.
  await expect(page.locator('#aboutPop .about-lang label')).toHaveCSS('color', 'rgb(139, 147, 167)');
  await expect(page.locator('#langOpen')).toHaveCSS('border-top-color', 'rgb(139, 147, 167)');
  await page.locator('#langOpen').click();
  await expect(page.locator('#langPop')).toBeVisible();
  await page.locator('#langList .lang-row[data-tag="ar"]').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#resetView')).toHaveText('إعادة ضبط العرض');
  await expect(page.locator('#langPop')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#aboutPop')).toBeHidden();

  // Left-to-right values stay isolated in a right-to-left interface.
  await expect(page.locator('#graphPath')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('#graphPath')).toHaveCSS('unicode-bidi', 'isolate');
  await expect(page.locator('#pvPath')).toHaveAttribute('dir', 'ltr');

  // Generated content declares its own language and direction, not the interface's.
  await page.locator('#titleBtn').click();
  await page.locator('#aboutRuntime').click();
  await expect(page.locator('#pvPath')).toHaveText('.runtime/index.md');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('#pvBody')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#pvBody')).toHaveAttribute('dir', 'ltr');
  // The preview's own back/forward chevrons mirror with the interface direction.
  await expect(page.locator('#pvBack')).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)');
  await expect(page.locator('#pvFwd')).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)');
});

test('grupperer språkvalget etter verdensdel', async ({ page }) => {
  await loadBundle(page);
  await page.locator('#titleBtn').click();
  await page.locator('#langOpen').click();
  // Region headings: the English name, sorted alphabetically, with the languages under them.
  await expect(page.locator('#langList .pop-sec').first()).toHaveText('Africa');
  await expect(page.locator('#langList .pop-sec', { hasText: 'Asia' })).toHaveCount(1);
  await expect(page.locator('#langList .pop-sec', { hasText: 'Africa' })).toHaveCount(1);
  // English is listed under both Europe and the Americas.
  await expect(page.locator('#langList .lang-row[data-tag="en"]')).toHaveCount(2);
  await expect(page.locator('#langList .lang-row[data-tag="zh-Hans"]')).toHaveCount(1);
  await expect(page.locator('#langList .lang-row[data-tag="sw"]')).toHaveCount(1);
  // Serbian ships in both scripts: the default Cyrillic (no script subtag) and Latin.
  await page.locator('#langSearch').fill('serbian');
  await expect(page.locator('#langList .lang-row')).toHaveCount(2);
  await page.locator('#langList .lang-row[data-tag="sr-Latn"]').click();
  // Serbian (Latin) has no dictionary: the interface text stays English and is declared as
  // such, the direction follows the chosen script, and the choice is remembered.
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  expect(await page.evaluate(() => localStorage.getItem('okfy.lang'))).toBe('sr-Latn');
  // A language with its own dictionary switches the interface.
  await page.locator('#langOpen').click();
  await page.locator('#langSearch').fill('dutch');
  await page.locator('#langList .lang-row[data-tag="nl"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  await expect(page.locator('#resetView')).toHaveText('Weergave resetten');
  // A newly shipped dictionary switches the interface too (found by its own name, "svenska").
  await page.locator('#langOpen').click();
  // The list stays in English whatever the interface language is (now Dutch); only the
  // region headings gain the interface language's name in parentheses.
  await expect(page.locator('#langList .lang-row[data-tag="es"]').first()).toHaveText('Spanish (español)');
  await expect(page.locator('#langList .pop-sec', { hasText: 'Europe (Europa)' })).toHaveCount(1);
  await page.locator('#langSearch').fill('svenska');
  await page.locator('#langList .lang-row[data-tag="sv"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'sv');
  await expect(page.locator('#resetView')).toHaveText('Återställ vy');
});

test('søker i språklista og støtter språk uten ordbok', async ({ page }) => {
  await loadBundle(page);
  await page.locator('#titleBtn').click();
  await page.locator('#langOpen').click();
  // The dialog offers every language.
  expect(await page.locator('#langList .lang-row').count()).toBeGreaterThan(100);
  // Every entry is the English name, with the language's own name in parentheses.
  await expect(page.locator('#langList .lang-row[data-tag="es"]').first()).toHaveText('Spanish (español)');
  await expect(page.locator('#langList .lang-row[data-tag="ja"]')).toHaveText('Japanese (日本語)');
  // The search narrows the list by name (case- and accent-insensitive).
  await page.locator('#langSearch').fill('arab');
  await expect(page.locator('#langList .lang-row')).toHaveCount(1);
  await expect(page.locator('#langList .lang-row[data-tag="ar"]')).toHaveCount(1);
  // A language without a dictionary is still selectable: the interface text is declared
  // and shown as English, and the choice is remembered.
  await page.locator('#langSearch').fill('maori');
  await page.locator('#langList .lang-row[data-tag="mi"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#resetView')).toHaveText('Reset view');
  expect(await page.evaluate(() => localStorage.getItem('okfy.lang'))).toBe('mi');
});

test('holder språkvalgdialogen innenfor vinduet', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 380 });
  await loadBundle(page);
  await page.locator('#titleBtn').click();
  await page.locator('#langOpen').click();
  await expect(page.locator('#langPop')).toBeVisible();
  const vp = page.viewportSize();
  const box = await page.locator('#langPop').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 0.5);
});

test('viser hele Om-panelet når det er plass', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1200 });
  await loadBundle(page);
  await page.locator('#titleBtn').click();
  await expect(page.locator('#aboutPop')).toBeVisible();
  const body = page.locator('#aboutPop .about-body');
  // The panel's full height, measured in a tall window.
  const full = await body.evaluate(el => el.scrollHeight);
  // In a window tall enough to hold it, the panel is shown in full with no inner scroll.
  await page.setViewportSize({ width: 900, height: full + 120 });
  // Playwright's viewport emulation does not emit a window resize, and the panel caps
  // its height on resize, so trigger it explicitly.
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  const slack = await body.evaluate(el => el.scrollHeight - el.clientHeight);
  expect(slack).toBeLessThanOrEqual(1);
  const vp = page.viewportSize();
  const box = await page.locator('#aboutPop').boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 0.5);
  // In a short window it caps to the remaining height but still stays inside.
  await page.setViewportSize({ width: 900, height: 320 });
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  const box2 = await page.locator('#aboutPop').boundingBox();
  expect(box2.y).toBeGreaterThanOrEqual(0);
  expect(box2.y + box2.height).toBeLessThanOrEqual(320 + 0.5);
});


test('laster prosjektets kunnskapsindeks som en separat røykprøve', async ({ page }) => {
  await page.goto(`${projectExplorer}?depth=all`);
  await expect(page.locator('#overlay')).not.toHaveClass(/\bshow\b/);
  await expect(page.locator('#spinner')).toBeHidden();
  await expect(page.locator('#stats')).toHaveText(/[1-9]\d* files · \d+ links/);
});

test('husker valgt språk til neste besøk', async ({ page }) => {
  await loadBundle(page);
  // Choose Swedish from the dialog.
  await page.locator('#titleBtn').click();
  await page.locator('#langOpen').click();
  await page.locator('#langSearch').fill('swedish');
  await page.locator('#langList .lang-row[data-tag="sv"]').click();
  await expect(page.locator('#resetView')).toHaveText('Återställ vy');
  // The choice is persisted in the browser and restored on the next visit.
  await page.reload();
  await expect(page.locator('#spinner')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('lang', 'sv');
  await expect(page.locator('#resetView')).toHaveText('Återställ vy');
});

test('bruker nettleserens foretrukne språk når intet er lagret', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'en'] });
  });
  await page.goto(`${explorer}?depth=all`);
  await expect(page.locator('#spinner')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
});

test('fjerner et foreldet ?lang fra adressen', async ({ page }) => {
  await page.goto(`${explorer}?depth=all&lang=de`);
  await expect(page.locator('#spinner')).toBeHidden();
  // The parameter is gone from the URL and has no effect on the interface.
  expect(page.url()).not.toContain('lang=');
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('starter en ny kortstokk når panelet er fullt', async ({ page }) => {
  // The project bundle declares decks (Tour, Model). In a short window they fill the
  // column, and a card released clear of them must still start a new deck.
  await page.setViewportSize({ width: 1440, height: 640 });
  await page.goto(`${projectExplorer}?depth=all`);
  await expect(page.locator('#spinner')).toBeHidden();
  await page.keyboard.press('Escape');
  await page.clock.runFor(2000);
  const before = await page.locator('#deckBody > .deck-stack').count();
  expect(before).toBeGreaterThan(0);
  // Precondition: the decks already fill the column's visible area.
  const full = await page.evaluate(() => {
    const b = document.getElementById('deckBody');
    const room = parseFloat(b.style.getPropertyValue('--deck-room')) || 0;
    return (b.scrollHeight - 2 * room) > b.clientHeight + 1;
  });
  expect(full).toBe(true);
  // Pick a concept node clear of the docked panel.
  const label = await page.evaluate(() => {
    const g = window.graphLabels;
    return Object.keys(g).find(k => !k.endsWith('/') && g[k].x < 700 && g[k].y > 80);
  });
  expect(label).toBeTruthy();
  const p = await page.evaluate(l => window.graphLabels[l], label);
  const cv = await page.locator('#c').boundingBox();
  await page.mouse.move(cv.x + p.x, cv.y + p.y);
  await page.mouse.down();
  await page.clock.runFor(600);                       // the press-hold starts the card drag
  const deck = await page.locator('#deck').boundingBox();
  await page.mouse.move(deck.x + deck.width / 2, deck.y + 30, { steps: 8 });
  await page.clock.runFor(50);
  // Clear of every stack the drop site turns dashed…
  await expect(page.locator('#deck')).toHaveClass(/\bnewdeck\b/);
  await page.mouse.up();
  await page.clock.runFor(50);
  // …and the release starts a new deck even though the column was full.
  await expect(page.locator('#deckBody > .deck-stack')).toHaveCount(before + 1);
});

test('holder toppgruppene like høye', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${projectExplorer}?depth=all`);
  await expect(page.locator('#spinner')).toBeHidden();
  await page.keyboard.press('Escape');
  // The taller brand mark in the title group must not make it taller than the nav groups.
  const heights = await page.locator('.bar .group').evaluateAll(gs => gs.map(g => g.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThan(1);
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
});

test('assistenten kan ikke lukke eller endre fullskjermlesingen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${projectExplorer}?depth=all`);
  await expect(page.locator('#spinner')).toBeHidden();
  await page.keyboard.press('Escape');
  await page.clock.runFor(1500);   // the declared decks render
  // Give the assistant a keyless local provider before reading covers the panel.
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    document.getElementById('asProvider').click();
    document.querySelector('#asProvList [data-kind="llamacpp"]').click();
    document.getElementById('asProvSave').click();
    const s = document.getElementById('asStream'); s.checked = false; s.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  // Open the active deck's first card: full-page reading within the window.
  await page.evaluate(() => document.querySelector('#deckBody .deck-stack.active .deck-card').click());
  await expect(page.locator('body')).toHaveClass(/\bdeck-fullscreen\b/);

  let turn = 0;
  await page.route('**/v1/chat/completions', route => {
    turn++;
    const message = turn === 1
      ? { role: 'assistant', content: '', tool_calls: [
          { id: 'c1', type: 'function', function: { name: 'viewer_preview', arguments: JSON.stringify({ action: 'close' }) } },
          { id: 'c2', type: 'function', function: { name: 'add_to_decks', arguments: JSON.stringify({ items: [{ path: 'index.md' }] }) } }
        ] }
      : { role: 'assistant', content: 'Reading stays open and the deck is untouched.' };
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message }] }) });
  });
  // The assistant asks to close the page and to change the deck; both are refused while reading.
  await page.evaluate(() => { document.getElementById('asInput').value = 'close it and add a card'; document.getElementById('asSend').click(); });
  const toolTexts = page.locator('#asLog .as-msg.tool .as-tool');
  await expect(toolTexts.first()).toContainText('only the user can close it');
  await expect(toolTexts.last()).toContainText('deck is locked');
  await expect(page.locator('body')).toHaveClass(/\bdeck-fullscreen\b/);
});

test('assistenten markerer et avsnitt på tvers av innebygd formatering', async ({ page }) => {
  await loadBundle(page);
  await expect(page.locator('#assistant')).toBeVisible();
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    document.getElementById('asProvider').click();
    document.querySelector('#asProvList [data-kind="llamacpp"]').click();
    document.getElementById('asProvSave').click();
    const s = document.getElementById('asStream'); s.checked = false; s.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());

  let turn = 0;
  await page.route('**/v1/chat/completions', route => {
    turn++;
    const message = turn === 1
      ? { role: 'assistant', content: '', tool_calls: [
          { id: 'c1', type: 'function', function: { name: 'open_concept', arguments: JSON.stringify({ path: 'guide.md' }) } },
          // The phrase crosses the inline link, so the match must span three text nodes.
          { id: 'c2', type: 'function', function: { name: 'viewer_highlight', arguments: JSON.stringify({ texts: ['Les Referanse for et'], scroll: false }) } }
        ] }
      : { role: 'assistant', content: 'Marked.' };
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message }] }) });
  });
  await page.evaluate(() => { document.getElementById('asInput').value = 'mark that sentence'; document.getElementById('asSend').click(); });
  // One match, wrapped across the three text nodes, with a single ● badge on the first segment.
  await expect(page.locator('#asLog .as-msg.tool .as-tool').last()).toContainText('"textMatches":1');
  await expect(page.locator('#pvBody mark.pv-hl')).toHaveCount(3);
  await expect(page.locator('#pvBody mark.pv-hl.pv-hl-dot')).toHaveCount(1);
});
