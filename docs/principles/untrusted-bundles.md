---
type: Principle
title: Untrusted bundles
description: A bundle is untrusted input; the tool bounds work and network access instead of trusting contents.
tags: [principle, security, defense-in-depth]
okfx:
  mode: explanation
  version: praxis/1
sources:
  - id: review
    resource: ../reviews/2026-10-05.md
    title: Security review of okfy (2026-10-05)
  - id: readme
    resource: ../../README.md
    title: okfy – README
---

# Principle

A bundle may come from anywhere: a folder the user picked, a drag-and-drop, or a website. The tool therefore treats a bundle as **untrusted data** and assumes its Markdown, frontmatter, links, images and attachments may be malformed or deliberately hostile.[^review]

# Defense in depth

No single control is trusted to be sufficient. The tool combines several layers:[^review]

- It parses raw Markdown and escapes at each output sink, so generated HTML is never re-parsed or substituted into attributes.
- It bounds URLs to the selected bundle root and the page's own origin.
- It caps files, bytes, graph size, references, images and decompression work.
- It ties preview state and loaded resources to the current bundle generation, so switching bundles cannot show stale content.

# Why not simply disable the risky features

The tool keeps inline images, footnotes, tables and on-demand loading because they are the point of exploring a bundle. The response is to make each feature safe within a bound, not to remove it. The cost is extra complexity and a set of documented behaviour changes.[^review]

# Connections

- [URL and network bounds](../security/url-and-network-bounds.md)
- [Bounded streaming and reserved capacity](../security/streaming-and-budgets.md)
- [Resource lifecycle](../security/resource-lifecycle.md)
- [Limits and budgets](../security/limits-and-budgets.md)
- [Markdown preview](../algorithms/markdown-preview.md)

[^review]: Security review, "Findings and fixes" and "Limits in revision 2-draft".
[^readme]: Project README.
