---
type: Guide
title: Troubleshooting
description: What to check when a bundle, a node or a page does not behave the way you expect.
tags: [guide, how-to, troubleshooting]
okfx:
  decks: [Tour]
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – autoLoad, fetchBundleText, renderMarkdown
  - id: bounds
    resource: ../security/url-and-network-bounds.md
    title: URL and network bounds
  - id: limits
    resource: ../security/limits-and-budgets.md
    title: Limits and budgets
---

# The window shows no bundle

Nothing auto-loads when you open the file from disk. Choose **Open folder…** in
the toolbar and pick the bundle directory, or drag the folder onto the window.
Auto-load works only when the page is served over HTTP.[^source]

# A bundle behind a login or a redirect does not load

This is intended. The viewer omits credentials and rejects redirects, so a bundle
behind authentication, HTTP credentials or a redirect is deliberately
unsupported. Serve the bundle from plain static hosting instead of weakening the
URL controls. See [URL and network bounds](../security/url-and-network-bounds.md).[^bounds]

# A bundle fails to load

The viewer records the failure on the generated `.runtime/errors.md` page and
opens it in the preview instead of showing a dialog. Read the message there — for
example a missing entry file — fix the bundle and reload; a successful load
clears the page. Open it again from **Runtime internals** in the About panel.[^source]

# Clicking a node loads instead of opening

A node with a dashed ring has unloaded content. Click it once to load; a concept
that reveals a deeper level needs a second click to open the preview.

# A page shows a "safety limit exceeded" notice

The Markdown renderer is bounded, so it refuses to render pathological input
rather than produce partial output. The same shared budget caps nesting, input
size, output size and search work. See
[Limits and budgets](../security/limits-and-budgets.md).[^limits]

# An image does not appear

Only images that live inside the bundle are shown. External, `data:` and raw
`blob:` images are not rendered, and the preview shows a short notice instead.

# A large bundle is slow to open

The crawl is lazy, so a large bundle means many requests. Publish small bundles,
or open the page with `?depth=N` to prefetch fewer levels and reveal the rest on
demand. See [URL parameters](../interface/url-parameters.md).

# Connections

- [URL and network bounds](../security/url-and-network-bounds.md)
- [Limits and budgets](../security/limits-and-budgets.md)
- [Residual risk](../security/residual-risk.md)
- [URL parameters](../interface/url-parameters.md)
- [Markdown preview](../algorithms/markdown-preview.md)

[^source]: `autoLoad`, `fetchBundleText` and `renderMarkdown` in the tool source.
[^bounds]: URL and network bounds.
[^limits]: Limits and budgets.
