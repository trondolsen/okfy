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

# Node attributes

Every node carries `id` and `path`, `kind`, `label`, `type`, `title`, `description`, `tags`, `status`, layout coordinates and a `degree`, the number of connected links. The tool also keeps each concept's raw frontmatter and body for the preview.

# Colour and grouping

Colour encodes the node kind first, then falls back to the concept's `type`; unknown types get a neutral colour. The legend groups nodes by kind and type.[^source]

# Connections

- [Bundle and concept](bundle-and-concept.md)
- [Graph construction](../algorithms/graph-construction.md)
- [Force layout](../algorithms/force-layout.md)

[^source]: `buildGraph`, `colorFor` and `groupOf` in the tool source.
