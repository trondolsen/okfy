---
type: Workflow
title: Local development
description: "How to work on okfy in a local copy: the single file, local Git, the tests, feature flags and keeping unreleased work out of the live copy."
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
  - id: tests
    resource: ../../test/README.md
    title: Test documentation for okfy
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

# Run the tests

Run from the repository root. The Node tests need no npm install:[^tests]

```sh
bash tools/node-cli/run.sh --workdir . -- \
  --test test/unit/security.test.cjs \
  test/unit/assistant.test.cjs \
  test/unit/serve.test.mjs
```

The browser tests use Playwright in a container:[^tests]

```sh
bash tools/playwright-cli/run.sh --workdir . -- \
  node_modules/@playwright/test/cli.js \
  test --config test/playwright.config.cjs
```

The launcher scripts under `tools/` are referenced by the test documentation but are not present in this repository; run these commands where they are available.[^agents] Without Podman, with Node.js 22 or newer on the host, use:[^tests]

```sh
npm install --prefix test
npm --prefix test run test:unit
```

For the browser tests, install Chromium separately and run `npm --prefix test test`.[^tests] The browser tests start their own server on `127.0.0.1:8080`, so stop any other server on that port first.

# Feature flags

An unreleased flag is hardwired false in the `FEATURES` registry. `featureOn()` never returns true for it, browser storage is ignored and the interface offers no switch. A preview flag has a default and a switch on the generated `.runtime/features.md` page; the choice applies at once and is kept in this browser under `okfy.features`.[^source]

Adding a flag is one registry entry plus a `featureOn(name)` check at the feature boundary. A flag is a UI boundary, not a security boundary: turning a feature off does not relax URL containment, the Content Security Policy, the size limits or the streaming bounds. See [Feature toggles](feature-toggles.md).

The documentation carries the same split: `okfx.release: preview` for a preview feature and `okfx.release: unreleased` for one that is withheld. Any other value is discarded, as if the field were absent.

# Draft and live

There is one developer. `draft` is the working branch, `origin-draft` is its backup, and `origin-live` only receives the published copy. The local branches are authoritative, so routine work does not fetch or merge from either remote. Develop and test on `draft`, and move a change to `live` only when it ships.

A preview feature belongs to live: its code is present and a reader can switch it on, and its concept sets `okfx.release: preview`. An unreleased feature stays in draft, with `okfx.release: unreleased`, until its flag is enabled in the source.

# Keep unreleased files out of live

