---
type: Explanation
title: Browser integration
description: "How the single-page tool runs inside the browser: the features it uses, the three file routes, the network fence and exception, and the input and output devices it reads."
tags: [interface, architecture, browser, file-access, networking, input]
okfx:
  mode: explanation
  version: praxis/1
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – the single document, its browser APIs and its bounds
  - id: sw
    resource: ../../okfy-sw.js
    title: okfy-sw.js – the optional app-shell service worker
  - id: manifest
    resource: ../../favicons/site.webmanifest
    title: site.webmanifest – the web app manifest
  - id: readme
    resource: ../../README.md
    title: okfy – README
  - id: fetch
    resource: https://fetch.spec.whatwg.org/
    title: Fetch Standard
  - id: fs
    resource: https://developer.mozilla.org/en-US/docs/Web/API/File_System_API
    title: MDN – File System API
  - id: history
    resource: https://developer.mozilla.org/en-US/docs/Web/API/History_API
    title: MDN – History API
  - id: media
    resource: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
    title: MDN – getUserMedia
  - id: csp
    resource: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
    title: MDN – Content Security Policy
---

# What it is

okfy is a single HTML document with inline CSS and JavaScript; there is no build
step, framework, SDK or application server.[^readme] The browser is the runtime:
it draws the page, fetches a served bundle or reads a folder chosen from disk,
plays media, and supplies the history and storage the viewer uses. See the
[browser integration explainer](attachments/browser-integration.svg) for the page
inside the browser, the features it calls, the three file routes, the network
fence and the input and output devices.

# The page and the browser

The document uses the browser in a small number of ways:[^source]

| Need | Browser feature |
| --- | --- |
| Draw the interface and graph | DOM and CSS, Canvas 2D, `requestAnimationFrame`, inline SVG |
| Move through pages | History API, `popstate`, `beforeunload`, `pageshow` |
| Remember preferences | `localStorage`, `sessionStorage`, `URLSearchParams` |
| Install and run offline | Web app manifest, service worker and Cache API, `beforeinstallprompt` |
| Enforce a policy | Content-Security-Policy, URL containment, bounded streams |
| Read data | File System Access API, directory input, `File` and `Blob`, drag-and-drop |
| Fetch a served bundle | `fetch`, `ReadableStream`, `AbortController` |
| Decode and display | `TextDecoder` and `TextEncoder`, `DecompressionStream`, blob URLs |
| Play and analyse media | Web Audio, `HTMLMediaElement`, `getUserMedia`, `AnalyserNode` |
| Follow the device | `Intl`, `matchMedia`, `devicePixelRatio`, `navigator` |

The code is one immediately invoked function. It never loads a script, a
stylesheet or a font from another origin, and bundle content never becomes
executable markup.[^csp] The preview and the leave guard push history entries,
and `beforeunload` and `pageshow` cover the unload and back/forward-cache
cases.[^history]

# File access

There are three routes, and they do not share a loader:[^source][^fs]

- **A served bundle** is the page root. The crawl fetches `index.md`, follows
  Markdown links, and leaves other files as nodes that are fetched only when
  opened. Every request is same-origin, omits credentials, rejects redirects and
  reads a bounded body.[^fetch] The limits are 512 KiB per file, 8000 files and
  128 MiB per bundle.
- **A local folder** is chosen with **Open folder…** through
  `showDirectoryPicker`, with a `webkitdirectory` file input as the fallback, or
  dropped on the window. The folder is read in place: Markdown when it opens,
  every other file only when clicked. Nothing is uploaded, and a `file://` page
  cannot auto-load, so opening the folder is the intended path.
- **A preview file** is read only when its node is opened. Images become blob
  URLs, audio is decoded into Web Audio or played from an object URL, video uses
  a media element, PDF metadata is scanned from bounded bytes, and a sibling
  WebVTT track is read as text. Images and media have their own byte caps.

A chosen folder and everything read from it stay in the page. The same is true
of a served bundle, which never leaves its origin.

# Networking

The bundle path is fenced to the page's origin and the bundle root:[^source]
`trackedFetch` uses no credentials, treats a redirect as an error, holds one of
four request slots under a 30-second deadline, bounds the body as it streams and
rechecks the response's own URL. A URL that leaves the root is refused before a
request is made.

The optional assistant is the one exception, and it is unreleased in this
revision. When a reader turns it on and asks a question, the page may POST to the
LLM provider the reader configured, list that provider's models, call its speech
endpoint, or open a realtime transcription WebSocket. The provider is reached
over `https`, or over `http`/`ws` on loopback for a local server; the page's
`connect-src` names exactly those schemes.[^csp] Nothing is sent while the
assistant is idle.

The optional service worker caches only the app shell—`okfy.html`, the manifest
and its icons. It never caches or intercepts bundle content.[^sw]

# Input and output

The graph is driven by pointer, touch, wheel and keyboard events, by a folder
dragged onto the window and by the folder picker.[^source] A pointer can click,
hover, drag a node or pan, and the mouse's side buttons step the preview history.
Touch adds tap, drag and pinch; the wheel zooms about the pointer; `Escape` and
`Alt`+arrow keys have their own actions. The microphone, when the assistant is
enabled, is captured with `getUserMedia`, chosen through
`navigator.mediaDevices.enumerateDevices`, analysed with an `AnalyserNode` and
streamed to the provider's realtime endpoint.[^media] It needs a secure context
and the reader's permission.

Output goes back through the same page: the canvas draws the graph and the
spectrogram, the DOM holds the panels and the preview, Web Audio and media
elements play sound and video, and the same graph speaks the assistant's summary
when audio output is on. An installed copy runs in its own window.[^manifest]

# What stays local, what leaves

- **In the page:** the loaded bundle, the graph, previews, the deck and the
  assistant's session state.
- **In the browser:** the volume, language, feature choices and, only when the
  reader opts in, the assistant's remembered keys; the service worker's app-shell
  cache.
- **Off the page:** only the assistant's provider calls, and only when the reader
  asks. There is no analytics, telemetry, CDN, external font or external image.

# Connections

- [Local folders](../interface/local-folders.md)
- [File, image and media preview](../interface/file-preview.md)
- [URL and network bounds](../security/url-and-network-bounds.md)
- [Limits and budgets](../security/limits-and-budgets.md)
- [Installable web app](../interface/installable-web-app.md)
- [Feature toggles](../devops/feature-toggles.md)
- [Local processing](../principles/local-processing.md)

[^source]: `okfy.html`, the single document, its fetch path, file readers, history guard, media graph and input handlers.
[^sw]: `okfy-sw.js`, the app-shell service worker.
[^manifest]: `favicons/site.webmanifest` and the install handling in `okfy.html`.
[^readme]: Project README, "Usage" and "In local web-browser".
[^fetch]: Fetch Standard.
[^fs]: MDN, "File System API".
[^history]: MDN, "History API".
[^media]: MDN, "MediaDevices: getUserMedia()".
[^csp]: The page's Content-Security-Policy and MDN, "Content Security Policy (CSP)".
