# Agent instructions

These instructions apply to everything in this repository.

## Project

- `okfy.html` is the entire tool: one dependency-free HTML file with inline CSS and JavaScript that renders an OKF bundle as an interactive graph in the browser. All processing is local; there is no server, build step or runtime dependency.
- `README.md` – usage, URL parameters and publishing.
- `index.md` and `docs/` – the project's OKF v0.2 knowledge bundle (English), written with the project extension OKF Praxis.
- `test/` – the test suite (Node unit tests and Playwright browser tests); `test/index.md` is its reserved OKF index.
- `docs/reviews/2026-10-05.md` – the security review, an OKF concept whose security focus is carried in its `tags`.

## Ground rules

- Write documentation and code comments in English.
- Keep the OKF documentation in sync with the code. After changing the tool — its behaviour, UI, configuration, limits or structure — update the matching `docs/` concept(s) in the same change, and keep their `sources` and links accurate. If no concept matches, add one or state in your summary why none applies.
- Keep the tool a single HTML file with no dependencies and no build step. Do not add a bundler, framework or runtime dependency unless asked, and match the existing style in `okfy.html`.
- Treat bundles as untrusted. Do not weaken the URL containment, CSP, size limits or bounded-streaming controls, for example to make a bundle behind credentials or redirects load. Those bundles are intentionally unsupported.
- Do not commit or create branches unless asked.

## Knowledge bundle (OKF)

- The bundle root is `index.md`; only it may have frontmatter, and only `okf_version: "0.2"`. Every nested `index.md` has no frontmatter. Concepts live under `docs/`.
- Every concept needs YAML frontmatter with a non-empty `type`, and should set `okfx.mode` and `okfx.version: praxis/1`.
- Use relative Markdown links. The explorer crawls relative links and does not support absolute `/` paths.
- Cite real sources with relative paths and footnotes. Never invent sources, timestamps or `verified` status, and do not claim verification you did not perform.
- Validate before finishing: the YAML parses, `type` is present, `okfx` is valid, internal links resolve, `sources` exist, and footnotes are balanced.

## Tests

Run from the repository root. Full setup and coverage are in `test/README.md`.

```sh
# Node unit tests (security helpers, the assistant and the local server)
bash tools/node-cli/run.sh --workdir . -- \
  --test test/unit/security.test.cjs \
  test/unit/assistant.test.cjs \
  test/unit/serve.test.mjs
```

```sh
# Browser tests (Playwright)
bash tools/playwright-cli/run.sh --workdir . -- \
  node_modules/@playwright/test/cli.js \
  test --config test/playwright.config.cjs
```

- The `tools/.../run.sh` helper scripts are referenced by the test docs but are not present in this repository; run these commands where those scripts are available.

## Tooling

- Prefer `grep` for searches.
- Validate YAML with `yq` and JSON with `jq`.
- Keep terminal commands short and focused so each is easy to review.
