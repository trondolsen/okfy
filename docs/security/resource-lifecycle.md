---
type: Protocol
title: Resource lifecycle
description: Rules that tie images, previews and requests to the current bundle generation and release them on switch.
tags: [security, lifecycle, blob, cache, bundle-switch]
okfx:
  mode: reference
  version: praxis/1
sources:
  - id: review
    resource: ../reviews/2026-10-05.md
    title: Security review of okfy (2026-10-05)
  - id: source
    resource: ../../okfy.html
    title: okfy.html – blobUrlFor, resetBundleResources, load
---

# Problem

A single-page tool reuses the same DOM and cache across bundles. If a resource is keyed only by file path, a new bundle can show a previous bundle's image, text or metadata, and memory can grow without bound.[^review] See the [resource lifecycle explainer](attachments/resource-lifecycle.svg) for the generation, the rules, the teardown and the refused late result.

# Rules

- **Key the cache to the current blob.** Blob URLs are tied to the blob that produced them, not reused by path across bundles, and they are revoked when replaced or when the bundle changes.[^source]
- **Check the generation.** Asynchronous previews and metadata callbacks verify the render ID and bundle generation before they apply their result.
- **Carry the generation in history.** Preview history records the bundle generation, so an old entry cannot point into a new bundle.
- **Number full loads.** A request number makes an older HTTP result lose to a newer selected bundle.
- **Build first, publish last.** A graph is built in private structures, and the previous state is replaced only if the whole build succeeds.
- **Roll back rejected growth.** A rejected expansion does not change the installed file set, and a new file load is rolled back.[^review]

# Invariants

- No preview, image or metadata from one generation is shown in another.
- Rejected or cancelled work frees its reservations and leaves the current bundle usable.

# Failure modes

If a stale callback or a late response were accepted, the user could see content that does not belong to the open bundle. The rules above reject that work instead.

# Connections

- [Bounded streaming and reserved capacity](streaming-and-budgets.md)
- [Untrusted bundles](../principles/untrusted-bundles.md)
- [Graph construction](../algorithms/graph-construction.md)

[^review]: Security review, finding A6 and "State and integration".
[^source]: `blobUrlFor`, `resetBundleResources` and `load` in the tool source.
