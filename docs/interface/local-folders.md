---
type: Workflow
title: Open a local folder
description: Steps to browse a bundle from disk with the folder picker or drag-and-drop.
tags: [workflow, local, file-system-access, how-to]
okfx:
  mode: how-to
  version: praxis/1
sources:
  - id: readme
    resource: ../../README.md
    title: okfy – README
  - id: source
    resource: ../../okfy.html
    title: okfy.html – pickFolder, fromDataTransfer, appendLocalFile, loadFileNode
---

# Goal

Browse a bundle stored on your own machine, without a web server.[^readme]

# Steps

1. Copy `okfy.html` into the folder you want to browse, or open the HTML file directly.
2. Open the HTML file in a browser.
3. Choose **Open folder…** and select the bundle directory, **or** drag the folder onto the window.

# What happens

The tool reads the Markdown files and shows one level at a time: `?depth=N` keeps deeper files hidden but available, and clicking a dashed node reveals the next level. Non-Markdown files appear as nodes and are read only when opened.[^source]

Every file the folder lists becomes a node, whether or not any Markdown refers to it. A folder with **no Markdown at all** therefore still shows its files, so a folder of media can be opened and a clip clicked even when nothing links to it — and its sibling subtitle track is among those nodes.

A **non-Markdown text file** is kept even when it is larger than the single-file read limit: nothing is read when the folder opens, and opening it reads a bounded prefix. This is what lets a large `.vtt` subtitle track be found next to its media; see [File, image and media preview](file-preview.md).

# Notes

- The folder picker uses the File System Access API when the browser provides it, and falls back to a directory file input otherwise.
- Directories whose name starts with `.` are skipped, and the read is bounded by the same file, byte and depth limits as server loading.
- The folder is kept in memory. Reloading or closing the page loses it, so while
a bundle is open the browser warns before the page unloads; open the folder
again to continue.
- On `file://`, auto-load is impossible; opening a folder is the intended path. The viewer starts on the About panel, so dismiss it by clicking outside or use the toolbar's **Open folder…** control.[^readme]

# Connections

- [URL parameters](url-parameters.md)
- [Limits and budgets](../security/limits-and-budgets.md)
- [Crawling](../algorithms/crawling.md)

[^readme]: Project README, "In local web-browser".
[^source]: `pickFolder`, `fromDataTransfer`, `appendLocalFile`, `loadFileNode` and the locally opened folder's placeholder seeding in the tool source.
