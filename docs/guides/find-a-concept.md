---
type: Guide
title: Find a concept
description: Narrow the graph with search, the attribute filters and the legend to find the concepts you want.
tags: [guide, how-to, search, filter]
okfx:
  decks: [Tour]
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – matchesQuery, matchesAttrFilters, buildLegend
  - id: interface
    resource: ../interface/index.md
    title: Interface
---

# Goal

Find one concept, or a group of concepts, without reading the whole graph. The
filters dock at the right; the legend docks at the left.[^interface]

# Search by text

1. Open the **filters** panel and type in **Search**.
2. Matching is a case-insensitive substring match.
3. Use the **in** menu to scope the search to All fields, Title, Description,
   Type, Tags or Path. All fields is the default.

A search — like any attribute filter — draws the whole focused subtree, so a
result inside a directory that has not been expanded yet is still shown.

# Filter by attributes

Each of **Kinds**, **Types**, **Tags** and **Status** has a **Select …** button
that opens a searchable list. Clicking an entry cycles it through three states:[^source]

- **none** — the attribute does not affect the filter;
- **include** (shown with ✓) — keep only nodes with it;
- **exclude** (shown with −) — remove nodes with it.

Choose **Clear** in a list to reset that attribute. Selected attributes also
appear as chips in the panel: click a chip's label to toggle include and exclude,
or its `×` to remove it. Tags nest, so selecting a tag such as `ml` also keeps
its sub-tags such as `ml/vision`.

# Use the legend

The legend lists each group with its colour and count. Click a row to keep only
that group; click more rows to add them, and click a selected row again to clear
it. Hovering a row highlights the group the same way as hovering a node. While a
filter is active, hovering adds to the standing selection instead of replacing
it.

# Clear everything

Choose **Clear filters** at the foot of the panel to drop every search, kind,
type, tag and status selection at once.

While the **Tags** toggle in the toolbar is on, the graph keeps hiding the
directory ring, so that exclusion stays after a clear; turn **Tags** off to bring
the directories back.

# Connections

- [Search and filter controls](controls.md)
- [Explore the graph](explore-the-graph.md)
- [Read a concept](read-a-concept.md)
- [Graph model](../model/graph-model.md)
- [Interface](../interface/index.md)

[^source]: `matchesQuery`, `matchesAttrFilters` and `buildLegend` in the tool source.
[^interface]: Interface overview.
