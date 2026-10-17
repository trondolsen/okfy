---
type: Workflow
title: Local development
description: "How to work on okfy in a local copy: the single file, local Git, feature toggles and keeping unreleased work out of the live copy."
tags: [devops, development, workflow]
okfx:
  mode: how-to
  version: praxis/1
  release: unreleased
sources:
  - id: agents
    resource: ../../AGENTS.md
    title: okfy – agent instructions
  - id: readme
    resource: ../../README.md
    title: okfy – README
  - id: source
    resource: ../../okfy.html
    title: okfy.html – the FEATURES registry
  - id: ignore
    resource: ../../.gitignore
    title: okfy – ignored local paths
---

# Goal

Work on the tool and its knowledge bundle in one local copy, check the change in a browser, and keep unreleased work out of the live copy.[^agents][^readme]

# The working copy

`okfy.html` is the whole tool: its CSS and JavaScript are inline, and there is no build step and no runtime dependency. Change that file directly and reload the page; there is nothing to compile or install.[^agents]

The bundle is the page root. Put `okfy.html` beside the bundle's `index.md`, and the tool loads that index and follows its links; there is no manifest and no `bundle` parameter.[^readme]

Opening `okfy.html` from `file://` does not auto-load a bundle. Use the browser's folder picker instead, or serve the repository over HTTP. `depth` applies to a locally opened folder as well.[^readme]

`tmp/`, `.tmp/` and `node_modules/` are ignored, so generated test results and local installs do not enter the bundle.[^ignore]

# Bootstrap local Git

The repository uses two remotes and two local branches. This one-time setup recreates the current local configuration:

| Remote | URL | Push refspec |
| --- | --- | --- |
| `origin-draft` | `https://github.com/trondolsen/okfy-draft.git` | `refs/heads/draft:refs/heads/main` |
| `origin-live` | `https://github.com/trondolsen/okfy.git` | `refs/heads/main:refs/heads/main` |

`draft` tracks `origin-draft/main`; `live` has no upstream. `remote.pushDefault` is `origin-draft`, and the draft push refspec maps `draft` to the remote's `main`, so a plain `git push` from `draft` updates `origin-draft/main`.

Clone the public live repository, then add the draft remote and recreate the branches:

```sh
git clone https://github.com/trondolsen/okfy.git okfy
cd okfy
git remote rename origin origin-live
git remote add origin-draft https://github.com/trondolsen/okfy-draft.git
git fetch origin-draft
git switch --create draft --track origin-draft/main
git branch --move main live
git branch --unset-upstream live
git config remote.pushDefault origin-draft
git config remote.origin-draft.push refs/heads/draft:refs/heads/main
git config remote.origin-live.push refs/heads/main:refs/heads/main
```

`origin-live` is public; `origin-draft` needs your GitHub credentials, so the fetch may prompt. The clone checks out `main`; the commands rename it to `live` and leave it without an upstream, matching the current branch names and tracking. `draft` is checked out and tracks `origin-draft/main`.

The `origin-live` push refspec names a local `main`, which does not exist in this setup. Push `live` explicitly:

```sh
git push origin-live live:main
```

Check the result with `git remote -v` and `git branch -vv`: `draft` should track `origin-draft/main`, and `live` should have no upstream.

# Workflow

There is one developer, and the local branches are authoritative.

- Development happens on `draft`.
- Feature branches are merged into `draft`.
- `draft` is pushed to `origin-draft` as a backup.
- When a release is made, `draft` is merged into `live`.
- `live` is pushed to `origin-live` as the published copy.

A preview feature belongs to live: its code is present and a reader can switch it on, and its concept sets `okfx.release: preview`. An unreleased feature carries `okfx.release: unreleased` until its toggle is enabled in the source.

# Feature toggles

An unreleased toggle is hardwired false in the `FEATURES` registry. `featureOn()` never returns true for it, browser storage is ignored and the interface offers no switch. A preview toggle has a switch on the generated `.runtime/features.md` page and applies its stored choice, its default, or off when it is opt-in; the choice is kept in this browser under `okfy.features`.[^source]

Adding a toggle is one registry entry plus a `featureOn(name)` check at the feature boundary. A toggle is a UI boundary, not a security boundary: turning a feature off does not relax URL containment, the Content Security Policy, the size limits or the streaming bounds. See [Feature toggles](feature-toggles.md).

The documentation carries the same split: `okfx.release: preview` for a preview feature and `okfx.release: unreleased` for one that is withheld. Any other value is discarded, as if the field were absent.

# This page is unreleased

This concept sets `okfx.release: unreleased`, so it is not part of the release and `docs/devops/index.md` does not link to it. Keep it out of the release merge until the work it documents ships; then remove the field and add the link from the released index in the same change. The rule is in [About this bundle](../about-this-bundle.md#release-state).

# Connections

- [Feature toggles](feature-toggles.md)
- [Test suite](../maintenance/test-suite.md)
- [Publishing](../interface/publishing.md)
- [Local folders](../interface/local-folders.md)
- [About this bundle](../about-this-bundle.md)

[^agents]: Agent instructions, "Project", "Ground rules" and "Tests".
[^readme]: Project README, "In local web-browser" and "URL parameters".
[^source]: `okfy.html`, the `FEATURES` registry, `featureOn` and the generated `.runtime/features.md` page.
[^ignore]: `.gitignore`.
