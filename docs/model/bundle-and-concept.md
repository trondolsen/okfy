---
type: Reference
title: Bundle and concept
description: The OKF building blocks the tool reads, namely the bundle root, concept files, frontmatter and reserved index files.
tags: [okf, bundle, concept, frontmatter]
okfx:
  mode: reference
  version: praxis/1
  decks: [Model]
sources:
  - id: spec
    resource: https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md
    title: Open Knowledge Format v0.2 specification
  - id: source
    resource: ../../okfy.html
    title: okfy.html – parseFrontmatter, buildGraph
---

# Bundle and concept

An OKF **bundle** is a directory tree with one UTF-8 Markdown file per **concept**. A concept's identity is its file path relative to the bundle root, without the `.md` extension. `index.md` and `log.md` are reserved file names, not concepts.[^spec]

# What the tool reads

For every Markdown file the tool extracts two parts:[^source]

- the **frontmatter**, parsed as YAML between two `---` lines;
- the **body**, the remaining Markdown.

It uses these frontmatter fields directly: `type`, `title`, `description`, `tags` and `status`. A file named `index.md` is treated as an index file; every other Markdown file is a concept. Unknown fields are kept but not shown. It also reads `okfx.decks` — each page's deck membership — to build the bundle's decks; see [Declared decks](../interface/declared-decks.md).

# Fallbacks

A concept without a `title` is labelled with its file name. A concept without `type` still appears in the graph under "Other concepts". A missing `status` is not treated as an error.

# Connections

- [Graph model](graph-model.md)
- [Graph construction](../algorithms/graph-construction.md)

[^spec]: OKF v0.2 specification, on bundle structure and reserved names.
[^source]: `parseFrontmatter` and `buildGraph` in the tool source.
