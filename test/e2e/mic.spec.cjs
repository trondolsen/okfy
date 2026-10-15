// Voice input over the realtime WebSocket API: the audio input model (only models that report
// the audio_transcription_realtime capability are offered), microphone capture, local
// voice-activity endpointing, streaming transcription and the sticky user bubble. Captures the
// host's devices with stubs, including a stubbed WebSocket, so it drives the whole pipeline
// without a real microphone or provider.
const { test, expect } = require('@playwright/test');
const { fixtureExplorer } = require('../support/paths.cjs');

// The fixture bundle is served as the root of a generated folder (support/prepare-roots.mjs).
const explorer = fixtureExplorer('basic');

// Stub the host's audio devices, the Web Audio API and WebSocket, so capture, endpointing and
// the streaming transcription run without a real microphone or provider. `window.__micLevel`
// drives the analyser; the stubbed socket answers `input_audio.end` with a transcript.
function installMicStubs() {
  // The assistant's Settings is gated behind an acknowledgement; these tests drive it directly,
  // so seed the acknowledgement before the page loads.
  try { localStorage.setItem('okfy.assistant.ack', '1'); } catch (e) {}
  window.__micLevel = 0;
  window.__wsSent = [];
  window.__ws = null;
  window.AudioContext = class {
    constructor(o) { this.state = 'running'; this.destination = {}; this.sampleRate = (o && o.sampleRate) || 48000; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    close() { return Promise.resolve(); }
    createMediaStreamSource() { return { connect() {} }; }
    createAnalyser() {
      return {
        fftSize: 1024, smoothingTimeConstant: 0.4, connect() {},
        get frequencyBinCount() { return this.fftSize / 2; },
        getFloatTimeDomainData(b) { const v = window.__micLevel || 0; for (let i = 0; i < b.length; i++) b[i] = v; },
        getFloatFrequencyData(b) { b.fill(-140); }
      };
    }
    createScriptProcessor() { return { onaudioprocess: null, connect() {}, disconnect() {} }; }
    createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} }; }
    decodeAudioData(b, ok) { const d = { duration: 1 }; if (ok) ok(d); return Promise.resolve(d); }
    createBufferSource() { return { buffer: null, onended: null, connect() {}, start() {}, stop() {} }; }
  };
  window.WebSocket = class {
    constructor(url, protocols) {
      this.url = url; this.protocols = protocols; this.readyState = 0;
      this.onopen = null; this.onmessage = null; this.onerror = null; this.onclose = null;
      window.__ws = this;
      setTimeout(() => {
        if (window.__ws !== this) return;
        this.readyState = 1;
        if (this.onopen) this.onopen();
        this.emit({ type: 'session.created', session: { request_id: 'r1', audio_format: { encoding: 'pcm_s16le', sample_rate: 16000 } } });
      }, 5);
    }
    emit(obj) { if (this.onmessage) this.onmessage({ data: JSON.stringify(obj) }); }
    send(text) {
      window.__wsSent.push(text);
      let msg = null; try { msg = JSON.parse(text); } catch (e) {}
      if (msg && msg.type === 'input_audio.end') {
        const self = this;
        setTimeout(() => {
          if (window.__ws !== self) return;
          if (window.__transcriptError) { self.emit({ type: 'error', error: { message: window.__transcriptError } }); return; }
          self.emit({ type: 'transcription.text.delta', text: window.__transcript || 'What is the state of security in okfy?' });
          self.emit({ type: 'transcription.done', session_id: 'r1' });
        }, 5);
      }
    }
    close() { this.readyState = 3; const f = this.onclose; this.onclose = null; if (f) f(); }
  };
  window.WebSocket.OPEN = 1;
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }),
      enumerateDevices: async () => [
        { kind: 'audioinput', deviceId: 'mic-1', label: 'Built-in microphone' },
        { kind: 'audioinput', deviceId: 'mic-2', label: 'USB microphone' }
      ]
    }
  });
}

