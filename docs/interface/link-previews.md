---
type: Reference
title: Link previews
description: The Open Graph and Twitter Card tags that populate a preview card when okfy is shared, for example on Mastodon.
tags: [interface, metadata, open-graph, sharing]
okfx:
  mode: reference
  version: praxis/1
sources:
  - id: mastodon
    resource: https://github.com/mastodon/mastodon/blob/main/app/lib/link_details_extractor.rb
    title: Mastodon – LinkDetailsExtractor
  - id: ogp
    resource: https://ogp.me/
    title: The Open Graph protocol
  - id: source
    resource: ../../okfy.html
    title: okfy.html – head metadata
  - id: image
    resource: ../../okfy.png
    title: okfy.png – the preview image
---

# What a preview uses

When a page is shared, the platform builds a preview card from the page's own
metadata. Mastodon reads the **Open Graph** tags: `og:title`, `og:description`
and `og:image`. The card's picture is `og:image`, and for the description it
falls back to the plain `<meta name="description">`.[^mastodon][^ogp] The web app
manifest is not used for link previews.

# What okfy declares

`okfy.html` declares a `website` Open Graph set — title, description and the
screenshot `okfy.png`[^image] as `og:image` — together with the matching
`twitter:*` tags.[^source] The image URLs are **relative** (`okfy.png`), and
Mastodon resolves a relative image against the shared page's URL.[^mastodon]

# Notes

- The card picture comes from `og:image`, not from the favicon; the favicon is
  only the browser-tab icon. A Mastodon card shows the picture, the title, the
  description and the site name from `og:site_name`.[^mastodon]
- Because the image URL is relative, a copy of the tool placed in any folder
  resolves it next to `okfy.html`. A platform that insists on an absolute
  image URL would need the canonical origin written in instead.[^ogp]
- The tags are page metadata only; they do not change the tool's behaviour.[^source]

# Connections

- [Installable web app](installable-web-app.md)
- [Publishing](publishing.md)
- [Favicon](../design/favicon.md)
- [About this bundle](../about-this-bundle.md)

[^mastodon]: Mastodon, `app/lib/link_details_extractor.rb`.
[^ogp]: The Open Graph protocol, ogp.me.
[^source]: The head metadata in `okfy.html`.
[^image]: The screenshot `okfy.png` at the repository root.
