// Media previews for audio and video file nodes. Audio is decoded into the Web Audio graph, so
// it plays through the same mel spectrogram the speech bubbles use and its seek bar scrubs by
// scheduling overlapping grains; video plays in a media element. The clip bytes are served by the
// test, so the fixture needs no binary files on disk.
const { test, expect } = require('@playwright/test');
const { fixtureExplorer } = require('../support/paths.cjs');

// The media fixture is served as the root of a generated folder (support/prepare-roots.mjs).
const explorer = fixtureExplorer('media');

// Read the drawn node labels off the canvas, so a node can be clicked by its label.
async function installLabelHook(page) {
  await page.addInitScript(() => {
    window.graphLabels = Object.create(null);
    const prototype = CanvasRenderingContext2D.prototype;
    const clearRect = prototype.clearRect, arc = prototype.arc, fillText = prototype.fillText;
    let point;
    prototype.clearRect = function (...args) { if (this.canvas.id === 'c') window.graphLabels = Object.create(null); return clearRect.apply(this, args); };
    prototype.arc = function (x, y, ...args) { if (this.canvas.id === 'c') point = { x, y }; return arc.call(this, x, y, ...args); };
    prototype.fillText = function (text, ...args) {
      if (this.canvas.id === 'c' && point) window.graphLabels[text] = { ...point, alpha: this.globalAlpha };
      return fillText.call(this, text, ...args);
    };
  });
}

// A 16-bit PCM WAV: its header, then its samples. Pass hz 0 for silence, which leaves the samples at
// zero, so a long clip can be built without a per-sample loop (and a decoder reads it as silence).
function wavBytes(seconds = 2, rate = 16000, hz = 440) {
  const n = Math.round(seconds * rate);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n && hz; i++) b.writeInt16LE(Math.round(Math.sin(2 * Math.PI * hz * i / rate) * 12000), 44 + i * 2);
  return b;
}

async function openBundle(page) {
  await installLabelHook(page);
  await page.goto(`${explorer}?depth=all`);
  await expect(page.locator('#spinner')).toBeHidden();
  await expect(page.locator('#stats')).toContainText('files');
  await page.keyboard.press('Escape');
}

// Click a node by its drawn label, retrying while the layout is still settling.
async function openNode(page, label) {
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(400);
    const point = await page.evaluate(l => window.graphLabels[l], label);
    if (!point) continue;
    const canvas = await page.locator('#c').boundingBox();
    await page.mouse.click(canvas.x + point.x, canvas.y + point.y);
    const title = await page.evaluate(() => (document.getElementById('pvTitle') || {}).textContent);
    if (title === label) return true;
  }
  return false;
}

// A folder with no Markdown makes a tiny, tall graph, which the viewer frames to the full height;
// the toolbar then overlays its top node. Zoom out a little so every node is clear of the toolbar
// before clicking one.
async function zoomOut(page) {
  const canvas = await page.locator('#c').boundingBox();
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(400);
}

