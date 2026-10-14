---
type: Guide
title: Read a concept
description: Open a page in the preview, follow links and footnotes, jump by tag, and page back and forward.
tags: [guide, how-to, reading, preview]
okfx:
  decks: [Tour]
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – openPreview, handlePreviewClick, pvBack, pvForward
  - id: preview
    resource: ../interface/file-preview.md
    title: File, image and media preview
---

# Goal

Read a concept and move from it to the pages it points at, without going back to
the graph.

# Open a page

Click a node to open it in the preview panel. A concept or index renders its
Markdown. A node with a dashed ring is not loaded yet: click it to load the
content, then click again to open it.

# Move through a page

- **Links** to other concepts open in the same preview; a link to an `#anchor`
  scrolls to that heading; external links open in a new browser tab.[^source]
- **Footnotes** jump to the note and back; a footnote that is just a URL is shown in place as an external-link marker (↗) that opens the URL in a new tab.
- Use the **‹** and **›** buttons in the preview header, `Alt`+`←` and
  `Alt`+`→`, or the mouse's back and forward buttons to step through the pages
  you have visited.

# Jump between pages that share a tag

Pages show their tags as chips. Hover a chip on a desktop, or tap it on touch, to
list the other pages that carry the same tag; click one to open it. Choosing
**expand in graph** on the chip clears the preview and filters the graph to that
tag instead.

# Close the preview

Choose **Close**, press `Escape`, or click outside the page.

# Where other files differ

Non-Markdown files open differently: an image shows the picture with a source
toggle, an attachment shows its details — a PDF its metadata, an audio or video
clip a player. See
[File, image and media preview](../interface/file-preview.md).[^preview]

# Connections

- [Find a concept](find-a-concept.md)
- [Explore the graph](explore-the-graph.md)
- [File, image and media preview](../interface/file-preview.md)
- [Markdown preview](../algorithms/markdown-preview.md)
- [Build a deck of cards](../interface/deck.md)

[^source]: `openPreview`, `handlePreviewClick`, `pvBack` and `pvForward` in the tool source.
[^preview]: File, image and media preview.
