---
type: Reference
title: Interface design
description: The tool's visual language, covering the dark theme, the toolbar and docks, shared component styling and accessibility cues.
tags: [design, ui, css, accessibility, theme]
okfx:
  mode: reference
  version: praxis/1
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – inline CSS and UI
  - id: readme
    resource: ../../README.md
    title: okfy – README
---

# Overview

The interface is plain inline CSS inside the single HTML file; there is no stylesheet, framework or theme build. It is a fixed dark UI drawn over the graph canvas. Because the CSS ships with the code, this concept is where the visual language is kept current when the interface changes.[^source]

# Theme

One dark theme, defined as CSS custom properties on `:root`: a page background, two panel surfaces, a line colour, text and muted text, and an accent. Node colours (directories, index files, files, attachments, tag hubs and concept types) are separate constants in the script. There is no light theme and no theme switch.[^source]

# Layout

- A full-viewport canvas holds the graph.
- A floating top bar holds pill-shaped groups: the title and stats, file actions, view and toggle actions, and directory navigation.
- The **About panel** opens as the startup panel — shown in place of the bundle dialog — and stays until the user interacts with the interface outside it (a pointer press, a scroll or a keypress outside it dismisses it; the title toggles it and the panel's own controls stay usable). On small screens the startup open is **collapsed** to the banner, the revision, the **Language** picker and the links, with a narrow **chevron** toggle in the middle that reveals the description, the usage list and the AI note and is then removed; opening the panel again from the title shows everything. Shown in full there, the panel **sizes to its text** — it is not capped to a share of the viewport — so the whole text is read at once without a scrollbar whenever the window has the room; only when the window is too short for it is the panel capped to the remaining height and its body scrolls. The **Runtime internals** link sits at the right of the **Source on GitHub** link and uses the Directory colour (the same colour as a Directory node), the **AI transparency** link uses the File colour (the same colour as a File node), and the **Language** picker sits with those links, uses the Directory colour (the same colour as a Directory node), and opens a searchable dialog of every language, grouped by geographic region. It opens the synthetic [`.runtime` directory](../interface/runtime.md) that describes the running viewer. The **bundle dialog** itself is reserved for errors and explicit actions such as a drag or a reload, while **Open folder…** and **Reload** stay available in the toolbar.
- A filter sidebar docks right, the legend docks left, and the preview and loading overlays sit above the canvas. The **deck of cards** is an optional floating stack of small page cards with no panel of its own: the cards overlap to a header strip, hovering one repels its neighbours to reveal it partly, and each card renders its page as a lazy screenshot; guides can be added as sub-decks. It docks to the left of the filter sidebar when that panel is open, and the filter sidebar sits above the deck — as does the legend panel on small screens — so neither panel is covered; the node tooltip is drawn above the deck but below those panels. Opening a card reads the whole deck as one **continuous stream**, fullscreen within the browser window — with a shared top bar following what is in view. Under a right-to-left interface language the docks mirror to the opposite edge. See [Deck of cards](deck.md) and [Languages](../interface/languages.md).
- The legend lists each node kind and concept type with a colour swatch and count. Clicking a row filters the graph to that group and greys the other rows without removing them, so clicks combine additively and clicking again clears one. Hovering a row highlights that group with the same cue used when hovering a node; while a filter is active the hover adds the hovered group to the selection instead of replacing it, so the standing selection and the hovered group are highlighted together. The list is rebuilt when a directory is entered or a tag filter changes, dropping selections whose group is no longer present.
- Below 760px the bar stacks vertically, the extra groups collapse behind a hamburger, and the side panels dock and slide behind tabs.[^source]

# Components

Shared styling keeps the controls consistent:[^source]

- Buttons share one base rule (surface, border, radius, padding); hover promotes the border to the accent colour. The **title control** is the exception: it shows the brand mark and stays flat on hover — no fill and no accent ring.
- The filter and legend **panel tabs** keep their inner border transparent in every state, so the tab blends into the panel and its hover accent never draws the edge where it meets the panel — the highlight stops at the panel rather than ringing the tab.
- Groups are translucent, blurred pills that hold related controls.
- Toggle buttons (Labels and Tags) carry their state in `aria-pressed`. The **on** state is the normal label; the **off** state dims the label to a shade only slightly lighter than the button surface, rather than tinting the button fill.
- The title control and the mobile hamburger use the same vertical box model as the nav buttons. The title's brand mark is taller than a text line box, so the title carries a negative block margin that absorbs the excess and keeps every top-bar group the same height.
- The brand *okfy* appears in three forms. The **toolbar title** shows the **node mark**: each of the four letters sits in a filled circle in a node-kind colour — Directory (`#8b93a7`), the Concept colour (the accent, `#5b8def`), File (`#c9a24d`) and Concept type (`#a274d6`) — with the letters in white and short links between the circles in the graph link colour (`#6a7488`). The four nodes sit closer together than before and at slightly uneven heights — the vertical offset stronger than the horizontal — so the strand dips and rises rather than running straight. It is one inline `<symbol>` reused with `<use>`, drawn at 96×32, and it carries no background of its own. The **About panel** prints *okfy* as plain text. The **bundle dialog** shows a wordmark that colours the format *okf*: `o` and `k` are split abruptly at their midpoint, the left half in the Concept colour (the accent, matching how the mascot paints concepts) and the right half in the surrounding text colour, `f` is that Concept colour at full strength, and the trailing `y` stays in the surrounding text colour.
- Legend rows carry horizontal padding, so the hover and selected highlight boxes enclose the swatch, label and count with even space on both sides.
- The **audio and video previews** reuse the shared surfaces: the audio player draws its rolling spectrogram on a framed canvas — the same mel view the assistant's speech bubbles use — with the **play/pause** button, the **scrubber** and the position read-out laid inline over the foot of the spectrogram, on a soft gradient that keeps them legible. The scrubber is a **fill**: the filled part of the track is the position, with no circular handle, and dragging it scrubs — the playhead follows the pointer and the drag's speed sets the playback speed, rendered as short overlapping, edge-silent grains rather than resampling, so a slow drag is a pitch-preserving slowdown while a fast one is filled with denser grains so it stays a continuous fast-forward, and held at rest the grains keep firing at the fixed head, so the clip is heard infinitely slowed — a granular freeze — rather than going silent (a streamed clip — a large local one, or a served one played from its blob — is not decoded, so its element plays with the rate following the drag instead). Releasing resumes normal playback, and closing the preview stops the player. **Video** renders in a plain media element with the browser's own controls.
- Text selection is off for the interface and on only where text is the content: input fields, the page display (the preview and the deck reading stream) and the assistant's transcript.

# Favicon and mascot

The page targets **modern browsers and OS**. It declares its favicon as a scalable SVG icon in an inline `data:` URI, which keeps the single-file format, since the tool never loads `data:` images from bundle content. Because iOS does not use SVG favicons — for example in bookmarks — it also embeds an ICO as a second inline `data:` URI, and declares `/favicons/favicon.ico` first as a lowest-priority `icon` for clients that ignore the inline `data:` icons. It adds an `apple-touch-icon` for iOS home screens and a web app manifest at `/favicons/site.webmanifest` that makes okfy installable, and omits the fixed-size raster PNG fallbacks. The toolbar shows an **Install** button once the browser offers installation. The CSP allows `manifest-src 'self'` and `worker-src 'self'` for the manifest and the optional service worker, `img-src 'self' blob: data:` so the manifest icons and screenshot can load while bundle images still come only from blob URLs, and `media-src blob:` so a previewed video plays from a blob URL of its own bytes. See [Favicon](favicon.md) for how the `icon` link relation works, and [Installable web app](../interface/installable-web-app.md) for the install surface. The figure is the project's **mascot**: a stick figure in a victory pose whose nodes follow the graph vocabulary — the torso is the root directory, the head, shoulder, elbows and hands are concepts, the knees and feet are files, and each arm and leg is drawn as two links. It is drawn inline in the About panel and the bundle load dialog, and kept as [`attachments/favicon.svg`](attachments/favicon.svg) for documentation.[^source]

In those two panels the figure starts in a fixed pose and alternates on a 10-second timer: it holds the pose, then releases it and lets physics run — the same velocity-Verlet force layout the graph uses (softened repulsion, link springs, a decaying temperature), so the joints relax into a laid-out arrangement at the graph's rapid pace — and then forcibly drags the joints back into the fixed pose. The cycle restarts when a panel becomes visible. Joint rest positions come from the markup; the link topology and the physics weights live in the script. A hidden panel is skipped, and `prefers-reduced-motion` leaves the figure static.

![okfy mascot](attachments/favicon.svg)

# Accessibility

State is carried by attributes, not colour alone where it matters: `aria-pressed` on the toggles, `aria-expanded` on the title, labelled inputs, and a reduced-motion fallback for the loading spinner and the mascot figure. Panels are reachable by keyboard, and external links open with `rel="noopener noreferrer"`.[^source]

# Guidance

Keep the single-file, dependency-free approach and reuse the CSS custom properties instead of ad-hoc colours. Prefer expressing component state with ARIA attributes so the visual cue follows the semantics. Update this concept when the theme, layout, components or accessibility cues change.

# Connections

- [Interface](../interface/index.md)
- [Deck of cards](deck.md)
- [Favicon](favicon.md)
- [Local processing](../principles/local-processing.md)
- [About this bundle](../about-this-bundle.md)

[^source]: The tool's inline CSS and UI in `okfy.html`.
[^readme]: Project README.
