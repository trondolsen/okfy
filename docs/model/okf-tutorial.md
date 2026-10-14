---
type: Guide
title: An OKF v0.2 tutorial
description: Build a minimal OKF v0.2 bundle by hand and open it, so the format is learned by making one.
tags: [okf, tutorial, format, bundle]
okfx:
  mode: tutorial
  version: praxis/1
  decks: [Model]
sources:
  - id: spec
    resource: https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md
    title: Open Knowledge Format v0.2 specification
  - id: concept
    resource: bundle-and-concept.md
    title: Bundle and concept
---

# What you build

A two-page OKF **bundle** that the viewer draws as a small graph. You make it by hand and open it.

# Steps

1. Make a folder named `hello-okf`.
2. Add `index.md`, the bundle root, with the version in its frontmatter:[^spec]

   ```markdown
   ---
   okf_version: "0.2"
   ---

   # Hello OKF
   ```

3. Add `welcome.md`, your first **concept**. Every concept starts with frontmatter,
   and `type` is the one field it must have:

   ```markdown
   ---
   type: Guide
   title: Welcome
   description: The first concept in this bundle.
   ---

   # Welcome

   This is a concept. Read [the second page](second.md).
   ```

4. Add `second.md` the same way, and link back to `welcome.md`:

   ```markdown
   ---
   type: Reference
   title: Second page
   ---

   # Second page

   Back to [the welcome page](welcome.md).
   ```

5. Open the folder in the viewer: choose **Open folder…** and pick `hello-okf`, or
   drag the folder onto the window.

# What you should see

- The graph shows two **concept** nodes and the link between them.[^concept]
- The folder is the bundle **root**, and each `.md` file is a concept whose id is
  its path without `.md`.
- `index.md` is reserved: it carries the version and is not a concept.
- Click a node to read it in the preview; its link moves to the other page.

# Connections

- [Bundle and concept](bundle-and-concept.md)
- [Graph model](graph-model.md)

[^spec]: Open Knowledge Format v0.2 specification, on the bundle root and `okf_version`.
[^concept]: Bundle and concept.
