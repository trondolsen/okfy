const { defineConfig } = require('@playwright/test');
const path = require('node:path');

const { suiteRoot, artifactsRoot, baseURL, explorerUrl } = require('./support/paths.cjs');

module.exports = defineConfig({
  testDir: path.join(suiteRoot, 'e2e'),
  testMatch: '**/*.spec.cjs',
  // Build the served bundle roots (fixture + okfy.html) before any test runs.
  globalSetup: path.join(suiteRoot, 'support/prepare-roots.mjs'),
  workers: 1,
  retries: 0,
  timeout: 30_000,
  forbidOnly: Boolean(process.env.CI),
  outputDir: path.join(artifactsRoot, 'test-results'),
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(artifactsRoot, 'report'), open: 'never' }],
  ],
  use: {
    browserName: 'chromium',
    baseURL,
    headless: true,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node support/serve.mjs',
    cwd: suiteRoot,
    url: `${baseURL}${explorerUrl}`,
    reuseExistingServer: false,
    timeout: 10_000,
  },
});
