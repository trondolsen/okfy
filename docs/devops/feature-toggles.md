---
type: Explanation
title: Feature toggles
description: The unreleased and preview flag categories, the single reader that gates a feature, and the browser-persisted switches in .runtime.
tags: [devops, feature-flags, release, preview]
okfx:
  mode: explanation
  version: praxis/1
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – the FEATURES registry, featureOn and .runtime/features.md
---

# What it is

A feature toggle lets one copy of the viewer carry a code path that is not active yet, and lets a reader opt into a preview behaviour without a new build. The flags are compiled into the same single HTML file.[^source]

There are two categories:

- **Unreleased** — hardwired false in the source. The code ships, but `featureOn()` never returns true for it, browser storage is ignored and the interface offers no switch. A later release enables it by changing the source.
- **Preview** — has a default and a switch. A reader changes it on the generated `.runtime/features.md` page; the choice applies at once and is kept in this browser.

See the [feature toggles explainer](attachments/feature-toggles.svg) for the two categories, the registry, the path through a copy and the switches.[^source]

# The registry

Flags live in the `FEATURES` registry in `okfy.html`, split into `unreleased` and `preview`. A preview entry carries a `default`, a `title` and a `description`; an unreleased entry is listed with the value false.

`featureOn(name)` is the only reader. It returns false for an unreleased or unknown name, so a typo, a retired flag and a hardwired flag all fail closed. For a preview name it reads the stored choice, else the default. `setFeature(name, on)` accepts preview names only.

Adding a flag is one registry entry plus a `featureOn(name)` check at the feature boundary. There is no flag service, no environment lookup and no network request: the flags are data in the file.

# The path through a copy

1. **Source** — the registry is part of the HTML. Unreleased entries are false.
2. **Release** — the copy is published as it is; no build step rewrites the flags.
3. **Browser** — the published copy loads and starts the code paths allowed by its flags.
4. **Runtime** — `.runtime/features.md` lists both categories. The preview rows are switches; an unreleased row, when a copy has one, is read-only and shown as hardwired off.
5. **Storage** — a switch writes `okfy.features` in `localStorage` and the feature changes immediately. Only booleans for flags that exist in `preview` are read back, so a stored key for a flag the copy no longer has is ignored.
6. **Reload** — the copy supplies its hardwired unreleased values and the stored preview choices supply the rest. Clearing site data returns every preview flag to its default.

# Operating it

- **Dark launch** — ship a feature behind an unreleased flag: the code is deployed but inert. Enable it by changing the source in a later release.
- **Kill switch** — switch a preview feature off in `.runtime/features.md`; the panel or behaviour disappears at once, without a redeploy.
- **Opt in** — preview defaults decide what a first visit sees; each browser can then choose differently.
- **Roll back** — publish the previous copy, or switch the preview off while the copy stays in place.
- **Retire** — remove the registry entry and its `featureOn()` calls; stored values for the retired name are ignored.

# Safety and limits

A flag is a UI boundary, not a security boundary. Turning a feature off does not relax URL containment, the Content Security Policy, the size limits or the streaming bounds; those apply to every copy and every flag state. Unreleased entries can never be turned on from the interface or from storage, and an unknown name is false. Preview choices stay in this browser and are never sent anywhere.

# Connections

- [Runtime directory](../interface/runtime.md)
- [Assistant](../interface/assistant.md)
- [Local processing](../principles/local-processing.md)
- [Limits and budgets](../security/limits-and-budgets.md)

[^source]: `okfy.html`, the `FEATURES` registry, `featureOn` and the generated `.runtime/features.md` page.
