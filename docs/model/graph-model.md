---
type: Data Structure
title: Graph model
description: Nodes for files, directories and tags, plus hierarchy and reference links, and the attributes each node carries.
tags: [graph, data-structure, nodes, links, tags]
okfx:
  mode: reference
  version: praxis/1
  decks: [Model]
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – buildGraph, colorFor, groupOf
---

# Nodes

The graph has several node kinds plus optional tag hubs:[^source]

| Kind | Represents |
| --- | --- |
| `dir` | a directory; the root directory is labelled "bundle" |
| `index` | an `index.md` file |
| `concept` | any other Markdown concept |
| `file` | a non-Markdown text file; shown as a node and read on demand, like an attachment |
| `attachment` | a binary file such as an image, a PDF, or an audio or video clip; shown as a node and never read into the graph, though an image, PDF or media clip is read when its preview is opened |
| `tag` | a tag hub, built only while tags are shown or a tag filter is active |

# Links

Two link kinds connect nodes:[^source]

- **tree** links express directory containment (directory to child directory or file), and the tag namespace hierarchy.
- **ref** links express Markdown references between concepts, plus `sources[].resource` pointers in frontmatter (which may name any file, not only Markdown).

When two concepts link to each other, the pair is drawn as a single **bidirectional** edge — one straight line with an arrowhead at each end — rather than two curves. The model keeps both directions, so each concept's incoming and outgoing counts stay accurate.

An unresolved reference to an attachment or a non-Markdown file appears as a **placeholder** node with no content (drawn with a dashed ring); the tool loads it only when the user asks.

# Expansion

A directory or tag hub draws only a **page** of its neighbours at first: it keeps an ordered neighbour list (directories, index files, concepts, then files and attachments) and a count of how many are drawn. On load a directory draws **all of its child directories and index files and up to 50 concepts**, so its files and attachments stay held back and the directory skeleton and its pages show to every depth; a directory that holds only files therefore starts collapsed, drawn as a hollow directory node of its own. A tag hub opens fully unless it has more than 16 neighbours, when it starts as a first page, and the bundle root always opens fully. A node with neighbours still held back is **filled** and carries a **dashed ring**; a collapsed node (none drawn yet) is drawn **hollow**. A **press-and-hold** opens an expansion **dial** of four modes — Expand all, Recursive expand all, Collapsed and Expand more — drawn as graph pictograms, and the reader drags to one and releases to apply it; a plain click keeps the node's own action. The page survives a rebuild and resets when a new bundle is loaded. A **search** or an **attribute filter** is a lens: while one is active the whole focused subtree is drawn, so a match inside a directory that has not been expanded is still shown, and the toolbar's file and link totals count that scoped subtree rather than the page. See [Explore the graph](../guides/explore-the-graph.md).

# Node attributes

Every node carries `id` and `path`, `kind`, `label`, `type`, `title`, `description`, `tags`, `status`, layout coordinates and a `degree`, the number of connected links. The tool also keeps each concept's raw frontmatter and body for the preview.

# Colour and grouping

Colour encodes the node kind first, then falls back to the concept's `type`; unknown types get a neutral colour. The legend groups nodes by kind and type.[^source]

# Connections

- [Bundle and concept](bundle-and-concept.md)
- [Graph construction](../algorithms/graph-construction.md)
- [Force layout](../algorithms/force-layout.md)

[^source]: `buildGraph`, `colorFor` and `groupOf` in the tool source.
