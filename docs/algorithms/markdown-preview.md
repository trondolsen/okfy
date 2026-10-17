---
type: Algorithm
title: Markdown preview
description: A bounded, dependency-free renderer that parses raw Markdown and escapes at each output sink.
tags: [algorithm, markdown, rendering, security]
okfx:
  mode: reference
  version: praxis/1
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – renderMarkdown, renderInline
  - id: review
    resource: ../reviews/2026-10-05.md
    title: Security review of okfy (2026-10-05)
---

# Problem

The tool must show a concept's Markdown without a library and without letting a hostile bundle inject markup into the page.[^review]

# Approach

The renderer parses raw syntax and writes escaped text to the correct context, rather than building an HTML string and re-parsing it. Each inline writer escapes text and attribute values at the sink, so generated HTML is never substituted into attributes and cannot create event handlers.[^review] See the [Markdown preview explainer](attachments/markdown-preview.svg) for the pass, the inline tokens, the escaping and the one budget.[^source]

# What it supports

Headings, paragraphs, lists, blockquotes, tables, fenced and inline code, links, footnotes, emphasis, horizontal rules and inline images. A list item may continue on the next line when that line is indented past the marker; the continuation stays inside the same item instead of becoming a new block. Images are attached with a `data-embed` marker first; the source is set later through the DOM only after the resolved URL is validated. A footnote definition renders as a list at the foot of the concept, except that a definition which is nothing but a URL — bare or wrapped in angle brackets — is instead shown at its reference, the end of the sentence, as an inline external-link marker (↗) that opens the URL in a new tab, and is left out of the list.

# Bounds

One shared budget bounds nesting depth, input size, output size and search work. If a limit is exceeded, the preview is replaced with a short "safety limit exceeded" notice instead of rendering partial or pathological output.[^source]

# Failure modes

It is deliberately a bounded renderer, not a full CommonMark implementation. Unusual or pathological input may produce the safety notice rather than a preview. External, `data:` and raw `blob:` images are not shown; images must live in the bundle and be referenced internally.[^review]

# Connections

- [Untrusted bundles](../principles/untrusted-bundles.md)
- [URL and network bounds](../security/url-and-network-bounds.md)
- [Limits and budgets](../security/limits-and-budgets.md)

[^source]: `renderMarkdown` and the markdown helpers in the tool source.
[^review]: Security review, findings A1 and A3.
