---
type: Reference
title: Chapters
description: A reading order declared in frontmatter, naming the previous and next chapter.
tags: [model, chapters, navigation, okfx]
okfx:
  mode: reference
  version: praxis/1
sources:
  - id: spec
    resource: https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md
    title: Open Knowledge Format v0.2 specification
---

# What a chapter is

A **chapter** is a whole concept that names the concept before and after it in a
reading order. The order is a flat chain: each concept names at most one previous
and one next chapter, and the two ends name only one neighbour.

# Frontmatter

A concept declares its neighbours under the OKF Praxis extension key
`okfx.chapter`:[^spec]

```yaml
---
type: Guide
title: Explore the graph
okfx:
  mode: how-to
  version: praxis/1
  chapter:
    previous: docs/guides/getting-started.md
    next: docs/guides/find-a-concept.md
---
```

- Each value is a path to a concept file: a bare or `/`-prefixed path is relative
  to the bundle root, a `./` or `../` path is relative to the file, and the `.md`
  extension is optional.
- `okfx.chapter` is part of OKF Praxis, so a reader that does not know the
  extension ignores it and still reads the concept as plain OKF v0.2.

# Status

The viewer does not act on `okfx.chapter`: it neither follows the paths nor shows
chapter controls. The bundle declares the order ahead of the handling, which will
be specified separately.

# Connections

- [Bundle and concept](bundle-and-concept.md)
- [Graph model](graph-model.md)
- [User guides](../guides/index.md)

[^spec]: OKF v0.2 specification, on extension keys in frontmatter.
