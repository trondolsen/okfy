---
type: Workflow
title: Run the test suite
description: How to run the Node and Playwright tests that cover the tool.
tags: [workflow, testing, playwright, how-to]
okfx:
  mode: how-to
  version: praxis/1
sources:
  - id: tests
    resource: ../../test/README.md
    title: Test documentation for okfy
  - id: review
    resource: ../reviews/2026-10-05.md
    title: Security review of okfy (2026-10-05)
---

# Goal

Run the checks that cover the tool's security helpers, its local server and its browser behaviour.[^tests]

# Steps

Run from the repository root. The Node tests need no npm install:

```sh
bash tools/node-cli/run.sh --workdir . -- \
  --test test/unit/security.test.cjs \
  test/unit/serve.test.mjs
```

The browser tests use Playwright in a container:

```sh
bash tools/playwright-cli/run.sh --workdir . -- \
  node_modules/@playwright/test/cli.js \
  test --config test/playwright.config.cjs
```

# What is covered

- **Node tests** exercise the security helpers from the real HTML file, and the local server's GET and HEAD responses, content types, missing files, traversal and symlinks.
- **Browser tests** cover loading, counts, search, filters, labels, tag nodes, Markdown preview, history, directory navigation, depth-limited loading, missing bundles, foreign-origin rejection and mobile layout. One smoke test loads the project's own knowledge index.

# Result

The security review records **59 passing regression tests** from a user-supplied TAP run.[^review]

# Connections

- [Untrusted bundles](../principles/untrusted-bundles.md)
- [Source map](source-map.md)

[^tests]: Test documentation, "Run the tests" and "Scope and stability".
[^review]: Security review, "Verification".
