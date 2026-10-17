---
type: Protocol
title: URL and network bounds
description: Rules that keep every request same-origin and inside the declared bundle root, with no credentials or redirects.
tags: [security, url, same-origin, network]
okfx:
  mode: reference
  version: praxis/1
sources:
  - id: review
    resource: ../reviews/2026-10-05.md
    title: Security review of okfy (2026-10-05)
  - id: source
    resource: ../../okfy.html
    title: okfy.html – normalizeLinkPath, urlWithinBundle, trackedFetch
---

# Rules

Every URL the tool loads passes through the same checks before any request is made:[^source][^review] See the [URL and network bounds explainer](attachments/url-and-network-bounds.svg) for the verdicts on a URL, the four properties of a request, and what the fence lets through.

- **Same origin only.** The URL's origin must equal the page's origin, and the scheme must be `http:` or `https:`.
- **Inside the bundle root.** The URL path must start with the root path, which must end in `/`; neither the root nor the URL may carry a username, password, query or fragment.
- **No encoded separators.** Paths containing an encoded `/`, `\` or `%` are rejected.
- **No traversal or schemes.** Backslashes, control characters, absolute paths and non-http schemes are rejected in internal references.
- **No redirects and no credentials.** Fetch uses `credentials: "omit"` and `redirect: "error"`, so a response cannot bounce the request to another host.

# Effect

A malicious bundle cannot probe other hosts, read another origin, or smuggle a different resource in through a redirect. Images in bundle content follow the same rules; external and `data:` images from content are not shown, and valid bundle images are displayed from blob URLs. Bundle audio and video are read the same way when they are **served** — bounded, once, when the clip is opened — and a video plays from a blob URL of its own bytes under `media-src blob:`, so no served clip is streamed from the network at play time. A **local** clip (a media file in a folder you opened) is different: it is not requested at all, and streams from an object URL of the file, so it never touches the network. The only same-origin network images the page may load are its own web app manifest icons and screenshot, allowed by `img-src 'self'` for install surfaces; the renderer never emits a network image `src`. The optional service worker caches only the app shell and never intercepts bundle requests, so the bounds are unchanged. The only `data:` image the page itself uses is its inline SVG favicon, which is page chrome and not part of a bundle.[^review]

# The assistant exception

The optional assistant is the one path that leaves the origin: it POSTs to the LLM provider the user configures, over `https` (or `http` on loopback — a local server's bind-all address such as `0.0.0.0` is normalized to loopback `127.0.0.1` first). It does not go through the bundle fetch path, so every rule above still governs every bundle request. The assistant's own bounds are in Assistant data flow.

# Limits of the control

The rules constrain URLs, not the server's mapping from URLs to files. Symlinks, internal rewrites and a misconfigured deploy must be handled on the server. Prefer a dedicated static origin without sensitive routes.

# Connections

- [Untrusted bundles](../principles/untrusted-bundles.md)
- [Crawling](../algorithms/crawling.md)
- [Publishing](../interface/publishing.md)
- [Installable web app](../interface/installable-web-app.md)
- [Bounded streaming and reserved capacity](streaming-and-budgets.md)

[^source]: `normalizeLinkPath`, `urlWithinBundle`, `bundleUrl` and `trackedFetch` in the tool source.
[^review]: Security review, finding A2 and "Limits of the control".