// A served clip is read whole under the byte limit, so a bigger one has no player at all. The
// preview says why, with the numbers and the way out, rather than looking like a broken player. The
// bound is far larger than a test can hand over the wire, so the clip's size is declared in the
// response headers: the read is refused on the declared length, before any body is read.
test('en servert mediefil over grensen sier hvorfor den ikke kan spilles', async ({ page }) => {
  await page.route('**/media/tone.wav', route => route.fulfill({
    status: 200, contentType: 'audio/wav',
    headers: { 'content-length': String(260 * 1024 * 1024) },
    body: Buffer.alloc(64)
  }));
  await openBundle(page);
  expect(await openNode(page, 'tone.wav')).toBe(true);

  // The note names the size, the limit it is read under and the way to play it; the file details
  // show the size the note was built from.
  await expect(page.locator('#pvMediaNote')).toContainText('over the 256 MB limit');
  await expect(page.locator('#pvMediaNote')).toContainText('locally');
  await expect(page.locator('#pvFile')).toContainText('260 MB');
  // Nothing plays: the player never becomes ready.
  await expect(page.locator('#pvPlay')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#pvTime')).toHaveText('0:00 / 0:00');
});

// A served clip past the decode bound is still read — bounded by its own, far larger, cap — but not
// decoded: it plays from a blob URL of its bytes, so a long clip is never expanded into samples.
test('en stor servert lydfil spilles fra en blob uten å dekodes', async ({ page }) => {
  const clip = wavBytes(1400, 16000, 0);   // ~43 MiB and 23 minutes: over the decode bound only
  expect(clip.length).toBeGreaterThan(32 * 1024 * 1024);
  expect(clip.length).toBeLessThan(256 * 1024 * 1024);
  await page.route('**/media/tone.wav', route => route.fulfill({ status: 200, contentType: 'audio/wav', body: clip }));
  await openBundle(page);
  expect(await openNode(page, 'tone.wav')).toBe(true);

  // It takes the streamed path — the media element, fed from a blob of the clip's own bytes.
  await expect(page.locator('#pvAudioEl')).toHaveAttribute('src', /^blob:/);
  await expect(page.locator('#pvMediaNote')).toHaveCount(0, { timeout: 20000 });
  await expect(page.locator('#pvTime')).toHaveText('0:00 / 23:20');
  await expect(page.locator('#pvFile')).toContainText('43 MB');
  // And it plays through the shared analyser, so the spectrogram runs.
  await page.locator('#pvPlay').click();
  await expect(page.locator('#pvPlay')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => Number(await page.inputValue('#pvSeek'))).toBeGreaterThan(0);
  await page.locator('#pvPlay').click();
});

test('lydfilen spilles av med spektrogram, og skrubbing skjuler korn', async ({ page }) => {
  await page.route('**/media/tone.wav', route => route.fulfill({ status: 200, contentType: 'audio/wav', body: wavBytes() }));
  await openBundle(page);
  expect(await openNode(page, 'tone.wav')).toBe(true);

  // The player carries the shared mel spectrogram, a play button and a seek bar.
  await expect(page.locator('#pvSpec')).toBeAttached();
  await expect(page.locator('#pvPlay')).toBeVisible();
  await expect(page.locator('#pvSeek')).toBeVisible();
  // The clip decodes and the "reading" note goes away; the duration is shown.
  await expect(page.locator('#pvMediaNote')).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator('#pvTime')).toHaveText('0:00 / 0:02');

  // Playing advances the playhead.
  await page.locator('#pvPlay').click();
  await expect(page.locator('#pvPlay')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => Number(await page.inputValue('#pvSeek'))).toBeGreaterThan(0);
  await page.locator('#pvPlay').click();
  await expect(page.locator('#pvPlay')).toHaveAttribute('aria-pressed', 'false');

  // Dragging the seek bar scrubs: on release the playhead sits where the pointer left it, and
  // playback starts there even though it was paused before the drag.
  const box = await page.locator('#pvSeek').boundingBox();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  const at = Number(await page.inputValue('#pvSeek'));
  expect(at).toBeGreaterThan(600);
  expect(at).toBeLessThan(900);
  // Releasing starts playback from where the drag left it.
  await expect(page.locator('#pvPlay')).toHaveAttribute('aria-pressed', 'true');
  // Closing the page stops the player rather than leaving it running behind it.
  await page.locator('#pvClose').click();
  await expect(page.locator('#preview')).not.toHaveClass(/\bshow\b/);
  await expect(page.locator('#pvPlay')).toHaveAttribute('aria-pressed', 'false');
});

