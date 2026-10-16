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

# Reframe and reset

- **Reset view** zooms and pans so the whole graph fits, without moving nodes.
- **Reset layout** runs the layout again from a fresh arrangement. Use it when
  the graph has drifted into a shape you do not like.
- **Reload** re-fetches the bundle from the address the page was opened with.

# Change what is drawn

- **Labels** show or hide the node labels; they are on by default.
- **Tags** add tag-hub nodes so a tag and its concepts cluster together. While it
  is on, the Directory kind is hidden to keep the hubs readable.

# Connections

- [Find a concept](find-a-concept.md)
- [Read a concept](read-a-concept.md)
- [Graph model](../model/graph-model.md)
- [Force layout](../algorithms/force-layout.md)
- [Controls](controls.md)

[^source]: The pointer, wheel and directory navigation handlers in the tool source.
[^model]: Graph model.
