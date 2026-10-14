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

// A minimal 16-bit PCM WAV, long enough to read a duration from and to scrub across.
function wavBytes(seconds = 2, rate = 16000, hz = 440) {
  const n = Math.round(seconds * rate);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(2 * Math.PI * hz * i / rate) * 12000), 44 + i * 2);
  return b;
}

async function openBundle(page) {
  await installLabelHook(page);
  await page.goto(`${explorer}?depth=all`);
  await expect(page.locator('#overlay')).not.toHaveClass(/\bshow\b/);
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
  await page.evaluate(() => { const v = document.getElementById('pvVideo'); v.currentTime = 1.5; v.dispatchEvent(new Event('timeupdate')); });
  await expect(page.locator('#pvCue')).toHaveText('Verden');
});

test('en lokal lydfil strømmes fra en objekt-URL, også over filgrensen', async ({ page }) => {
  // A local clip is not read whole: it streams from an object URL the browser reads on demand,
  // so its size does not matter. This one is well over the served-clip cap (32 MiB).
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
