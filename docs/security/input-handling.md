---
type: Protocol
title: Input handling
description: The rules every input passes through — the URL's query, bundle content, local files and the preview's own reads — before the tool uses it.
tags: [security, input, validation, escaping, csp]
okfx:
  mode: reference
  version: praxis/1
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – the validation helpers, the escaping functions and the CSP
  - id: review
    resource: ../reviews/2026-10-05.md
    title: Security review of okfy (2026-10-05)
---

# What enters

Nothing the tool reads is trusted:[^source]

| Input | Comes from |
| --- | --- |
| The URL's query | `?start` and `?depth` (or `?levels`) — anyone can send a link |
| The served bundle | Markdown bodies, frontmatter, link destinations and `.vtt` tracks |
| Local files | a folder picked or dropped on the window |
| The preview's own reads | images, audio, video and PDF metadata |
| State kept in this browser | the volume, the language, the assistant's settings |

The assistant's replies are a sixth input — Markdown rendered by the same renderer — and are described in [Assistant data flow](assistant-data-flow.md) rather than here. See the [input handling explainer](attachments/input-handling.svg) for the entry points, the two validations, the caps and the policy backstop.

# Paths and URLs

A destination is normalized **once**, then resolved, then validated twice.[^review]

- `normalizeLinkPath` trims the value, drops its query and fragment, and refuses anything that carries a backslash, a control character, `//` or a scheme. `%2f`, `%5c` and `%25` are refused *before* decoding, so an encoded separator can never become one and double encoding cannot smuggle one past.
- `joinPath` resolves `.` and `..` and returns nothing when a path would climb above the root; `pathCandidates` anchors a link at the file's own directory and at each ancestor, so a path resolves the same way whether one bundle or a nested collection is loaded.
- `validBundlePath` requires a string of 1 to 2048 characters and at most 24 segments, with no backslash, colon or control character and no leading `/`, and it re-runs `joinPath` to confirm the path is already normalized. A **dot-directory** is skipped, so nothing hidden is crawled.
- `urlWithinBundle` re-checks the *final* URL: both it and the root must be same-origin `http(s)`, neither may carry credentials, the URL may carry no query or fragment, and its path must sit under the root's path with no encoded separator.
- `trackedFetch` repeats that check when it is called **and** again on the response's own URL, so a redirect out of the root is refused rather than followed. It omits credentials, forbids redirects and caps the request at a byte bound.
- Alternative candidate paths are tried on a **404** only, never on another failure, so a miss cannot be turned into a request somewhere else.

# Bounded before buffered

A read is bounded as it streams, not after it is buffered: `readBoundedStream` checks every chunk against the remaining allowance, cancels the stream at the bound and releases the reader. `trackedFetch` checks `content-length` before reading the body, and cancels a body it does not use. The caps themselves are listed in [Limits and budgets](limits-and-budgets.md): 512 KiB per file, 8000 files and 128 MiB per bundle, 32 000 nodes and 80 000 links, 256 references per file, 64 tags of at most 256 characters and 16 segments, 8 MiB per image and 16 MiB in total, and the renderer's own input, output, depth and search-work budget.

# Escaped at the sink

Untrusted text is **escaped where it is written**, never built into markup and re-parsed:[^review]

- Text goes through `esc`: `&`, `<`, `>` and `"`.
- An attribute value goes through `markdownAttr`, which escapes the single quote as well.
- A link target must be `http`, `https` or `mailto` with no credentials and no control characters or backslashes; anything else loses its anchor and only its label is written. An external link opens with `noopener noreferrer`.
- An image is written as an `img` with `alt` and a `data-embed` marker and **no** source; the source is set later through the DOM, and only after the embed has been resolved inside the bundle and validated. An embed that does not resolve is replaced with its alt text.
- Raw HTML in a bundle is never rendered: `<img src=x onerror=alert(1)>` becomes the words a reader sees.

Because no generated value is ever substituted into an attribute, a forged fragment cannot close a quote and become an attribute of its own — finding A1 of the review.

# The policy backstop

The page runs under a Content-Security-Policy, so a mistake in the code is not the last line of defence:

| Directive | What it shuts off |
| --- | --- |
| `script-src-attr 'none'` | no inline event handler can be created, however the markup is built |
| `default-src 'none'` | every kind of load must be named, so a new one fails closed |
| `object-src 'none'` | no plugin or embedded document |
| `base-uri 'none'`, `form-action 'none'` | a bundle cannot re-point relative URLs or post a form anywhere |
| `img-src 'self' blob: data:` | images only from the page's own origin, a blob URL, or the inline favicon |
| `connect-src 'self' https: wss: …` | requests only to the page itself or the assistant's endpoints — the documented exception |

# State that must not leak across bundles

A second load does not inherit the first one's state:[^source]

- The graph is built in private structures and published only when it is complete, so a failed build leaves the current graph alone.
- A bundle switch bumps a **generation**, and a **request number** decides which load wins, so an older result cannot replace a newer bundle.
- Previews, metadata callbacks and image lookups carry a render ID and the generation, and drop their work when either has moved on.
- Blob URLs are tied to the current blob, revoked on replacement, and released when the bundle changes; a rejected file load is rolled back out of the budget.

# What this does not cover

The rules bound what a bundle can make the tool *do*; they cannot make a hostile bundle honest, and the browser-level checks that remain before release are listed in [Residual risk](residual-risk.md).

# Connections

- [URL and network bounds](url-and-network-bounds.md)
- [Bounded streaming and reserved capacity](streaming-and-budgets.md)
- [Resource lifecycle](resource-lifecycle.md)
- [Limits and budgets](limits-and-budgets.md)
- [Markdown preview](../algorithms/markdown-preview.md)
- [Untrusted bundles](../principles/untrusted-bundles.md)

[^source]: `normalizeLinkPath`, `validBundlePath`, `urlWithinBundle`, `trackedFetch`, `readBoundedStream` and the CSP in the tool source.
[^review]: Security review, findings A1, A2 and A3.
