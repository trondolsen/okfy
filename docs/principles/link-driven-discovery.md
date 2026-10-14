---
type: Principle
title: Link-driven discovery
description: The bundle describes itself through Markdown links from an entry point; there is no manifest.
tags: [principle, crawling, okf, navigation]
okfx:
  mode: explanation
  version: praxis/1
sources:
  - id: readme
    resource: ../../README.md
    title: okfy – README
  - id: source
    resource: ../../okfy.html
    title: okfy.html – crawlFromUrl
---

# Principle

There is no bundle manifest. The tool starts from one file, `index.md` by default, and follows the **Markdown links** in each file it loads.[^readme] The set of reachable files is the bundle.

# Why it matters

- A bundle is portable: its structure lives in the links, so it needs no extra metadata file to copy or publish.
- The graph reflects real references rather than a directory listing.
- Depth is a first-class control: the same bundle can be crawled fully or one level at a time.[^readme]

# Consequences

Discovery order is deterministic, a breadth-first walk from the start file, but the reachable set depends on links, so an unreferenced file is invisible in server mode. Local folders behave differently: the tool reads the whole folder and then shows it level by level, so it can reveal files that no link points to. See [crawling](../algorithms/crawling.md) and [local folders](../interface/local-folders.md).

# Connections

- [Crawling](../algorithms/crawling.md)
- [Graph construction](../algorithms/graph-construction.md)
- [Bundle and concept](../model/bundle-and-concept.md)

[^readme]: Project README, "Bundles are discovered from `index.md` by following links (no manifest)".
[^source]: The crawler `crawlFromUrl` in the tool source.
