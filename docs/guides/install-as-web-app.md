---
type: Guide
title: Install okfy as a web app
description: Install okfy as a progressive web app on a computer, Android or iOS, and launch it as an app.
tags: [guide, how-to, pwa, install]
okfx:
  decks: [Tour]
sources:
  - id: mdn-installable
    resource: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
    title: MDN – Making PWAs installable
  - id: mdn-installing
    resource: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Installing
    title: MDN – Installing and uninstalling web apps
  - id: w3c-manifest
    resource: https://www.w3.org/TR/appmanifest/
    title: W3C – Web Application Manifest
  - id: edge
    resource: https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps-chromium/
    title: Microsoft Learn – Progressive Web Apps in Microsoft Edge
  - id: apple-mac
    resource: https://support.apple.com/en-us/104996
    title: Apple Support – Use Safari web apps on Mac
  - id: apple-wwdc
    resource: https://developer.apple.com/videos/play/wwdc2023/10120/
    title: Apple – WWDC 2023, "What's new in web apps"
  - id: readme
    resource: ../../README.md
    title: okfy – README
  - id: source
    resource: ../../okfy.html
    title: okfy.html – install handling
---

# Goal

Run okfy as an installed web app: a window of its own that launches from an
icon on the device and starts without a network.[^mdn-installing]

# Before you start

- Open the **published** okfy over `https://`, or from `localhost`. A file
  opened from disk (`file://`) is never installable.[^mdn-installable]
- The site must publish `okfy.html` next to `favicons/site.webmanifest` and
  `okfy-sw.js`. A copy with only `okfy.html` still runs in the browser, but the
  browser will not offer to install it. The
  [installable web app](../interface/installable-web-app.md) concept lists what
  the manifest provides.[^w3c-manifest]
- The install belongs to the browser that made it. Installing from two browsers
  gives two separate apps that do not share data.[^mdn-installing]

# Steps

## Chrome or Edge on a computer

1. Open the page. When the browser finds the site installable, an install icon
   appears in the address bar.
2. Click the install icon, or open the browser menu (⋮) and choose *Install*. In
   Edge, the same command is under *Apps* → *Install this site as an app*.[^edge]
3. Confirm. okfy opens in its own window and gets an entry in the launcher,
   Dock or Start menu.

okfy also adds its own **Install** button to the toolbar once the browser
offers installation.[^source]

## Chrome on Android

1. Open the page in Chrome.
2. Open the ⋮ menu and choose *Install app* (older Chrome: *Add to Home
   screen*).[^mdn-installing]
3. Confirm; the icon is added to the home screen.

## Safari on iPhone or iPad (iOS and iPadOS 16.4 and later)

1. Open the page in Safari, or from iOS 16.4 in another supporting browser.
2. Tap *Share*, then *Add to Home Screen*.[^mdn-installing]
3. Confirm the name and tap *Add*.

iOS has no install prompt event, so the toolbar **Install** button does not
appear there; use the Share menu instead. Apple continues to extend installed
web apps across iOS releases.[^apple-wwdc]

## Safari on macOS (14 and later)

1. Open the page in Safari.
2. Choose *File* → *Add to Dock*, or *Share* → *Add to Dock*.
3. Type a name and click *Add*. The web app is saved to your Applications folder
   and the Dock.[^apple-mac]

# What you get

- okfy opens in its own window, without the browser's tabs and address bar.[^w3c-manifest]
- A service worker keeps the app shell, so okfy starts when you are offline. A
  bundle served from a website still needs the network; a bundle you open from
  disk works offline on its own.[^readme]

# Remove an installed okfy

Delete it like any other app. On desktop browsers, `chrome://apps` and
`edge://apps` list installed apps; on Android and iOS, remove the home-screen
icon; on macOS, drag the app out of the Applications folder.[^mdn-installing]

# Connections

- [Installable web app](../interface/installable-web-app.md)
- [Publish a bundle on a website](../interface/publishing.md)
- [Local processing](../principles/local-processing.md)

[^mdn-installable]: MDN, "Making PWAs installable".
[^mdn-installing]: MDN, "Installing and uninstalling web apps".
[^w3c-manifest]: W3C, "Web Application Manifest".
[^edge]: Microsoft Learn, "Progressive Web Apps in Microsoft Edge".
[^apple-mac]: Apple Support, "Use Safari web apps on Mac".
[^apple-wwdc]: Apple, WWDC 2023 session "What's new in web apps".
[^readme]: Project README, "Install as a web app".
[^source]: `beforeinstallprompt` handling in the tool source.
