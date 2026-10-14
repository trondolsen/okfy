---
type: Workflow
title: Publish a bundle on a website
description: Steps to serve a bundle and link to it, and the trade-off with lazy crawling for larger bundles.
tags: [workflow, publishing, static-hosting, how-to]
okfx:
  mode: how-to
  version: praxis/1
sources:
  - id: readme
    resource: ../../README.md
    title: okfy – README
---

# Goal

Serve the explorer together with a bundle from a static site, for example GitHub Pages.[^readme]

# Steps

1. Include `okfy.html` in the website.
2. Place `okfy.html` in the bundle folder, next to its `index.md`; the tool loads that `index.md` as the bundle.
3. Publish the site. The page and the bundle must be served from the same origin.

# Trade-off

Bundle pages are crawled lazily, so publishing is recommended for **small** bundles. A large bundle means many requests and a longer load. Use `?depth=N` to prefetch fewer levels and let the user reveal the rest on demand.[^readme]

# Notes

- Bundles are discovered from `index.md` by following links; there is no bundle manifest to declare them.
- To let visitors install okfy, also serve `favicons/site.webmanifest` and `okfy-sw.js` next to `okfy.html`; see [Installable web app](installable-web-app.md).
- Requests omit credentials and reject redirects, so a bundle behind authentication, HTTP credentials or redirects will not load. Use plain static hosting rather than removing the URL controls.[^readme]

# Connections

- [URL parameters](url-parameters.md)
- [Link previews](link-previews.md)
- [Local processing](../principles/local-processing.md)
- [URL and network bounds](../security/url-and-network-bounds.md)

[^readme]: Project README, "Publish on website".
