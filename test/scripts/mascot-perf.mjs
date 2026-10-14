// Measures the mascot animation's cost and verifies it only runs while its
// panel (bundle dialog or About) is visible.
//
// Run from the repository root:
//   bash tools/playwright-cli/run.sh --workdir . -- test/scripts/mascot-perf.mjs
import { chromium } from 'playwright';
import { once } from 'node:events';
import { createStaticServer } from '../support/serve.mjs';
import paths from '../support/paths.cjs';

const { repositoryRoot, explorerUrl, baseURL } = paths;
const url = `${baseURL}${explorerUrl}?depth=all`;
const server = createStaticServer(repositoryRoot);

// Wall-clock cost of advancing the fake clock by `ms`: with the clock mocked,
// each frame's callbacks run back to back, so the elapsed real time is the CPU
// time of that many animation frames.
async function runFor(page, ms) {
  const started = Date.now();
  await page.clock.runFor(ms);
  return Date.now() - started;
}

const failures = [];
function check(ok, message) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`);
  if (!ok) failures.push(message);
}

let browser;
try {
  server.listen(8080, '127.0.0.1');
  await once(server, 'listening');

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

  await page.clock.install({ time: new Date('2026-01-01T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T12:00:01Z'));

  // Count attribute/child mutations on the mascot SVGs: any change means the
  // animation wrote to the DOM this frame.
  await page.addInitScript(() => {
    window.mascotMutations = 0;
    const attach = () => {
      for (const svg of document.querySelectorAll('svg[data-mascot]')) {
        new MutationObserver(() => { window.mascotMutations++; })
          .observe(svg, { subtree: true, attributes: true, childList: true, characterData: true });
      }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
    else attach();
  });

  await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForFunction(
    () => !document.querySelector('#overlay').classList.contains('show'),
    undefined,
    { timeout: 30_000 }
  );

  const reset = () => page.evaluate(() => { window.mascotMutations = 0; });
  const mutations = () => page.evaluate(() => window.mascotMutations);

  // The viewer opens on the About panel and keeps it until the user interacts;
  // dismiss it so both panels start hidden.
  await page.keyboard.press('Escape');

  await page.clock.runFor(2000); // warm up the graph loop

  // 1) Both panels hidden: the mascot must stay completely idle, even across
  //    the 10 s release timer of the (now hidden) bundle dialog.
  await reset();
  const hiddenMs = await runFor(page, 12_000);
  const hiddenMut = await mutations();

  // 2) About open but still in the fixed hold: still idle.
  await page.locator('#titleBtn').click();
  await reset();
  const fixedMs = await runFor(page, 5_000);
  const fixedMut = await mutations();

  // 3) Cross the release and run the physics: the mascot animates.
  await reset();
  const activeMs = await runFor(page, 11_000);
  const activeMut = await mutations();

  // 4) Steady released state (About open the whole time, popover else identical
  //    to the fixed window): isolates the mascot's per-frame cost.
  await reset();
  const steadyMs = await runFor(page, 3_000);
  const steadyMut = await mutations();

  const perSecond = (ms, window) => (ms / window) * 1000;
  const report = {
    hidden: { window_ms: 12_000, wall_ms: hiddenMs, mutations: hiddenMut, ms_per_s: +perSecond(hiddenMs, 12_000).toFixed(1) },
    fixed: { window_ms: 5_000, wall_ms: fixedMs, mutations: fixedMut, ms_per_s: +perSecond(fixedMs, 5_000).toFixed(1) },
    active: { window_ms: 11_000, wall_ms: activeMs, mutations: activeMut, ms_per_s: +perSecond(activeMs, 11_000).toFixed(1) },
    steady: { window_ms: 3_000, wall_ms: steadyMs, mutations: steadyMut, ms_per_s: +perSecond(steadyMs, 3_000).toFixed(1) },
  };
  console.log('\nMascot performance report (fake clock, per 1000 ms of animation time):');
  console.log(JSON.stringify(report, null, 2));

  check(hiddenMut === 0, 'hidden mascots are not animated (0 DOM mutations over 12 s)');
  check(fixedMut === 0, 'a visible but un-released mascot stays still (0 mutations over 5 s)');
  check(activeMut > 0, 'a released mascot animates (DOM mutations > 0)');
  const idleRate = perSecond(hiddenMs, 12_000);
  const steadyRate = perSecond(steadyMs, 3_000);
  check(steadyRate <= idleRate * 2 + 5, `animating the mascot adds no drastic frame cost (${steadyRate.toFixed(1)} vs ${idleRate.toFixed(1)} ms/s)`);

  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log('\nAll checks passed.');
  }
} finally {
  try { await browser?.close(); } finally {
    if (server?.listening) {
      await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
    }
  }
}
