---
type: Reference
title: Runtime directory
description: The synthetic .runtime directory that exposes the running viewer's state as generated Markdown pages.
tags: [interface, runtime, internals]
okfx:
  mode: reference
  version: praxis/1
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – runtime pages and the About panel link
  - id: agents
    resource: https://agents.md/
    title: AGENTS.md – a simple, open format for guiding coding agents
---

# What it is

The viewer adds a synthetic directory, `.runtime/`, that is not part of the bundle. It opens from the **Runtime internals** link in the About panel, and it contains generated Markdown pages that describe the running application:[^source]

- `index.md` – the entry point, with links to the other pages.
- `status.md` – revision, load source, depth limit, graph focus, preview path, search and filters.
- `bundle.md` – the loaded-file and reference-link counts, every file the viewer has loaded with its type, status and tags, and a count of the http/https URL hosts (domains) those files reference.
- `graph.md` – how the graph is composed: nodes and links by kind, and concepts by type.
- `performance.md` – the CPU, GPU, memory, timing and network data the browser exposes, with SVG trend charts.
- `limits.md` – the bounds the viewer enforces, and the budget in use.
- `transparency.md` – the AI transparency statement, embedded as a generated page (a copy of the repository's `TRANSPARENCY.md`).
- `assistant.md` – the built-in assistant's session statistics: the chat and audio providers and models (never the keys), whether audio output and the microphone are on, token usage with the model's maximum output tokens and the session token budget, the bytes sent and received, the transcript and per-tool call counts.
- `AGENTS.md` – the instructions the viewer gives to the assistant on startup,[^source] written in the AGENTS.md convention.[^agents]

# How it behaves

The path uses a dot-directory, which the bundle rules reject, so it can never collide with a bundle file and is never fetched.[^source] The viewer keeps the directory out of the graph until you open it, and re-inserts it after every bundle rebuild so its pages stay reachable.

The pages are generated at read time and are not written to disk or cached. While a `.runtime` page is open, changing a filter, searching, loading more of the bundle or navigating regenerates it in place, keeping the scroll position, so the page reflects the current state as you read it. The `performance.md` page also refreshes about once a second while it is open and draws its frame rate, JS heap and blocking time as SVG time-series charts — one sample per second, up to a minute, oldest to newest — because those values move continuously. The `assistant.md` page refreshes on the same cadence, so its token and activity totals keep up with a chat in progress. Browsers hide most CPU and GPU accounting, so the performance page reports the closest proxy the browser offers and says when a value is unavailable.

# Connections

- [Interface](index.md)
- [Assistant](assistant.md)
- [URL parameters](url-parameters.md)
- [Limits and budgets](../security/limits-and-budgets.md)

[^source]: `okfy.html`, the runtime pages and the About panel link.
[^agents]: AGENTS.md, a simple, open format for guiding coding agents.
