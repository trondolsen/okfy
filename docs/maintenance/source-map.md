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
| [`attachments/expansion-states.svg`](../design/attachments/expansion-states.svg) | The node expansion states illustration, shown in the interface design concept |
| [`attachments/panel-tabs.svg`](../design/attachments/panel-tabs.svg) | The panel docking and edge-tab illustration, shown in the interface design concept |
| [`attachments/filter-panel.svg`](../design/attachments/filter-panel.svg) | The filter panel illustration, shown in the interface design concept |
| [`attachments/controls.svg`](../design/attachments/controls.svg) | The control vocabulary illustration, shown in the interface design concept |
| [`attachments/icons.svg`](../design/attachments/icons.svg) | The mark vocabulary — drawn marks and type marks — illustration, shown in the interface design concept |
| [`attachments/hud.svg`](../design/attachments/hud.svg) | The heads-up bar — the floating toolbar layer and its groups — illustration, shown in the interface design concept |
| [`attachments/node-preview.svg`](../design/attachments/node-preview.svg) | The node preview — the page panel and its header, body and kinds — illustration, shown in the interface design concept |
| [`attachments/media-kinds.svg`](../design/attachments/media-kinds.svg) | The media file kinds — audio, video and their captions — illustration, shown in the interface design concept |
| [`attachments/assistant.svg`](../design/attachments/assistant.svg) | The assistant panel — its header, transcript, form and settings — illustration, shown in the interface design concept |
| [`attachments/full-page.svg`](../design/attachments/full-page.svg) | The full-page view — reading a deck of cards as one stream — illustration, shown in the interface design concept |
| [`attachments/deck.svg`](../design/attachments/deck.svg) | The deck of cards — the stacks, chips, card states, drag and menu — illustration, shown in the interface design concept |
| [`attachments/graph-interaction.svg`](../design/attachments/graph-interaction.svg) | The graph interaction — zoom, pan, hover, click and drag on the canvas — illustration, shown in the interface design concept |
| [`attachments/force-layout.svg`](../algorithms/attachments/force-layout.svg) | The force layout explainer — the forces, the quadtree, one Verlet step and cooling — shown in the force layout concept |
| [`attachments/graph-construction.svg`](../algorithms/attachments/graph-construction.svg) | The graph construction explainer — the kinds, the reference edges, the tag hubs and the pages — shown in the graph construction concept |
| [`attachments/markdown-preview.svg`](../algorithms/attachments/markdown-preview.svg) | The Markdown preview explainer — the pass, the inline tokens, the escaping and the budget — shown in the Markdown preview concept |
| [`attachments/crawling.svg`](../algorithms/attachments/crawling.svg) | The crawling explainer — the entry, the queue with its alternatives, the per-item steps and the bounds — shown in the crawling concept |
| [`attachments/spectrogram.svg`](../algorithms/attachments/spectrogram.svg) | The spectrogram explainer — the three analysers, the mel filterbank, one column and the rolling history — shown in the spectrogram concept |
| [`attachments/audio-scrubber.svg`](../algorithms/attachments/audio-scrubber.svg) | The audio scrubber explainer — the control, the grain, the plan and the freeze — shown in the audio scrubber concept |
| [`attachments/assistant-loop.svg`](../algorithms/attachments/assistant-loop.svg) | The assistant loop explainer — the loop, the message rule, the trimmed history, compaction and the bounds — shown in the assistant loop concept |
| [`attachments/input-handling.svg`](../security/attachments/input-handling.svg) | The input handling explainer — what enters, the two validations, the caps, the escaping and the policy — shown in the input handling concept |
| [`attachments/url-and-network-bounds.svg`](../security/attachments/url-and-network-bounds.svg) | The URL and network bounds explainer — the verdicts on a URL, the four fetch properties and the fence — shown in the URL and network bounds concept |
| [`attachments/credentials-and-preferences.svg`](../security/attachments/credentials-and-preferences.svg) | The credentials and preferences explainer — the storage keys, the one secret, the allowlisted write, the rebuilt read and what is never stored — shown in the credentials and preferences concept |
| [`attachments/streaming-and-budgets.svg`](../security/attachments/streaming-and-budgets.svg) | The bounded streaming and reserved capacity explainer — the bounded reader, reserve and release, the fetch slot and the rollback — shown in the bounded streaming and reserved capacity concept |
| [`attachments/resource-lifecycle.svg`](../security/attachments/resource-lifecycle.svg) | The resource lifecycle explainer — the bundle generation, the six rules, the teardown and the refused late result — shown in the resource lifecycle concept |
| [`attachments/assistant-data-flow.svg`](../security/attachments/assistant-data-flow.svg) | The assistant data flow explainer — what leaves the page, the CSP fence, the two authentication paths, the microphone token and the bounds — shown in the assistant data flow concept |
| [`favicons/`](../../favicons/) | The icon assets the tool references: the SVG and ICO sources (embedded in the page), the Android icons and `site.webmanifest` with the app name, scope, icons and screenshot |
| [`apple-touch-icon.png`](../../apple-touch-icon.png) | The iOS home-screen icon, kept at the site root where iOS looks for it |
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
