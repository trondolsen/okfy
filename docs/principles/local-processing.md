---
type: Principle
title: Local processing
description: All bundle processing happens in the browser; files never leave the machine.
tags: [principle, offline, privacy, static-hosting]
okfx:
  mode: explanation
  version: praxis/1
sources:
  - id: readme
    resource: ../../README.md
    title: okfy – README
  - id: overlay
    resource: ../../okfy.html
    title: okfy.html – overlay text and about panel
---

# Principle

The tool reads, parses, renders and lays out a whole bundle **in the browser**. There is no backend, no build step and no runtime dependency: one HTML file holds the CSS, the JavaScript and the renderer.[^readme] Files chosen from disk are read locally and are not uploaded anywhere.

# Why it matters

- The tool can be published as a single static file, for example on GitHub Pages, and it works offline over `file://`.[^readme]
- It can be installed as an [installable web app](../interface/installable-web-app.md) and start offline from its cached app shell, still without a backend.
- Sensitive or private bundles stay on the machine.
- There is no server to trust with the bundle's contents; the browser is the only execution environment.

# Consequences

Because there is no server, there is also no server-side validation, search index or cache. The tool must do all work in JavaScript, and it must tolerate bundles that are large, malformed or hostile. That constraint leads to [untrusted bundles](untrusted-bundles.md) and to the explicit [limits and budgets](../security/limits-and-budgets.md).

# The one opt-in exception

The optional [assistant](../interface/assistant.md) is the only feature that can send anything off the machine. When the user opens the panel and asks a question, the prompt and the concepts the tools return are sent to the LLM provider the user configured. Nothing is sent while the assistant is closed, and the exception is bounded in [Assistant data flow](../security/assistant-data-flow.md).

# Connections

- [Untrusted bundles](untrusted-bundles.md)
- [URL parameters](../interface/url-parameters.md)
- [Publishing](../interface/publishing.md)
- [Assistant data flow](../security/assistant-data-flow.md)

[^readme]: Project README, "Usage".