// Voice barge-in needs both directions at once: the microphone capture plus a stand-in Web Audio
// playback path. `window.__micLevel` drives the detector and `window.__speechStops` counts the
// playback interruptions.
function installDuplexStubs() {
  // The assistant's Settings is gated behind an acknowledgement; these tests drive it directly,
  // so seed the acknowledgement before the page loads.
  try { localStorage.setItem('okfy.assistant.ack', '1'); } catch (e) {}
  window.__micLevel = 0;
  window.__speechStarts = 0;
  window.__speechStops = 0;
  window.__wsSent = [];
  window.__ws = null;
  window.AudioContext = class {
    constructor(o) { this.state = 'running'; this.destination = {}; this.sampleRate = (o && o.sampleRate) || 48000; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    close() { return Promise.resolve(); }
    createMediaStreamSource() { return { connect() {} }; }
    createAnalyser() {
      return {
        fftSize: 1024, smoothingTimeConstant: 0.4, connect() {},
        get frequencyBinCount() { return this.fftSize / 2; },
        getFloatTimeDomainData(b) { const v = window.__micLevel || 0; for (let i = 0; i < b.length; i++) b[i] = v; },
        getFloatFrequencyData(b) { b.fill(-140); }
      };
    }
    createScriptProcessor() { return { onaudioprocess: null, connect() {}, disconnect() {} }; }
    createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} }; }
    decodeAudioData(buf, ok) { const d = { duration: 1 }; if (ok) ok(d); return Promise.resolve(d); }
    createBufferSource() { return { buffer: null, onended: null, connect() {}, start() { window.__speechStarts++; }, stop() { window.__speechStops++; } }; }
  };
  window.WebSocket = class {
    constructor(url, protocols) {
      this.url = url; this.protocols = protocols; this.readyState = 0;
      this.onopen = null; this.onmessage = null; this.onerror = null; this.onclose = null;
      window.__ws = this;
      setTimeout(() => {
        if (window.__ws !== this) return;
        this.readyState = 1;
        if (this.onopen) this.onopen();
        this.emit({ type: 'session.created', session: { request_id: 'r1' } });
      }, 5);
    }
    emit(obj) { if (this.onmessage) this.onmessage({ data: JSON.stringify(obj) }); }
    send(text) {
      window.__wsSent.push(text);
      let msg = null; try { msg = JSON.parse(text); } catch (e) {}
      if (msg && msg.type === 'input_audio.end') {
        const self = this;
        setTimeout(() => {
          if (window.__ws !== self) return;
          self.emit({ type: 'transcription.text.delta', text: 'stop talking, what is this bundle?' });
          self.emit({ type: 'transcription.done', session_id: 'r1' });
        }, 5);
      }
    }
    close() { this.readyState = 3; const f = this.onclose; this.onclose = null; if (f) f(); }
  };
  window.WebSocket.OPEN = 1;
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }), enumerateDevices: async () => [] }
  });
}

