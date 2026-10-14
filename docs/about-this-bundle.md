---
type: Reference
title: About this bundle
description: The OKF version, the OKF Praxis extension, the scope and the sources of this knowledge bundle.
tags: [okf, meta, bundle]
okfx:
  mode: explanation
  version: praxis/1
sources:
  - id: spec
    resource: https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md
    title: Open Knowledge Format v0.2 specification
  - id: readme
    resource: ../README.md
    title: okfy – README
  - id: source
    resource: ../okfy.html
    title: okfy.html – the tool's source
  - id: review
    resource: reviews/2026-10-05.md
    title: Security review of okfy (2026-10-05)
---

# What this bundle describes

This bundle documents the **okfy**, a single-file browser tool for exploring Open Knowledge Format (OKF) bundles.[^readme] The bundle is itself OKF v0.2, so the tool can open and navigate it.

# Format and extension

The concepts use **OKF v0.2**: UTF-8 Markdown files with YAML frontmatter, where `type` is the only always-required field.[^spec] The bundle also follows the project's **OKF Praxis** extension: every concept sets `okfx.mode` (its Diátaxis mode) and `okfx.version: praxis/1`, and uses the recommended type vocabulary. OKF Praxis is optional and additive, so a reader that does not know it still reads the bundle as plain OKF v0.2.

# Provenance

The concepts are derived from the project's own files, named in each concept's `sources`. The most important are the README, the tool's single HTML file and the security review.[^readme][^source][^review] No concept claims verification it does not have: the `verified` field is absent, so the content is unverified.

# Scope

The knowledge model is `index.md` plus the files under `docs/`. Other Markdown files in the repository, such as `README.md` and the test documentation, are ordinary project documents and are not part of the bundle.

# Connections

- [Bundle and concept](model/bundle-and-concept.md)
- [Source map](maintenance/source-map.md)

[^spec]: Open Knowledge Format v0.2 specification.
[^readme]: Project README.
[^source]: The tool's source file, a single HTML document.
[^review]: Security review, revision 1 to 2-draft.
