---
type: Guide
title: Explore the graph
description: Pan, zoom, inspect nodes and move through directories to read a whole bundle.
tags: [guide, how-to, navigation, graph]
okfx:
  decks: [Tour]
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – pointer, wheel and directory navigation handlers
  - id: model
    resource: ../model/graph-model.md
    title: Graph model
---

# Goal

Move around a bundle that is too large to read top to bottom, and frame the part
you want to see.[^model]

# Move the view

1. **Pan** by dragging empty canvas.
2. **Zoom** with the scroll wheel, or pinch on a touch screen. The zoom keeps the
   point under the pointer in place.[^source]
3. **Inspect a node**: hover it to show its title, type, path, description, tags
   and, for a concept, its incoming and outgoing link counts.

# Move through directories

1. **Enter a directory** by double-clicking it; on touch, tap it instead.
2. Use the directory controls in the top bar to move between levels: **Top** for
   the bundle root, **‹** and **›** for back and forward. The path after the
   buttons shows where you are.

# Expand or collapse a directory or tag hub

A directory or a tag hub draws only a **page** of its neighbours at first. A node
with more to show carries a dashed ring; a collapsed one is drawn hollow. A tag
hub also keeps the ring while its pages still have held-back tag edges —
**Recursive expand all** opens those tags. A plain click never changes what is
drawn — it keeps the node's own action (enter a directory, open a page, toggle a
tag).

1. **Press and hold** the node. A ring fills as the hold completes and the
   **expansion dial** opens around the node.
2. **Drag to a mode and release** to apply it. Release in the dial's hub, or press
   `Escape`, to cancel and change nothing.

| Sector | Mode | What it does |
| --- | --- | --- |
| top | Expand all | Show every neighbour of this node. |
| right | Recursive expand all | Open the whole subtree below; on a tag hub, also open the tags of the pages it reveals, including tags a tag filter hid. |
| bottom | Collapsed | Hold the neighbours and the subtree back. |
| left | Expand more | Reveal the next page of neighbours. |

The tag-hub part of **Recursive expand all** is the preview toggle `tagRecursiveReveal`; switch it on in [`.runtime/features.md`](../interface/runtime.md) to let those tags open.

The dial carries **no text**: each mode is a small pictogram built from the graph's
own vocabulary — a solid node is shown, a dashed ring or a dashed outlined node is
held back, an arrowhead is
a neighbour appearing, and an extra level of nodes marks the recursive mode. A mode
with nothing to do is drawn faded and cannot be chosen, so the dial teaches the
whole vocabulary without changing anything.[^controls]

Every directory starts showing **all of its sub-directories and index files and up to 50 of its concepts**, so the structure and its pages are visible to any depth while a folder of files does not flood the graph; a directory that holds only files starts collapsed, with every file held back. The bundle root opens fully. While a **search** or an attribute filter is active the page is set aside — the whole subtree is drawn, so a match inside a collapsed directory is still shown.

[^controls]: See [Controls](controls.md) for the gesture on mouse and touch.

# Reframe and reset

- **Reset view** zooms and pans so the whole graph fits, without moving nodes.
- **Reset layout** runs the layout again from a fresh arrangement. Use it when
  the graph has drifted into a shape you do not like.
- **Reload** re-fetches the bundle from the address the page was opened with.

# Change what is drawn

- **Labels** show or hide the node labels; they are on by default.
- **Tags** add tag-hub nodes so a tag and its concepts cluster together. While it
  is on, the Directory kind is hidden to keep the hubs readable. This is a view
  mode, not a filter, so a tag hub starts with the same page as a directory — its
  index pages and up to 50 concepts — and carries the dashed ring when more are
  held back.

# Connections

- [Find a concept](find-a-concept.md)
- [Read a concept](read-a-concept.md)
- [Graph model](../model/graph-model.md)
- [Force layout](../algorithms/force-layout.md)
- [Controls](controls.md)

[^source]: The pointer, wheel and directory navigation handlers in the tool source.
[^model]: Graph model.