test('mikrofonen lytter, strømmer transkripsjonen og sender spørsmålet', async ({ page }) => {
  await page.addInitScript(installMicStubs);

  await page.goto(`${explorer}?depth=all`);
  await expect(page.locator('#spinner')).toBeHidden();
  await page.keyboard.press('Escape');

  // Without an audio input model the microphone refuses to turn on.
  await page.evaluate(() => document.getElementById('asMicToggle').click());
  await expect(page.locator('#asMicToggle')).toHaveAttribute('aria-pressed', 'false');

  await page.route('**/v1/models', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ data: [
      { id: 'voxtral-mini-transcribe-realtime-2602', capabilities: { audio_transcription_realtime: true } },   // realtime: offered
      { id: 'voxtral-batch', capabilities: { audio_transcription: true } }                                      // batch only: not offered
    ] })
  }));

  // Configure the chat and the audio input provider; the input picker offers only the model
  // the provider reports as realtime transcription, not the batch-only one.
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    document.getElementById('asProvider').click(); document.querySelector('#asProvList [data-kind="llamacpp"]').click(); document.getElementById('asProvSave').click();
    const s = document.getElementById('asStream'); s.checked = false; s.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => document.getElementById('asInputOpen').click());
  await expect(page.locator('#asModelList .as-model-row')).toHaveCount(1);   // the batch-only model is filtered out
  await expect(page.locator('#asModelList .as-model-row')).toHaveAttribute('data-id', 'voxtral-mini-transcribe-realtime-2602');
  await page.evaluate(() => document.querySelector('#asModelList .as-model-row').click());
  await expect.poll(async () => page.evaluate(() => document.getElementById('asInputModel').value)).toBe('voxtral-mini-transcribe-realtime-2602');

  // The device menu lists the host inputs and remembers the pick.
  await page.evaluate(() => document.getElementById('asMicToggle').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
  await expect(page.locator('#asMicMenu .as-mic-row')).toHaveCount(2);
  await page.evaluate(() => document.querySelector('#asMicMenu .as-mic-row[data-device="mic-2"]').click());
  await expect(page.locator('#asMicMenu')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('okfy.assistant')).micDevice)).toBe('mic-2');
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());

  let chatBody = null;
  await page.route('**/v1/chat/completions', route => {
    chatBody = route.request().postDataJSON();
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'It is thorough.' } }] }) });
  });
  // The provider mints a short-lived realtime token, one per session, that the socket carries
  // as a subprotocol. Each mint returns a distinct token so reuse would be visible.
  let mintCount = 0, mintBody = null;
  await page.route('**/client/sessions', route => {
    mintCount++;
    mintBody = route.request().postDataJSON();
    route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ object: 'client.session', purpose: 'realtime', client_secret: { value: 'rt_test_' + mintCount } }) });
  });

  // Now the microphone turns on. Hold the room quiet so the detector can calibrate its
  // noise floor before speech (the onset follows that floor, not a fixed level).
  await page.evaluate(() => document.getElementById('asMicToggle').click());
  await expect(page.locator('#asMicToggle')).toHaveAttribute('aria-pressed', 'true');
  // The first session's token is minted ahead of time, so its socket opens without a round trip.
  await expect.poll(async () => mintCount).toBe(1);
  await page.waitForTimeout(700);

  // Speaking opens a sticky user bubble; falling quiet ends the utterance, the socket streams
  // the transcript, and the finished text is sent as the question.
  await page.evaluate(() => { window.__micLevel = 0.3; });
  await expect(page.locator('#asLog .as-msg.user.listening')).toHaveCount(1);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('#asLog .as-msg.user.listening')).position)).toBe('sticky');
  // The listening bubble carries a live input spectrogram, like the spoken bubble.
  await expect(page.locator('#asLog .as-msg.user.listening canvas.as-wave')).toHaveCount(1);
  await page.evaluate(() => { window.__micLevel = 0; });
  await expect.poll(async () => page.evaluate(() => (window.__wsSent || []).some(m => m.indexOf('input_audio.end') >= 0))).toBe(true);
  await expect(page.locator('#asLog .as-msg.user', { hasText: 'What is the state of security in okfy?' })).toHaveCount(1);
  await expect(page.locator('#asLog .as-msg.user.listening')).toHaveCount(0);
  // The input spectrogram is kept in the bubble after the utterance ends.
  await expect(page.locator('#asLog .as-msg.user', { hasText: 'What is the state of security in okfy?' }).locator('canvas.as-wave')).toHaveCount(1);

  // The token was minted for the realtime model, and the socket carries it as a subprotocol.
  expect(mintBody).toEqual({ purpose: 'realtime', model: 'voxtral-mini-transcribe-realtime-2602' });
  const wsInfo = await page.evaluate(() => ({ url: window.__ws.url, protocols: window.__ws.protocols }));
  expect(wsInfo.protocols).toEqual(['realtime', 'rt_test_1']);
  expect(wsInfo.url).toContain('/audio/transcriptions/realtime?model=voxtral-mini-transcribe-realtime-2602');

  await expect.poll(async () => chatBody).not.toBeNull();
  const lastUser = (chatBody.messages || []).filter(m => m.role === 'user').pop();
  expect(lastUser.content).toBe('What is the state of security in okfy?');
  await expect(page.locator('#asLog .as-msg.assistant', { hasText: 'It is thorough.' })).toHaveCount(1);

  // A second utterance in the same session works too: the VAD keeps running and a fresh
  // realtime session opens, reusing the cached token.
  await page.evaluate(() => { window.__transcript = 'And what about the limits?'; });
  await page.waitForTimeout(900);   // let the detector recalibrate the quiet room
  await page.evaluate(() => { window.__micLevel = 0.3; });
  await expect(page.locator('#asLog .as-msg.user.listening')).toHaveCount(1);
  await expect(page.locator('#asLog .as-msg.user.listening canvas.as-wave')).toHaveCount(1);
  await page.evaluate(() => { window.__micLevel = 0; });
  await expect(page.locator('#asLog .as-msg.user', { hasText: 'And what about the limits?' })).toHaveCount(1);
  await expect.poll(async () => (chatBody.messages || []).filter(m => m.role === 'user').length).toBe(2);
  // Each session mints its own token, so a reused (and retired) one can never be sent again.
  await expect.poll(async () => mintCount).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => window.__ws.protocols)).toEqual(['realtime', 'rt_test_2']);

  await page.evaluate(() => document.getElementById('asMicToggle').click());
  await expect(page.locator('#asMicToggle')).toHaveAttribute('aria-pressed', 'false');
});

