---
type: Reference
title: Residual risk
description: Known limits of the protections and the browser checks that remain before release.
tags: [security, risk, limitations, verification]
okfx:
  mode: explanation
  version: praxis/1
sources:
  - id: review
    resource: ../reviews/2026-10-05.md
    title: Security review of okfy (2026-10-05)
  - id: source
    resource: ../../okfy.html
    title: okfy.html – the assistant client and CSP
---

# Why some risk remains

The protections bound what the tool does, not what the browser or the platform does. The review therefore lists risk that the fixes do not remove.[^review]

# Known limits

- **Inline script.** A single-file tool must keep its inline application script. `script-src-attr 'none'` adds protection against event attributes, but its support and effect still need checking in the target browsers; a script hash is a further option.
- **Decoders.** Image limits bound compressed bytes, not decoded pixels, so the browser's image and SVG decoders remain part of the trust base.
- **Chunk allocation.** Streaming limits retained content, but the browser or the decompression engine can allocate a chunk before JavaScript checks it.
- **Server mapping.** URL containment constrains addresses, not the server's mapping from URL to file. Symlinks, rewrites and misconfiguration must be handled on the server, and a dedicated static origin is preferred.
- **No memory promise.** A combined byte limit is not a guarantee of low memory use for every allowed graph.
- **Service worker.** An installed okfy registers a same-origin service worker. It caches only the app shell and handles only navigations, but it is a persistent same-origin actor whose behaviour still needs checking in the target browsers.
- **Same-origin icons.** The CSP allows `img-src 'self'` so the web app manifest's own icons and screenshot can load for install surfaces. This does not let the renderer show bundle images over the network, because the renderer never emits a network image `src`.
- **Assistant egress.** The CSP permits `connect-src` for `https`, loopback `http`, and `wss` (with loopback `ws`) so the optional [assistant](../interface/assistant.md) can reach the configured LLM provider — the WebSocket scheme is for the realtime microphone transcription. When it is used, the prompt, the concepts the tools return and, with the microphone, the audio you speak leave the machine, and prompt injection from a hostile bundle is mitigated but not eliminated.[^source] See [Assistant data flow](assistant-data-flow.md).

# Checks that remain

The passing tests use a mocked network and parts of the DOM and layout startup, so actual browser behaviour, CSP enforcement and network traffic are still unverified. The review leaves these browser checks open:[^review]

- [ ] The marker payloads create no event attributes and do not change the document title.
- [ ] The network panel shows no requests outside the bundle root or forwarded redirects.
- [ ] Local images work; external, data and raw blob images trigger no loading.
- [ ] Normal crawling, depth limiting, local attachments, SVG images, footnotes and navigation work.
- [ ] Oversized streams, PDFs, decompression results and bundles are rejected within the limits.
- [ ] Switching bundles during active requests shows no earlier images, text or metadata.
- [ ] A graph-limit failure leaves the previous bundle usable and allows a new attempt once the cause is removed.
- [ ] The assistant panel opens by default but makes no network request until a question is asked (or the model picker is opened).

# Connections

- [Untrusted bundles](../principles/untrusted-bundles.md)
- [Limits and budgets](limits-and-budgets.md)
- [Test suite](../maintenance/test-suite.md)

[^review]: Security review, "Residual risk and further control", "Verification" and "Behavior changes".
[^source]: `okfy.html`, the assistant section and the `connect-src` directive.
