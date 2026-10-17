---
type: Reference
title: Controls
description: The mouse, touch, keyboard and toolbar controls and the two side panels, in one reference.
tags: [guide, reference, controls, keyboard, touch]
okfx:
  decks: [Tour]
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – pointer, keydown and control handlers
  - id: design
    resource: ../design/interface-design.md
    title: Interface design
---

# Mouse

| Action | Result |
| --- | --- |
| Move over a node | Show its tooltip. |
| Click a node | Open its page in the preview; a node with a dashed ring loads first. |
| Click a tag hub | Toggle that tag in the filter. |
| Double-click a directory | Enter the directory. |
| Drag empty canvas | Pan. |
| Drag a node | Move it; the layout takes it back when you let go. |
| Scroll wheel | Zoom around the pointer. |
| Press and hold a concept, then drag | Start a deck card and drop it on the deck. |
| Press and hold a directory or tag | Open the expansion dial; drag to a mode and release to apply it. |
| Release in the dial's hub | Cancel the dial without changing anything. |
| Side buttons (back / forward) | Step the preview back or forward. |

# Touch

| Action | Result |
| --- | --- |
| Tap a node | Open its page in the preview. |
| Tap a directory | Enter the directory. |
| Tap a tag hub | Toggle that tag in the filter. |
| Drag | Pan. |
| Pinch | Zoom. |
| Press and hold a concept, then drag | Start a deck card. |
| Press and hold a directory or tag | Open the expansion dial; drag to a mode and release to apply it. |

# Keyboard

| Key | Result |
| --- | --- |
| `Escape` | Close, in order: the expansion dial, the deck menu, the preview, the About panel, then any open filter list. |
| `Alt`+`←` / `Alt`+`→` | Step the preview back or forward. |
| `Enter` / `Space` | Activate the focused legend row. |

There are no other global shortcuts.[^source]

# Toolbar

| Control | Result |
| --- | --- |
| **Open folder…** | Pick a bundle directory from disk. |
| **Reload** | Re-fetch the bundle from the page's address. |
| **Reset view** | Fit the whole graph in view. |
| **Reset layout** | Run the layout again from a fresh arrangement. |
| **Labels** | Show or hide node labels (on by default). |
| **Tags** | Show the tag hubs and hide the directory ring, or hide them again. |
| **Top** / **‹** / **›** | Directory navigation, with the current path beside them. |
| **okfy ▾** | Open the About panel. |

# Panels

- **Filters** dock right: the search box, the Kinds, Types, Tags and Status
  filters, and **Clear filters**. Open or close it with the **Filters** tab. A
  search or an attribute filter draws the whole subtree, so a match inside a
  directory that has not been expanded yet is still shown.
- **Legend** docks left: the list of groups with their colours and counts; click
  a row to filter the graph to that group.
- **About** opens from the **okfy ▾** title as the startup panel. It holds a
  **Language** picker (a searchable dialog of every language, grouped by geographic
  region) and a **Runtime internals** link that opens the synthetic
  [`.runtime` directory](../interface/runtime.md).

On screens narrower than 760px the toolbar collapses behind the **☰** button and
the two panels slide behind their **Filters** and **Legend** tabs.[^design]

# Leaving the page

Once a bundle is loaded, the browser warns before it unloads the page: closing
the tab, reloading, or entering another address. The browser supplies the wording
of the warning.

Back and Forward entries that stay inside the preview move through pages without
a warning. At the page's first history entry, Back and the mouse's back button
are caught every time: the viewer stays and a short notice explains that closing
the tab or entering another address leaves. This holds in Firefox too, which
keeps the page in its back/forward cache. Forward entries are in-app history, so
they do not leave either.[^source]

# Connections

- [Find a concept](find-a-concept.md)
- [Explore the graph](explore-the-graph.md)
- [Read a concept](read-a-concept.md)
- [Interface design](../design/interface-design.md)
- [Build a deck of cards](../interface/deck.md)

[^source]: The pointer, keyboard and control handlers in the tool source, including the `beforeunload` and history-entry guards.
[^design]: Interface design.