test('en feilende sanntidsøkt stopper mikrofonen og viser årsaken', async ({ page }) => {
  await page.addInitScript(installMicStubs);

  await page.goto(`${explorer}?depth=all`);
  await expect(page.locator('#spinner')).toBeHidden();
  await page.keyboard.press('Escape');

  // Configure the audio input provider and type the realtime model by hand.
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    const im = document.getElementById('asInputModel');
    im.value = 'voxtral-mini-transcribe-realtime-2602'; im.dispatchEvent(new Event('change'));
  });
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('okfy.assistant')).input.model)).toBe('voxtral-mini-transcribe-realtime-2602');
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());

  // The token mint fails, which would otherwise be retried on every utterance.
  await page.route('**/client/sessions', route => route.fulfill({
    status: 401, contentType: 'application/problem+json',
    body: JSON.stringify({ title: 'Unauthorized', detail: 'Invalid API key' })
  }));

  await page.evaluate(() => document.getElementById('asMicToggle').click());
  await expect(page.locator('#asMicToggle')).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(700);   // calibrate
  // Speech opens a bubble, which the failed session then closes as it stops listening.
  await page.evaluate(() => { window.__micLevel = 0.3; });

  // Listening stops, the placeholder bubble gives way to an error that names the cause, and
  // the configured model is kept so the user can fix the key rather than the model.
  await expect(page.locator('#asMicToggle')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#asLog .as-msg.user.listening')).toHaveCount(0);
  await expect(page.locator('#asLog .as-msg.error')).toHaveCount(1);
  await expect(page.locator('#asLog .as-msg.error').first()).toContainText('Invalid API key');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('okfy.assistant')).input.model)).toBe('voxtral-mini-transcribe-realtime-2602');
});

test('en overbelastet transkripsjonstjeneste forklares kort', async ({ page }) => {
  await page.addInitScript(installMicStubs);

  await page.goto(`${explorer}?depth=all`);
  await expect(page.locator('#spinner')).toBeHidden();
  await page.keyboard.press('Escape');

  // Configure the audio input provider and type the realtime model by hand.
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    const im = document.getElementById('asInputModel');
    im.value = 'voxtral-mini-transcribe-realtime-2602'; im.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.route('**/client/sessions', route => route.fulfill({
    status: 201, contentType: 'application/json',
    body: JSON.stringify({ object: 'client.session', purpose: 'realtime', client_secret: { value: 'rt_1' } })
  }));

  // The provider's overloaded streaming backend answers with an opaque queue-overflow dump.
  await page.evaluate(() => { window.__transcriptError = 'gRPC streaming transcription error: <AioRpcError of RPC that terminated with: status = StatusCode.UNKNOWN details = "Unexpected <class \'vllm.exceptions.QueueOverflowError\'>" >'; });
  await page.evaluate(() => document.getElementById('asMicToggle').click());
  await expect(page.locator('#asMicToggle')).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(700);   // calibrate
  await page.evaluate(() => { window.__micLevel = 0.3; });
  await expect(page.locator('#asLog .as-msg.user.listening')).toHaveCount(1);
  await page.evaluate(() => { window.__micLevel = 0; });

  // The raw gRPC dump is replaced with a short, actionable notice.
  await expect(page.locator('#asLog .as-msg.error')).toHaveCount(1);
  await expect(page.locator('#asLog .as-msg.error').first()).toContainText('overloaded');
  await expect(page.locator('#asLog .as-msg.error').first()).not.toContainText('AioRpcError');
  // An overload is transient: listening stays on so the user can simply speak again.
  await expect(page.locator('#asMicToggle')).toHaveAttribute('aria-pressed', 'true');
});

