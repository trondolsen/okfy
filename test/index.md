# Tests for okfy

This directory holds the test suite for the explorer. It is a nested index in the project's OKF v0.2 bundle, so it carries no frontmatter of its own.

- [Test suite](README.md) – how to set up and run the Node and browser tests, and what they cover.
- [Basic fixture bundle](fixtures/basic/index.md) – a small OKF v0.2 bundle used as test input.

# Layout

- `unit/` – Node tests for the security helpers and the local server.
- `e2e/` – Playwright tests for the browser behaviour.
- `support/` – the local HTTP server and shared paths, URLs and the result folder.
- `scripts/` – the screenshot tool.
- `fixtures/` – version-controlled test data.
- `package.json`, `playwright.config.cjs` – the test scripts and the Playwright configuration.
