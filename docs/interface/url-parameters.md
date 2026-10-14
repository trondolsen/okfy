---
type: Interface
title: URL parameters
description: The start and depth query parameters, their values and defaults.
tags: [interface, url, configuration]
okfx:
  mode: reference
  version: praxis/1
sources:
  - id: readme
    resource: ../../README.md
    title: okfy – README
  - id: source
    resource: ../../okfy.html
    title: okfy.html – urlParam, loadBundleFromFolder, autoLoad
---

# Parameters

They are optional; append to the URL and combine as needed, for example `?start=guide.md&depth=1`.[^readme]

| Parameter | Values | Default | Meaning |
| --- | --- | --- | --- |
| `start` | a file inside the root | `index.md` | Crawl entry point. |
| `depth` (or `levels`) | `0` to `n`, or `all` | `all` | Link levels to prefetch. Nodes with unloaded content show a dashed ring and load on click. |

# Rules

- The bundle is the page root: the tool crawls `index.md` beside `okfy.html` and follows links. There is no `bundle` parameter and no manifest to declare a bundle.[^readme]
- `start` must be a **same-origin** path inside the root; a value pointing elsewhere, or outside the root, falls back to `index.md`.[^source]
- On `file://` the tool does not auto-load; the About panel is shown and **Open folder…** in the toolbar opens a local folder instead.[^readme]
- The graph fills in as the crawl loads files, growing in place rather than appearing all at once; see [crawling](../algorithms/crawling.md).
- A `lang` parameter is no longer supported: the language is chosen in the picker and remembered in the browser, and any leftover `lang` in a URL is dropped on load. See [Languages](languages.md).

# Connections

- [Publishing](publishing.md)
- [Local folders](local-folders.md)
- [Languages](languages.md)
- [Crawling](../algorithms/crawling.md)

[^readme]: Project README, "URL parameters".
[^source]: `urlParam`, `loadBundleFromFolder` and `autoLoad` in the tool source.