test('brukeren kan avbryte assistentens tale med stemmen', async ({ page }) => {
  await page.addInitScript(installDuplexStubs);
  await page.goto(`${explorer}?depth=all`);
  await expect(page.locator('#spinner')).toBeHidden();
  await page.keyboard.press('Escape');

  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    document.getElementById('asProvider').click(); document.querySelector('#asProvList [data-kind="llamacpp"]').click(); document.getElementById('asProvSave').click();
    const m = document.getElementById('asAudioModel'); m.value = 'tts'; m.dispatchEvent(new Event('change'));
    const v = document.getElementById('asAudioVoice'); v.value = 'v1'; v.dispatchEvent(new Event('change'));
    const im = document.getElementById('asInputModel'); im.value = 'voxtral-mini-transcribe-realtime-2602'; im.dispatchEvent(new Event('change'));
    const s = document.getElementById('asStream'); s.checked = false; s.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());

  await page.route('**/audio/voices**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ id: 'v1', languages: ['en'] }], total: 1, page_size: 100, total_pages: 1 }) }));
  await page.route('**/client/sessions', route => route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ client_secret: { value: 'rt_1' } }) }));
  await page.route('**/audio/speech', route => route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.from([0, 1, 2, 3]) }));
  let chats = 0;
  await page.route('**/v1/chat/completions', route => {
    chats++;
    const body = chats === 1
      ? { choices: [{ message: { role: 'assistant', content: '', tool_calls: [{ id: 's1', type: 'function', function: { name: 'speak', arguments: JSON.stringify({ text: 'Let me explain the bundle.' }) } }] } }] }
      : { choices: [{ message: { role: 'assistant', content: 'It is thorough.' } }] };
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  // Audio output and the microphone both on.
  await page.evaluate(() => document.getElementById('asSpeakToggle').click());
  await expect(page.locator('#asSpeakToggle')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => document.getElementById('asMicToggle').click());
  await expect(page.locator('#asMicToggle')).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(700);   // calibrate the quiet room

  // Ask a question; the reply is spoken and keeps playing (the stub never ends the clip).
  await page.evaluate(() => { document.getElementById('asInput').value = 'What is this?'; document.getElementById('asSend').click(); });
  await expect.poll(async () => page.evaluate(() => window.__speechStarts)).toBeGreaterThan(0);
  await expect.poll(async () => page.evaluate(() => !document.getElementById('asSpeaking').hidden)).toBe(true);

  // The user speaks over the reply: the speech stops and a listening bubble opens.
  await page.evaluate(() => { window.__micLevel = 0.5; });
  await expect.poll(async () => page.evaluate(() => window.__speechStops)).toBeGreaterThan(0);
  await expect(page.locator('#asLog .as-msg.user.listening')).toHaveCount(1);
  await expect.poll(async () => page.evaluate(() => document.getElementById('asSpeaking').hidden)).toBe(true);

  // Falling quiet ends the utterance; it is transcribed and asked as a new question.
  await page.evaluate(() => { window.__micLevel = 0; });
  await expect(page.locator('#asLog .as-msg.user', { hasText: 'stop talking, what is this bundle?' })).toHaveCount(1);
  await expect.poll(async () => chats).toBeGreaterThan(2);
});