test('videofilen spilles av i et medieelement', async ({ page }) => {
  await page.route('**/media/clip.mp4', route => route.fulfill({ status: 200, contentType: 'video/mp4', body: Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]) }));
  await openBundle(page);
  expect(await openNode(page, 'clip.mp4')).toBe(true);

  const video = page.locator('#pvVideo');
  await expect(video).toBeAttached();
  await expect(video).toHaveAttribute('controls', '');
  // The bytes are read, bounded, and played from a blob URL of the clip's own bytes.
  await expect.poll(async () => page.evaluate(() => document.getElementById('pvVideo').src)).toMatch(/^blob:http/);
  // The audio player's spectrogram is not part of the video preview.
  await expect(page.locator('#pvSpec')).toHaveCount(0);
});

test('en søsken-WebVTT vises som undertekst på lyden', async ({ page }) => {
  await page.route('**/media/tone.wav', route => route.fulfill({ status: 200, contentType: 'audio/wav', body: wavBytes() }));
  await page.route('**/media/tone.vtt', route => route.fulfill({
    status: 200, contentType: 'text/vtt',
    body: 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello\n\n00:00:01.000 --> 00:00:02.000\nWorld\n'
  }));
  await openBundle(page);
  expect(await openNode(page, 'tone.wav')).toBe(true);
  await expect(page.locator('#pvMediaNote')).toHaveCount(0, { timeout: 10000 });

  // The sibling .vtt is read on open; the caption follows the playhead, so seeking into each cue
  // shows its text.
  await page.evaluate(() => { const s = document.getElementById('pvSeek'); s.value = '250'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(page.locator('#pvCue')).toHaveText('Hello');
  await page.evaluate(() => { const s = document.getElementById('pvSeek'); s.value = '750'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(page.locator('#pvCue')).toHaveText('World');

  // The audio page's file details name the track the captions come from, once it has been read.
  await expect(page.locator('#pvFile')).toContainText('Captions');
  await expect(page.locator('#pvFile')).toContainText('tone.vtt');
  await expect(page.locator('#pvFile')).toContainText('2 cues');
});

test('en søsken-WebVTT vises som undertekst på videoen', async ({ page }) => {
  await page.route('**/media/clip.mp4', route => route.fulfill({ status: 200, contentType: 'video/mp4', body: Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]) }));
  await page.route('**/media/clip.vtt', route => route.fulfill({
    status: 200, contentType: 'text/vtt',
    body: 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHei\n\n00:00:01.000 --> 00:00:02.000\nVerden\n'
  }));
  await openBundle(page);
  expect(await openNode(page, 'clip.mp4')).toBe(true);

  // The sibling track shows over the video: the first cue at the start, the next when seeked into it.
  await expect(page.locator('#pvCue')).toHaveText('Hei');
  // The video page's file details name the track too.
  await expect(page.locator('#pvFile')).toContainText('Captions');
  await page.evaluate(() => { const v = document.getElementById('pvVideo'); v.currentTime = 1.5; v.dispatchEvent(new Event('timeupdate')); });
  await expect(page.locator('#pvCue')).toHaveText('Verden');
});

// A local clip is not read whole: it streams from an object URL the browser reads on demand, so its
// size does not matter. This one is well over the served-clip cap (32 MiB).
test('en lokal lydfil strømmes fra en objekt-URL, også over filgrensen', async ({ page }) => {
  await installLabelHook(page);
  await page.goto(explorer);
  // The viewer auto-loads a bundle from its own folder on startup; let that finish first, or its
  // load would replace the folder we drop.
  await expect(page.locator('#stats')).toContainText('files');
  await page.keyboard.press('Escape');
  const startup = await page.locator('#stats').textContent();
  await page.evaluate((bytes) => {
    const b = new Uint8Array(bytes), dv = new DataView(b.buffer), rate = 8000, n = (bytes - 44) / 2;
    const put = (o, s) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
    put(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); put(8, 'WAVE');
    put(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    put(36, 'data'); dv.setUint32(40, n * 2, true);
    const dt = new DataTransfer();
    dt.items.add(new File(['# Mediepakke\n\n- [Stor tone](tone.wav) – lokal lyd.\n'], 'index.md', { type: 'text/markdown' }));
    dt.items.add(new File([b], 'tone.wav', { type: 'audio/wav' }));
    dt.items.add(new File(['WEBVTT\n\n00:00:00.000 --> 00:10:00.000\nLokal undertekst\n'], 'tone.vtt', { type: 'text/vtt' }));
    window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, 35200044);
  // The dropped folder replaces the startup bundle.
  await expect(page.locator('#stats')).not.toHaveText(startup);
  await page.keyboard.press('Escape');
  expect(await openNode(page, 'tone.wav')).toBe(true);

  // It plays from an object URL, loads on demand, and reports its size — no whole-file read.
  await expect(page.locator('#pvAudioEl')).toBeAttached();
  await expect(page.locator('#pvAudioEl')).toHaveAttribute('src', /^blob:/);
  await expect(page.locator('#pvMediaNote')).toHaveCount(0, { timeout: 15000 });
  await expect(page.locator('#pvTime')).toHaveText('0:00 / 36:40');
  await expect(page.locator('#pvFile')).toContainText('34 MB');

  // Playing streams the clip through the shared analyser, so the spectrogram runs.
  await page.locator('#pvPlay').click();
  await expect(page.locator('#pvPlay')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => Number(await page.inputValue('#pvSeek'))).toBeGreaterThan(0);
  await page.locator('#pvPlay').click();
  await expect(page.locator('#pvPlay')).toHaveAttribute('aria-pressed', 'false');

  // Its sibling .vtt is found in the folder and its cue shows.
  await page.evaluate(() => { const s = document.getElementById('pvSeek'); s.value = '1'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(page.locator('#pvCue')).toHaveText('Lokal undertekst');

  // Dragging the seek bar on a streamed clip plays it (so the scrub is audible, not a silent
  // seek), and releasing resumes normal playback.
  await expect(page.locator('#pvPlay')).toHaveAttribute('aria-pressed', 'false');
  const box = await page.locator('#pvSeek').boundingBox();
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 6 });
  expect(await page.evaluate(() => !document.getElementById('pvAudioEl').paused)).toBe(true);
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  // Releasing resumes playback, and closing the page stops the streamed player.
  await expect(page.locator('#pvPlay')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#pvClose').click();
  await expect(page.locator('#preview')).not.toHaveClass(/\bshow\b/);
  expect(await page.evaluate(() => document.getElementById('pvAudioEl').paused)).toBe(true);
});

test('en liten lokal lydfil dekodes og skrubbes med korn', async ({ page }) => {
  // Under the media cap a local clip is read whole and decoded, so it gets the same grain scrub as a
  // served clip (and its seek bar scrubs); only a larger local clip streams unread.
  await installLabelHook(page);
  await page.goto(explorer);
  await expect(page.locator('#stats')).toContainText('files');
  await page.keyboard.press('Escape');
  const startup = await page.locator('#stats').textContent();
  await page.evaluate((bytes) => {
    const b = new Uint8Array(bytes), dv = new DataView(b.buffer), rate = 8000, n = (bytes - 44) / 2;
    const put = (o, s) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
    put(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); put(8, 'WAVE');
    put(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    put(36, 'data'); dv.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * 440 * i / rate) * 12000), true);
    const dt = new DataTransfer();
    dt.items.add(new File(['# Mediepakke\n\n- [Tone](tone.wav) – lokal lyd.\n'], 'index.md', { type: 'text/markdown' }));
    dt.items.add(new File([b], 'tone.wav', { type: 'audio/wav' }));
    window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, 32044);
  await expect(page.locator('#stats')).not.toHaveText(startup);
  await page.keyboard.press('Escape');
  expect(await openNode(page, 'tone.wav')).toBe(true);

  // It decodes (so it plays through the analyser and its seek bar scrubs by grains) rather than
  // streaming: the hidden media element the streamed path uses is never given a source.
  await expect(page.locator('#pvMediaNote')).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator('#pvTime')).toHaveText('0:00 / 0:02');
  expect(await page.evaluate(() => document.getElementById('pvAudioEl').getAttribute('src'))).toBe(null);
  await page.locator('#pvPlay').click();
  await expect(page.locator('#pvPlay')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => Number(await page.inputValue('#pvSeek'))).toBeGreaterThan(0);
  await page.locator('#pvPlay').click();
  await expect(page.locator('#pvPlay')).toHaveAttribute('aria-pressed', 'false');
});

// The tool results the assistant sends back to the provider, as the mocked server sees them.
function toolResult(body, name) {
  const messages = (body && body.messages) || [];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'tool' && messages[i].name === name) return JSON.parse(messages[i].content);
  }
  return null;
}

// The assistant's file and media tools, driven through the real viewer: the provider is mocked, so
// the page itself runs the tool calls (open an unloaded file, read it with its caption track, and
// drive the player).
test('assistenten åpner, leser og styrer mediefilen', async ({ page }) => {
  await page.route('**/media/tone.wav', route => route.fulfill({ status: 200, contentType: 'audio/wav', body: wavBytes(10) }));
  await page.route('**/media/tone.vtt', route => route.fulfill({
    status: 200, contentType: 'text/vtt',
    body: 'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHei\n\n00:00:05.000 --> 00:00:10.000\nVerden\n'
  }));
  // The assistant's settings are gated behind the acknowledgement of what enabling a model means.
  await page.addInitScript(() => { try { localStorage.setItem('okfy.assistant.ack', '1'); } catch (e) {} });
  // Count the seek bar's own writes, so a stepped scrub is told apart from a silent jump.
  await page.addInitScript(() => {
    window.pvSeekWrites = 0;
    const watch = () => new MutationObserver(records => {
      for (const record of records) if (record.target && record.target.id === 'pvSeek') window.pvSeekWrites++;
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['style'] });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
  });
  await openBundle(page);
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    document.getElementById('asProvider').click(); document.querySelector('#asProvList [data-kind="llamacpp"]').click(); document.getElementById('asProvSave').click();
    const s = document.getElementById('asStream'); s.checked = false; s.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());

  let turn = 0, releaseScrub;
  const scrubGate = new Promise(resolve => { releaseScrub = resolve; });
  const requests = [];
  const call = (id, name, args) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } });
  await page.route('**/v1/chat/completions', async route => {
    turn++;
    requests.push(JSON.parse(route.request().postData() || '{}'));
    let message;
    if (turn === 1) message = { role: 'assistant', content: '', tool_calls: [
      call('c1', 'open_concept', { path: 'tone.wav' }),
      call('c2', 'read_file', { path: 'tone.wav' })
    ] };
    else if (turn === 2) message = { role: 'assistant', content: '', tool_calls: [call('c3', 'viewer_media', { action: 'read' })] };
    else if (turn === 3) {
      await scrubGate;   // wait until the clip has decoded, so the scrub has something to read
      message = { role: 'assistant', content: '', tool_calls: [call('c4', 'viewer_media', { action: 'scrub', position: '6' })] };
    } else if (turn === 4) message = { role: 'assistant', content: '', tool_calls: [call('c5', 'viewer_media', { action: 'play' })] };
    else if (turn === 5) message = { role: 'assistant', content: '', tool_calls: [call('c6', 'viewer_media', { action: 'pause' })] };
    else message = { role: 'assistant', content: 'Spilt av.' };
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message }] }) });
  });

  await page.evaluate(() => { document.getElementById('asInput').value = 'Spill av lyden'; document.getElementById('asSend').click(); });

  // open_concept read the unloaded clip and opened it; the player decodes it.
  await expect(page.locator('#pvPath')).toHaveText('tone.wav');
  await expect(page.locator('#pvMediaNote')).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator('#pvTime')).toHaveText('0:00 / 0:10');
  // read_file reported the clip and the subtitle track beside it, which the page then showed too.
  await expect.poll(async () => (toolResult(requests[1], 'read_file') || {}).media).toBe('audio');
  const read = toolResult(requests[1], 'read_file');
  expect(read.associated[0].path).toBe('tone.vtt');
  await expect(page.locator('#pvFile')).toContainText('tone.vtt');

  // The scrub moves the head through the seek bar, drawing it a step at a time rather than jumping.
  const before = await page.evaluate(() => window.pvSeekWrites);
  releaseScrub();
  await expect.poll(async () => Number(await page.inputValue('#pvSeek'))).toBeGreaterThan(590);
  expect(await page.evaluate(() => window.pvSeekWrites) - before).toBeGreaterThan(8);
  await expect.poll(async () => toolResult(requests[3], 'viewer_media')).toMatchObject({ scrubbedTo: 6 });

  // Play and pause press the player's own control.
  await expect.poll(async () => toolResult(requests[4], 'viewer_media')).toMatchObject({ playing: true });
  await expect.poll(async () => toolResult(requests[5], 'viewer_media')).toMatchObject({ playing: false });
});