`okfx.release: unreleased` is metadata: neither the viewer nor Git filters a file because of it. The live branch is correct only when its tree contains no unreleased concept. See [About this bundle](../about-this-bundle.md#release-state) for the field.

- Commit an unreleased file on `draft`. An uncommitted file follows you across a branch switch, so it can be added to `live` by accident.
- Do not merge `draft` into `live`. The draft branch carries every unreleased concept, so a merge publishes them.
- Promote only what ships. A single-purpose commit can be cherry-picked:

```sh
git switch live
git cherry-pick <sha>
```

For a file that is wholly release-ready, copy just that file:

```sh
git switch live
git restore --source=draft -- path/to/concept.md
git add path/to/concept.md
git commit -m "docs: publish ..."
```

Do not copy a file that still has `release: unreleased` or that mixes released and unreleased edits. Split the change instead.

- A released concept or index must not link to an unreleased one. Remove those links in the same change that promotes the file.
- A preview concept is allowed on live: `release: preview` ships behind a switch.

Before pushing, check the live tree:

```sh
git grep -n -E '^[[:space:]]+release:[[:space:]]+unreleased' -- docs
```

No output means no unreleased concept is present. Then publish:

```sh
git push origin-live live:main
```

To make the check harder to forget, add a local pre-push hook:

```sh
#!/bin/sh
[ "$1" = "origin-live" ] || exit 0
if git grep -q -E '^[[:space:]]+release:[[:space:]]+unreleased' -- docs; then
  echo "Refusing to push: unreleased concepts are present." >&2
  exit 1
fi
```

Save it as `.git/hooks/pre-push` and make it executable with `chmod +x .git/hooks/pre-push`. The hook is local and can be bypassed, so keep the manual check as the release step.

# Promote a batch

Use a temporary release branch when more than one commit moves to live. It keeps `live` untouched until the batch passes the checks.

List the candidates, oldest first:

```sh
git log --reverse --oneline live..draft
```

Inspect each candidate before choosing it:

```sh
git show --stat <sha>
git show <sha>
```

Classify the commits by the files they change. A commit is skipped when it adds, modifies or deletes a file carrying `okfx.release: unreleased`:

```bash
#!/usr/bin/env bash
set -euo pipefail

base=live
tip=draft
safe_list=.git/safe-commits
: > "$safe_list"

git rev-list --reverse --no-merges "$base".."$tip" | while read -r c; do
  unsafe=
  while IFS= read -r -d '' f; do
    if { git cat-file -e "$c:$f" 2>/dev/null &&
         git show "$c:$f" | grep -qE '^[[:space:]]+release:[[:space:]]+unreleased'; } ||
       { git cat-file -e "$c^:$f" 2>/dev/null &&
         git show "$c^:$f" | grep -qE '^[[:space:]]+release:[[:space:]]+unreleased'; }; then
      unsafe=$f
      break
    fi
  done < <(git diff-tree --no-commit-id --name-only -z -r "$c")

  if [ -n "$unsafe" ]; then
    printf 'SKIP %s  %s  [%s]\n' "$c" "$(git log -1 --format=%s "$c")" "$unsafe"
  else
    printf '%s\n' "$c" >> "$safe_list"
    printf 'SAFE %s  %s\n' "$c" "$(git log -1 --format=%s "$c")"
  fi
done

printf '\nSafe commits: %s\n' "$safe_list"
```

The classifier writes the safe commits to `.git/safe-commits` and prints a `SAFE` or `SKIP` line for each. It checks changed files only, so it does not catch a released file that links to an unreleased concept, a dependency on a skipped commit, or the commit that removes `release: unreleased`; handle those separately. Review the `SAFE` and `SKIP` lines before cherry-picking: the script is conservative, not a substitute for the review above. Run the classification once per release: a cherry-picked commit keeps its original SHA in `draft`, so a later run lists it again.

Create the release branch and cherry-pick the safe list in order:

```sh
git switch --create release/next live
while read -r c; do
  git cherry-pick -x "$c" || break
done < .git/safe-commits
```

If a cherry-pick stops on a conflict, resolve it before continuing with the next hash in `.git/safe-commits`.

Promote only commits that are wholly release-ready. A commit is safe when it touches only released files, adds no `release: unreleased` file and adds no link to one. A commit that also touches an unreleased file is mixed: split it on `draft` first, then cherry-pick only the released part.

For the latest commit, split it with:

```sh
git switch draft
git reset --soft HEAD~1
git restore --staged path/to/unreleased.md
git commit -m "released part"
git add path/to/unreleased.md
git commit -m "unreleased part"
```

For an older commit, use `git rebase -i` and split it there. A released commit must not depend on one left behind.

Verify the release branch with the `git grep` check above, confirm that no released page links to an unreleased concept, and run the tests. Then publish:

```sh
git switch live
git merge --ff-only release/next
git push origin-live live:main
```

Do not `git merge draft`, and do not `git cherry-pick live..draft` without classifying the commits first.

# This page is unreleased

This concept sets `okfx.release: unreleased`, so it is not part of the released bundle and `docs/devops/index.md` does not link to it. When the work it documents ships, remove the field and add the link from the released index in the same change. The rule is in [About this bundle](../about-this-bundle.md#release-state).

# Connections

- [Feature toggles](feature-toggles.md)
- [Test suite](../maintenance/test-suite.md)
- [Publishing](../interface/publishing.md)
- [Local folders](../interface/local-folders.md)
- [About this bundle](../about-this-bundle.md)

[^agents]: Agent instructions, "Project", "Ground rules" and "Tests".
[^readme]: Project README, "In local web-browser" and "URL parameters".
[^tests]: Test documentation, "Run the tests", "Scope and stability" and "Optional run without Podman".
[^source]: `okfy.html`, the `FEATURES` registry, `featureOn` and the generated `.runtime/features.md` page.
[^ignore]: `.gitignore`.