test('et spørsmål talt mens assistenten er opptatt, stilles når turen er ferdig', async ({ page }) => {
  await page.addInitScript(installMicStubs);
  await page.goto(`${explorer}?depth=all`);
  await expect(page.locator('#spinner')).toBeHidden();
  await page.keyboard.press('Escape');

  await page.route('**/v1/models', route => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ data: [{ id: 'voxtral-mini-transcribe-realtime-2602', capabilities: { audio_transcription_realtime: true } }] }) }));
  await page.route('**/client/sessions', route => route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ client_secret: { value: 'rt_1' } }) }));

  // Configure the chat and the audio input provider; the microphone needs a realtime model.
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    document.getElementById('asProvider').click(); document.querySelector('#asProvList [data-kind="llamacpp"]').click(); document.getElementById('asProvSave').click();
    const s = document.getElementById('asStream'); s.checked = false; s.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => document.getElementById('asInputOpen').click());
  await page.evaluate(() => document.querySelector('#asModelList .as-model-row').click());
  await expect.poll(async () => page.evaluate(() => document.getElementById('asInputModel').value)).toBe('voxtral-mini-transcribe-realtime-2602');
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());

  // The first reply is slow, so the assistant stays busy while the user speaks.
  const bodies = [];
  await page.route('**/v1/chat/completions', async route => {
    bodies.push(route.request().postDataJSON());
    if (bodies.length === 1) await new Promise(r => setTimeout(r, 3500));
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'It is thorough.' } }] }) });
  });

  await page.evaluate(() => document.getElementById('asMicToggle').click());
  await expect(page.locator('#asMicToggle')).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(700);   // calibrate the quiet room

  // Ask by typing; the slow reply keeps the assistant busy (the stop button shows a live turn).
  await page.evaluate(() => { document.getElementById('asInput').value = 'What is this?'; document.getElementById('asSend').click(); });
  await expect(page.locator('#asStop')).toBeVisible();
  await expect.poll(async () => bodies.length).toBe(1);

  // The user speaks while the assistant is busy: a listening bubble opens — this used to be blocked.
  await page.evaluate(() => { window.__micLevel = 0.3; });
  await expect(page.locator('#asLog .as-msg.user.listening')).toHaveCount(1);
  await expect(page.locator('#asStop')).toBeVisible();   // still mid-turn when the speech began
  await page.waitForTimeout(350);   // the utterance clears the minimum speech length

  // Falling quiet ends the utterance; the question is held until the busy turn ends, then asked.
  await page.evaluate(() => { window.__micLevel = 0; });
  await expect(page.locator('#asLog .as-msg.user', { hasText: 'What is the state of security in okfy?' })).toHaveCount(1);
  await expect.poll(async () => bodies.length).toBeGreaterThanOrEqual(2);
  // The held question is asked as its own turn: the request ends with it, after the earlier reply.
  const last = bodies[bodies.length - 1].messages;
  expect(last[last.length - 1]).toEqual({ role: 'user', content: 'What is the state of security in okfy?' });
  expect(last[last.length - 2]).toEqual({ role: 'assistant', content: 'It is thorough.' });
});

test('en brukerboble som åpnes mens assistenten snakker bryter ikke verktøykallet', async ({ page }) => {
  await page.addInitScript(installDuplexStubs);
  await page.goto(`${explorer}?depth=all`);
  await expect(page.locator('#spinner')).toBeHidden();
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    document.getElementById('asProvider').click(); document.querySelector('#asProvList [data-kind="llamacpp"]').click(); document.getElementById('asProvSave').click();
    const m = document.getElementById('asAudioModel'); m.value = 'tts'; m.dispatchEvent(new Event('change'));
    const v = document.getElementById('asAudioVoice'); v.value = 'v1'; v.dispatchEvent(new Event('change'));
    const im = document.getElementById('asInputModel'); im.value = 'voxtral-mini-transcribe-realtime-2602'; im.dispatchEvent(new Event('change'));
    const s = document.getElementById('asStream'); s.checked = false; s.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());

  await page.route('**/audio/voices**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ id: 'v1', languages: ['en'] }], total: 1, page_size: 100, total_pages: 1 }) }));
  await page.route('**/client/sessions', route => route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ client_secret: { value: 'rt_1' } }) }));
  let releaseSpeech;
  const speechGate = new Promise(resolve => { releaseSpeech = resolve; });
  await page.route('**/audio/speech', async route => {
    await speechGate;   // hold the speech fetch open so the microphone can interject
    route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.from([0, 1, 2, 3]) });
  });
  const bodies = [];
  await page.route('**/v1/chat/completions', route => {
    const body = route.request().postDataJSON();
    bodies.push(body);
    const message = bodies.length === 1
      ? { role: 'assistant', content: '', tool_calls: [{ id: 's1', type: 'function', function: { name: 'speak', arguments: JSON.stringify({ text: 'Here is the answer.' }) } }] }
      : { role: 'assistant', content: 'Done.' };
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message }] }) });
  });

  await page.evaluate(() => document.getElementById('asSpeakToggle').click());
  await expect(page.locator('#asSpeakToggle')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => document.getElementById('asMicToggle').click());
  await expect(page.locator('#asMicToggle')).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(700);   // calibrate the quiet room

  // Ask; the reply calls `speak`, whose audio fetch is held open while the user speaks.
  await page.evaluate(() => { document.getElementById('asInput').value = 'What is this?'; document.getElementById('asSend').click(); });
  await expect.poll(async () => bodies.length).toBe(1);
  await page.evaluate(() => { window.__micLevel = 0.5; });
  await expect(page.locator('#asLog .as-msg.user.listening')).toHaveCount(1);
  releaseSpeech();

  // The next request answers the tool call right next to it: the mid-turn bubble is not between.
  await expect.poll(async () => bodies.length).toBeGreaterThanOrEqual(2);
  const msgs = bodies[1].messages;
  const callAt = msgs.findIndex(m => m.role === 'assistant' && m.tool_calls && m.tool_calls.length);
  expect(callAt).toBeGreaterThanOrEqual(0);
  expect(msgs[callAt + 1]).toMatchObject({ role: 'tool', tool_call_id: 's1' });
});