// A served clip over the byte limit has no player at all, and the assistant is told why rather than
// finding a player that never starts (its media tool reports the player's own failure).
test('assistenten får beskjed når en servert mediefil ikke kan spilles', async ({ page }) => {
  await page.route('**/media/clip.mp4', route => route.fulfill({
    status: 200, contentType: 'video/mp4',
    headers: { 'content-length': String(260 * 1024 * 1024) },
    body: Buffer.alloc(64)
  }));
  await page.addInitScript(() => { try { localStorage.setItem('okfy.assistant.ack', '1'); } catch (e) {} });
  await openBundle(page);
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());
  await page.evaluate(() => {
    document.getElementById('asProvider').click(); document.querySelector('#asProvList [data-kind="llamacpp"]').click(); document.getElementById('asProvSave').click();
    const s = document.getElementById('asStream'); s.checked = false; s.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => document.getElementById('asSettingsBtn').click());

  let turn = 0, releaseRead;
  const noteSeen = new Promise(resolve => { releaseRead = resolve; });
  const requests = [];
  await page.route('**/v1/chat/completions', async route => {
    turn++;
    requests.push(JSON.parse(route.request().postData() || '{}'));
    let message;
    if (turn === 1) message = { role: 'assistant', content: '', tool_calls: [
      { id: 'c1', type: 'function', function: { name: 'open_concept', arguments: JSON.stringify({ path: 'clip.mp4' }) } }
    ] };
    else if (turn === 2) {
      await noteSeen;   // wait until the preview has said why it cannot play the clip
      message = { role: 'assistant', content: '', tool_calls: [
        { id: 'c2', type: 'function', function: { name: 'viewer_media', arguments: JSON.stringify({ action: 'read' }) } }
      ] };
    } else message = { role: 'assistant', content: 'Greit.' };
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message }] }) });
  });

  await page.evaluate(() => { document.getElementById('asInput').value = 'spill klippet'; document.getElementById('asSend').click(); });
  await expect(page.locator('#pvPath')).toHaveText('clip.mp4');
  await expect(page.locator('#pvMediaNote')).toContainText('over the 256 MB limit');
  releaseRead();
  // The tool reports the same reason, so the model can say it rather than offering a dead player.
  // (Each request carries the replies to the previous round, so this one arrives in the third.)
  await expect.poll(async () => ((toolResult(requests[2], 'viewer_media') || {}).error || '')).toContain('256 MB');
  await expect.poll(async () => ((toolResult(requests[2], 'viewer_media') || {}).error || '')).toContain('locally');
});

