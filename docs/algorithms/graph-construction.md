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

See the [graph construction explainer](attachments/graph-construction.svg) for the kinds, the reference edges, the tag hubs and the page each node shows.[^source]

1. Create a `dir` node for every directory implied by a file or a placeholder node — including a directory that holds only files and has no Markdown of its own — and connect each directory to its parent with a **tree** link, creating missing ancestors on demand.[^source]
2. For each file, decide its kind from its name and contents, one of `index`, `concept` or `file`. Parse frontmatter for Markdown files, then connect the file to its directory with a tree link.
3. For each concept, parse its body links and its frontmatter `sources`. A source may name any file, not only Markdown. Resolve each target to a loaded file, else to an unloaded placeholder (a non-Markdown file, fetched on click), else to a `missing` candidate for on-demand loading. Create one **ref** link per referencing concept and target pair.
4. If tags are shown or a tag filter is active, build **tag hubs**: one node per tag and per namespace prefix, nested as a hierarchy, with each concept linked to every hub on its tag's path — the leaf and each namespace prefix — deduplicated per concept, so a namespaced tag leaves no prefix unconnected. Two hubs applied to the same concept are recorded as a **shared-concept pair** for the layout — not a link, so nothing is drawn and no count changes — so tags that share concepts can cluster together.
5. Compute each node's `degree` from the links.
6. Give every directory and tag hub an ordered neighbour list (`kids`: directories, index files, concepts, then files) and a **page** (`shown`): how many neighbours are drawn. A directory's page starts at **all of its child directories and index files plus up to 50 concepts**, so its files stay held back; a tag hub uses the same rule, drawing its index pages first and then up to 50 concept pages; the bundle root opens fully. The reader changes a page through the **expansion dial**, opened by pressing and holding the node.[^source]

# Invariants

- Each ordered pair of nodes has at most one ref link; a mutual pair (A links to B and B links to A) is kept as two links but drawn as one bidirectional edge.
- A concept is never linked to itself.
- Embedded images are rendered inline in the preview and get no node.
- Non-Markdown files are never loaded by construction; whether named by a body link or a `sources[].resource` pointer, they become placeholder nodes.
- Every node has a directory parent: a directory that holds only files still gets its own directory node, so a folder of assets is drawn as one collapsed directory instead of leaving its files at the bundle root.
- Tag hubs exist only while tags are shown or filtered; otherwise the graph is unchanged.
- A directory or tag hub draws only the neighbours within its page; a dashed ring marks the neighbours still held back, and the bundle root always opens fully.
- A search or an attribute filter is a lens that draws the whole focused subtree, so a match inside a directory that has not been expanded yet is still drawn.

# Failure modes

Graph size is bounded by node and link limits. If a new graph would exceed them, the existing graph is kept and the change is rejected, so a bad bundle cannot replace a good one. See [limits and budgets](../security/limits-and-budgets.md).

# Connections

- [Graph model](../model/graph-model.md)
- [Crawling](crawling.md)
- [Force layout](force-layout.md)

[^source]: `buildGraph` in the tool source.
