---
type: Algorithm
title: Graph construction
description: Turning the loaded file set into directory nodes, concept nodes, tree and reference links, and optional tag hubs.
tags: [algorithm, graph, tags, references]
okfx:
  mode: reference
  version: praxis/1
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – buildGraph
---

# Steps

1. Collect every directory that appears in any file path and create a `dir` node for each; connect each directory to its parent with a **tree** link.[^source]
2. For each file, decide its kind from its name and contents, one of `index`, `concept`, `file` or `attachment`. Parse frontmatter for Markdown files, then connect the file to its directory with a tree link.
3. For each concept, parse its body links and its frontmatter `sources`. A source may name any file, not only Markdown. Resolve each target to a loaded file, else to an unloaded placeholder (an attachment or a non-Markdown file, fetched on click), else to a `missing` candidate for on-demand loading. Create one **ref** link per referencing concept and target pair.
4. If tags are shown or a tag filter is active, build **tag hubs**: one node per tag and per namespace prefix, nested as a hierarchy, with each concept linked to its leaf tag.
5. Compute each node's `degree` from the links.

# Invariants

- Each ordered pair of nodes has at most one ref link; a mutual pair (A links to B and B links to A) is kept as two links but drawn as one bidirectional edge.
- A concept is never linked to itself.
- Embedded images are rendered inline in the preview and get no node.
- Non-Markdown files and attachments are never loaded by construction; whether named by a body link or a `sources[].resource` pointer, they become placeholder nodes.
- Tag hubs exist only while tags are shown or filtered; otherwise the graph is unchanged.

# Failure modes

Graph size is bounded by node and link limits. If a new graph would exceed them, the existing graph is kept and the change is rejected, so a bad bundle cannot replace a good one. See [limits and budgets](../security/limits-and-budgets.md).

# Connections

- [Graph model](../model/graph-model.md)
- [Crawling](crawling.md)
- [Force layout](force-layout.md)

[^source]: `buildGraph` in the tool source.