// A locally opened folder with no Markdown at all: nothing references the media file, so both it and
// its sibling track must still be listed as nodes. Otherwise the folder builds an empty graph and
// neither the clip nor its captions can be reached.
test('en lokal mappe uten Markdown viser mediefilen og søsken-WebVTT', async ({ page }) => {
  await installLabelHook(page);
  await page.goto(explorer);
  // The viewer auto-loads a bundle from its own folder on startup; let that finish first, or its
  // load would replace the folder we drop.
  await expect(page.locator('#stats')).toContainText('files');
  await page.keyboard.press('Escape');
  const startup = await page.locator('#stats').textContent();
  await page.evaluate((base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'tone.wav', { type: 'audio/wav' }));
    dt.items.add(new File(['WEBVTT\n\n00:00:00.000 --> 00:10:00.000\nUten Markdown\n'], 'tone.vtt', { type: 'text/vtt' }));
    window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, wavBytes().toString('base64'));
  await expect(page.locator('#stats')).not.toHaveText(startup);
  await page.keyboard.press('Escape');
  await zoomOut(page);

  // The clip opens and its sibling track shows as a caption.
  expect(await openNode(page, 'tone.wav')).toBe(true);
  await expect(page.locator('#pvMediaNote')).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator('#pvCue')).toHaveText('Uten Markdown');
  // The file details name the track beside it, from the folder itself and then once it is read.
  await expect(page.locator('#pvFile')).toContainText('Captions');
  await expect(page.locator('#pvFile')).toContainText('tone.vtt');
  await expect(page.locator('#pvFile')).toContainText('1 cue');

  // The track is itself a file node, and it opens as a transcript: the cues rendered like a page,
  // not the raw WebVTT file.
  await page.keyboard.press('Escape');
  expect(await openNode(page, 'tone.vtt')).toBe(true);
  await expect(page.locator('#pvBody')).toContainText('Uten Markdown');
  await expect(page.locator('#pvBody')).toContainText('0:00');
  await expect(page.locator('#pvBody pre')).toHaveCount(0);
});