test('innstillingene viser bare navngitte inndataenheter og ber om mikrofonen ellers', async ({ page }) => {
  await page.addInitScript(installMicStubs);
  await page.goto(`${explorer}?depth=all`);
  await expect(page.locator('#spinner')).toBeHidden();
  await page.keyboard.press('Escape');

  // Before the browser has granted the microphone the host reports an anonymous placeholder
  // input, not a real, selectable device. The named list is restored once capture starts.
  await page.evaluate(() => {
    const md = navigator.mediaDevices;
    const named = md.enumerateDevices.bind(md);
    md.enumerateDevices = async () => [{ kind: 'audioinput', deviceId: '', label: '' }];
    window.__useNamedDevices = () => { md.enumerateDevices = named; };
  });

  await page.route('**/client/sessions', route => route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ client_secret: { value: 'rt_1' } }) }));

  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    document.getElementById('asProvider').click(); document.querySelector('#asProvList [data-kind="llamacpp"]').click(); document.getElementById('asProvSave').click();
    const im = document.getElementById('asInputModel'); im.value = 'voxtral-mini-transcribe-realtime-2602'; im.dispatchEvent(new Event('change'));
    const s = document.getElementById('asStream'); s.checked = false; s.dispatchEvent(new Event('change'));
  });

  // The anonymous placeholder is not listed: only the system default, with a notice asking for
  // the microphone.
  await expect.poll(async () => page.evaluate(() => document.getElementById('asInputDevice').options.length)).toBe(1);
  await expect(page.locator('#asInputDevice')).toContainText('System default');
  await expect(page.locator('#asInputDeviceNotice')).toBeVisible();

  // Turning the microphone on grants permission: the names resolve and the notice goes away.
  await page.evaluate(() => { window.__useNamedDevices(); document.getElementById('asMicToggle').click(); });
  await expect(page.locator('#asMicToggle')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => page.evaluate(() => document.getElementById('asInputDevice').options.length)).toBe(3);
  await expect(page.locator('#asInputDeviceNotice')).toBeHidden();
  await expect(page.locator('#asInputDevice')).toContainText('USB microphone');
});

test('inndataenhetsvarselet kan lukkes med krysset', async ({ page }) => {
  await page.addInitScript(installMicStubs);
  await page.goto(`${explorer}?depth=all`);
  await expect(page.locator('#spinner')).toBeHidden();
  await page.keyboard.press('Escape');
  // The host reports only an anonymous placeholder before permission, so the note is shown.
  await page.evaluate(() => { navigator.mediaDevices.enumerateDevices = async () => [{ kind: 'audioinput', deviceId: '', label: '' }]; });
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await expect(page.locator('#asInputDeviceNotice')).toBeVisible();
  await page.evaluate(() => document.getElementById('asInputDeviceNoticeClose').click());
  await expect(page.locator('#asInputDeviceNotice')).toBeHidden();
  // Closing and reopening Settings keeps it dismissed for the session.
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await expect(page.locator('#asInputDeviceNotice')).toBeHidden();
});
