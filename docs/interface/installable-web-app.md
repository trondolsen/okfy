---
type: Reference
title: Installable web app
description: The web app manifest, the service worker and the install affordance that let okfy run as an installed app.
tags: [interface, pwa, manifest, service-worker]
sources:
  - id: mdn-installable
    resource: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
    title: MDN – Making PWAs installable
  - id: mdn-manifest
    resource: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest
    title: MDN – Web app manifest
  - id: mdn-sw
    resource: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
    title: MDN – Service Worker API
  - id: w3c
    resource: https://www.w3.org/TR/appmanifest/
    title: W3C – Web Application Manifest
  - id: readme
    resource: ../../README.md
    title: okfy – README
  - id: source
    resource: ../../okfy.html
    title: okfy.html – manifest link and install handling
  - id: manifest
    resource: ../../favicons/site.webmanifest
    title: site.webmanifest – the web app manifest
  - id: sw
    resource: ../../okfy-sw.js
    title: okfy-sw.js – the service worker
---

# What it is

okfy can be installed as a web app. The browser reads the web app manifest and,
when the site meets the installability rules, offers to install it; once
installed, okfy opens in its own window like a platform app.[^mdn-installable]
Installation needs `https://` or `localhost`, a manifest with a name, 192px and
512px icons, `start_url` and `display`.[^mdn-installable] A service worker is not
required for installation, but one gives an offline app shell.[^mdn-sw]

# Manifest

`favicons/site.webmanifest`, linked from `okfy.html`, sets:[^manifest][^w3c]

| Member | Value | Purpose |
| --- | --- | --- |
| `id`, `start_url` | `/okfy.html` | The app's identity and the URL opened on launch. |
| `scope` | `/` | Documents the installed app claims. |
| `name`, `short_name` | "okfy – OKF graph explorer", "okfy" | The displayed names. |
| `display` | `standalone` | Launch without the browser's own UI. |
| `theme_color`, `background_color` | `#12141a` | The dark UI and the launch background. |
| `icons` | 192px and 512px PNG, plus the SVG | The app icons. |
| `screenshots` | one wide PNG | Extra context in richer install prompts. |

The 512px PNG is not declared `maskable`, because the figure reaches near the
edges; a device that masks icons will scale it down instead.

# Service worker

`okfy-sw.js` keeps only the app shell — `okfy.html`, the manifest and the
icons — so an installed okfy starts offline. It never caches or intercepts
bundle content: it handles only navigations, network-first, and lets every other
request pass through.[^sw] A copy that ships `okfy.html` without the worker
registers nothing and behaves exactly as before.[^source]

# Install affordance

`okfy.html` listens for `beforeinstallprompt`, keeps the event, and reveals an
**Install** button in the toolbar; the button calls the browser's own prompt.[^source]
The button stays hidden when okfy already runs installed
(`display-mode: standalone`). iOS does not fire that event, so installation there
uses the Share menu.[^mdn-installable] The steps per platform are in
[Install okfy as a web app](../guides/install-as-web-app.md).

# Security

To let the manifest, its icons and the screenshot load, the page's CSP allows
`manifest-src 'self'`, `worker-src 'self'` and same-origin images
(`img-src 'self'`). Bundle images are still shown only from blob URLs: the
renderer never emits a network image `src`, so `img-src 'self'` is page chrome,
not a way to load bundle content. See
[URL and network bounds](../security/url-and-network-bounds.md).

# Connections

- [Install okfy as a web app](../guides/install-as-web-app.md)
- [Publish a bundle on a website](publishing.md)
- [URL and network bounds](../security/url-and-network-bounds.md)
- [Local processing](../principles/local-processing.md)

[^mdn-installable]: MDN, "Making PWAs installable".
[^mdn-manifest]: MDN, "Web app manifest".
[^mdn-sw]: MDN, "Service Worker API".
[^w3c]: W3C, "Web Application Manifest".
[^readme]: Project README.
[^source]: The manifest link and install handling in `okfy.html`.
[^manifest]: The project's `favicons/site.webmanifest`.
[^sw]: The project's `okfy-sw.js`.