test('en WebVTT større enn filgrensen blir likevel funnet som undertekst', async ({ page }) => {
  await installLabelHook(page);
  await page.goto(explorer);
  await expect(page.locator('#stats')).toContainText('files');
  await page.keyboard.press('Escape');
  const startup = await page.locator('#stats').textContent();
  // Over the viewer's single-file cap (512 KiB): a track is only ever read as a bounded prefix, so
  // its size must not keep it out of the folder listing. The bulk is comments, so the one real cue
  // stays whole inside the prefix.
  const track = 'WEBVTT\n\n00:00:00.000 --> 00:10:00.000\nStor undertekst\n' + `\nNOTE ${'x'.repeat(2000)}\n`.repeat(300);
  expect(track.length).toBeGreaterThan(512 * 1024);
  await page.evaluate(({ base64, track }) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'tone.wav', { type: 'audio/wav' }));
    dt.items.add(new File([track], 'tone.vtt', { type: 'text/vtt' }));
    window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, { base64: wavBytes().toString('base64'), track });
  await expect(page.locator('#stats')).not.toHaveText(startup);
  await page.keyboard.press('Escape');
  await zoomOut(page);

  expect(await openNode(page, 'tone.wav')).toBe(true);
  await expect(page.locator('#pvMediaNote')).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator('#pvCue')).toHaveText('Stor undertekst');
});

