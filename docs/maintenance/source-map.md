---
type: Reference
title: Source map
description: Which project files each part of this bundle is based on.
tags: [reference, provenance, sources]
okfx:
  mode: reference
  version: praxis/1
sources:
  - id: readme
    resource: ../../README.md
    title: okfy – README
  - id: source
    resource: ../../okfy.html
    title: okfy.html – the tool's source
  - id: review
    resource: ../reviews/2026-10-05.md
    title: Security review of okfy (2026-10-05)
  - id: tests
    resource: ../../test/README.md
    title: Test documentation for okfy
---

# Sources

| Source | Used for |
| --- | --- |
| [`README.md`](../../README.md) | Usage, URL parameters and local browsing |
| [`okfy.html`](../../okfy.html) | The implementation: config, crawling, graph, layout, rendering, the deck and security |
| [`2026-10-05.md`](../reviews/2026-10-05.md) | Security findings, limits and behavior changes |
| [`test/README.md`](../../test/README.md) | The test suite and how to run it |
| [`attachments/favicon.svg`](../design/attachments/favicon.svg) | The project's mascot and favicon, shown in the interface design concept |
| [`attachments/expansion-dial.svg`](../design/attachments/expansion-dial.svg) | The expansion dial illustration, shown in the interface design concept |
| [`favicons/`](../../favicons/) | The favicon and app assets the tool references: the SVG and ICO sources (embedded in the page), `apple-touch-icon`, and `site.webmanifest` with the app name, scope, icons and screenshot |
| [`okfy-sw.js`](../../okfy-sw.js) | The optional service worker that keeps the app shell available offline |
| [`okfy.png`](../../okfy.png) | The wide screenshot declared in the web app manifest |
| [`okfy-logo.svg`](../../okfy-logo.svg) | The okfy wordmark shown in the README (the toolbar's node mark) |

# Notes

The tool's source is a single HTML file, so the concepts name the functions they rely on rather than line numbers, and they survive edits. Where a claim comes from the implementation rather than from documentation, the concept cites the relevant function. The [Favicon](../design/favicon.md) concept is the exception: it records external web specifications and vendor documentation, cited in its `sources`, rather than project files. The [Assistant](../interface/assistant.md) and [Assistant data flow](../security/assistant-data-flow.md) concepts likewise cite external specifications — the Fetch and Streams standards, the Model Context Protocol, the AGENTS.md convention, the provider API documentation and the OAuth, JWT and Problem Details RFCs — alongside the tool source. All concepts are currently **unverified**, since no `verified` field is set.

# Connections

- [About this bundle](../about-this-bundle.md)

[^readme]: Project README.
[^source]: The tool's source file.
[^review]: Security review, revision 1 to 2-draft.
[^tests]: Test documentation.
