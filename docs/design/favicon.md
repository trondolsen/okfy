---
type: Reference
title: Favicon
description: What a favicon is, how the icon link relation declares it, and how browsers, vendors and search engines use the icon.
tags: [design, favicon, html, icon, metadata]
okfx:
  mode: reference
  version: praxis/1
sources:
  - id: mdn-glossary
    resource: https://developer.mozilla.org/en-US/docs/Glossary/Favicon
    title: MDN – Favicon
  - id: html-spec
    resource: https://html.spec.whatwg.org/multipage/links.html#rel-icon
    title: HTML Standard – Link type "icon"
  - id: mdn-icon
    resource: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel#icon
    title: MDN – rel attribute, "icon"
  - id: iana
    resource: https://www.iana.org/assignments/link-relations
    title: IANA – Link Relation Types registry
  - id: apple
    resource: https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/pinnedTabs/pinnedTabs.html
    title: Apple – Safari Web Content Guide, "Creating Pinned Tab Icons"
  - id: google
    resource: https://developers.google.com/search/docs/appearance/favicon-in-search
    title: Google Search Central – Define a favicon to show in search results
---

# What a favicon is

A **favicon** (favorite icon) is a small icon published with a website. Browsers show it in the page tab, in the bookmarks menu and in similar places, where it helps users recognise the site.[^mdn-glossary]

# How it is declared

A page declares its icon with a `<link>` element in the head whose `rel` value is `icon`:[^mdn-icon][^html-spec]

```html
<link rel="icon" href="/favicon.ico" />
```

The `icon` link relation is registered in the IANA link relation types registry.[^iana] A page may declare several icons. The browser chooses the most appropriate one from their `media`, `type` and `sizes` attributes; if two are equally appropriate it uses the last, and if the chosen icon is unsupported it falls back to the next.[^mdn-icon]

| Attribute | Meaning |
| --- | --- |
| `href` | The URL of the icon. |
| `type` | The media type, for example `image/x-icon`, `image/png` or `image/svg+xml`. |
| `sizes` | The pixel sizes the icon provides, for example `16x16` or `32x32`, or `any` for a scalable icon. |

# Formats

- **ICO** is the traditional format and can carry several sizes in one file.
- **PNG** is a common choice for a fixed size.
- **SVG** scales to any size, but older browsers need a bitmap fallback.

Google accepts BMP, GIF, ICO, PNG, JPEG, PPM and TIFF for its own use.[^google] The historical spelling `shortcut icon` is non-conforming and must not be used.[^mdn-icon]

# Vendor-specific declarations

- iOS does not select a page icon from `rel="icon"` or from `sizes`; it uses the non-standard `apple-touch-icon` instead.[^mdn-icon]
- Safari pinned tabs take a monochrome icon from `rel="mask-icon"`: a single-layer SVG that is 100 % black on a transparent background, with the `color` attribute setting the display colour and a `viewBox` of `0 0 16 16`.[^apple]

# Use in search results

Google can show a site's favicon in its search results. The icon is declared with `<link rel="icon">` on the home page, and Google supports `icon` (and the historical `shortcut icon`) plus `apple-touch-icon` and `apple-touch-icon-precomposed`.[^google] For this to work:

- The favicon and the home page must be crawlable, by Googlebot-Image and Googlebot respectively.
- A site is defined by its hostname, and Google uses one favicon per site.
- The icon must be square, at least 8×8 px, and Google recommends larger than 48×48 px.
- The icon URL should be stable, because Google recrawls and caches it on its own schedule.

Google may replace an icon it considers inappropriate with a default one.[^google]

# Connections

- [Interface design](interface-design.md)

[^mdn-glossary]: MDN glossary, "Favicon".
[^html-spec]: HTML Standard, the `icon` link type.
[^mdn-icon]: MDN, the `rel` attribute and its `icon` value.
[^iana]: IANA link relation types registry.
[^apple]: Apple, "Creating Pinned Tab Icons".
[^google]: Google Search Central, "Define a favicon to show in search results".