// One volume, shared by the audio and the video preview and remembered for the next clip, behind a
// speaker button that sits next to the transport control and opens a vertical slider. The
// assistant's speech bubbles have their own output and get no such control.
test('volumet justeres på lyd og video og huskes til neste mediefil', async ({ page }) => {
  await page.route('**/media/tone.wav', route => route.fulfill({ status: 200, contentType: 'audio/wav', body: wavBytes() }));
  await page.route('**/media/clip.mp4', route => route.fulfill({ status: 200, contentType: 'video/mp4', body: Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]) }));
  await openBundle(page);

  // The audio player's volume button sits to the left of the play button, and its slider is a popup.
  expect(await openNode(page, 'tone.wav')).toBe(true);
  const play = await page.locator('#pvPlay').boundingBox();
  const button = await page.locator('#pvVolBtn').boundingBox();
  expect(button.x + button.width).toBeLessThanOrEqual(play.x);
  await expect(page.locator('#pvVolPop')).toBeHidden();
  // It belongs to the preview player, not to the chat bubbles.
  await expect(page.locator('#assistant input[type="range"]')).toHaveCount(0);

  // Opening it shows a vertical slider at full volume.
  await page.locator('#pvVolBtn').click();
  await expect(page.locator('#pvVolPop')).toBeVisible();
  await expect(page.locator('#pvVolBtn')).toHaveAttribute('aria-expanded', 'true');
  const range = await page.locator('#pvVol').boundingBox();
  expect(range.height).toBeGreaterThan(range.width);
  await expect(page.locator('#pvVol')).toHaveValue('100');
  // A click outside the popup closes it again.
  await page.locator('#pvSpec').click();
  await expect(page.locator('#pvVolPop')).toBeHidden();

  // Lowering it is remembered, in the player and for the next clip.
  await page.locator('#pvVolBtn').click();
  await page.evaluate(() => { const s = document.getElementById('pvVol'); s.value = '30'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(page.locator('#pvVol')).toHaveValue('30');
  expect(await page.evaluate(() => localStorage.getItem('okfy.volume'))).toBe('0.3');

  // The video player's control sits over the clip's lower-left, and starts at the remembered level.
  await page.keyboard.press('Escape');
  expect(await openNode(page, 'clip.mp4')).toBe(true);
  const video = await page.locator('.pv-mediawrap').boundingBox();
  const videoButton = await page.locator('#pvVolBtn').boundingBox();
  expect(videoButton.x).toBeLessThan(video.x + video.width / 2);
  await page.locator('#pvVolBtn').click();
  await expect(page.locator('#pvVolPop')).toBeVisible();
  await expect(page.locator('#pvVol')).toHaveValue('30');
  await expect.poll(async () => page.evaluate(() => document.getElementById('pvVideo').volume)).toBeCloseTo(0.3, 2);

  // The video's own native control stays in step, and its level is what carries over.
  await page.evaluate(() => { document.getElementById('pvVideo').volume = 0.8; });
  await expect(page.locator('#pvVol')).toHaveValue('80');
  expect(await page.evaluate(() => localStorage.getItem('okfy.volume'))).toBe('0.8');

  // The remembered volume survives a reload.
  await page.reload();
  await expect(page.locator('#stats')).toContainText('files');
  await page.keyboard.press('Escape');
  expect(await openNode(page, 'clip.mp4')).toBe(true);
  await page.locator('#pvVolBtn').click();
  await expect(page.locator('#pvVol')).toHaveValue('80');
  await expect.poll(async () => page.evaluate(() => document.getElementById('pvVideo').volume)).toBeCloseTo(0.8, 2);
});

// The node tooltip names the node's kind. A non-Markdown file or attachment must read its kind, not
// the concept-type fallback (regression: such nodes were shown as "Concept" on hover).
test('verktøytipset navngir filtypen for et vedlegg, ikke Concept', async ({ page }) => {
  await openBundle(page);
  let text = '';
  for (let i = 0; i < 8 && !/Attachment/.test(text); i++) {
    await page.waitForTimeout(400);
    const point = await page.evaluate(() => window.graphLabels['tone.wav']);
    if (!point) continue;
    const canvas = await page.locator('#c').boundingBox();
    await page.mouse.move(canvas.x + point.x, canvas.y + point.y);
    text = await page.locator('#tip').textContent();
  }
  expect(text).toContain('Attachment');
  expect(text).not.toContain('Concept');
});
