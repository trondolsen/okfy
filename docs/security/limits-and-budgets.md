---
type: Reference
title: Limits and budgets
description: The concrete caps on files, bytes, graph size, references, images and decompression work.
tags: [security, limits, budgets, reference]
okfx:
  mode: reference
  version: praxis/1
sources:
  - id: review
    resource: ../reviews/2026-10-05.md
    title: Security review of okfy (2026-10-05)
  - id: source
    resource: ../../okfy.html
    title: okfy.html – the config constants
---

# Limits

The tool enforces these caps while loading and rendering a bundle:[^review]

| Area | Limit |
| --- | --- |
| Text file | 512 KiB before full buffering; a non-Markdown text file in a local folder is listed even when larger, and opening it reads a bounded prefix |
| Bundle | 8 000 files and 128 MiB of text bytes |
| Directory listing / graph node | 32 000 |
| Local directory depth | 12; deeper trees are rejected |
| Stored file path | 2 048 characters and 24 path segments |
| Graph links | 80 000 |
| Node fan-out (expansion) | on load a directory draws all of its child directories and index files and up to 50 concepts; one page of 8 neighbours per *Expand more*; a tag hub over 16 neighbours starts as a first page |
| References from a Markdown body | 256 per file; frontmatter `sources` has its own limit of 256 |
| Tags | 64 per file, at most 256 characters and 16 namespace segments per tag |
| HTTP | 4 concurrent requests through body reading; at most 64 pending; 30-second timeout after a slot is granted |
| Crawling / new expansion attempts | at most 8 000 URLs per crawl and 8 000 expansion attempts per bundle |
| Markdown preview | 512 Ki characters in, 2 Mi characters of HTML out, nesting 24 and bounded search work |
| Images | 8 MiB per image, 16 MiB cache including reservations, 64 images per preview |
| Media (audio and video) | 256 MiB per **served** clip, read once and bounded, and never streamed from the network; a served clip over the 32 MiB **decode** bound is played from a blob of its own bytes rather than decoded. A **local** clip streams from an object URL on demand and is not size-limited |
| Subtitle track (WebVTT) | 25 MiB per sibling `.vtt`, read on demand, whole, and shown as plain text; the transcript the track's own page renders is bounded to 2 000 cues and 256 Ki characters |
| Local PDF | whole files up to 16 MiB; otherwise 2 MiB windows from the start and end |
| HTTP PDF | 512 KiB per start and end response, whether or not the server honours Range |
| PDF decompression | 8 MiB of object-stream text including delimiters; at most 200 streams attempted |
| Assistant | 8 000 input characters, 8 tool steps per question, 12 000 characters per tool result, 20 matches and 240 characters per match for a text query, 4 MiB of streamed reply, 120-second request timeout; the replayed history keeps the most recent 8 tool results in full and shortens older tool-call reasoning to 2 000 characters; when the prompt nears the context length the older conversation is summarized into a compacted recap that replaces the dropped turns, the summary reply capped at 800 tokens; the realtime transcription send queue is capped at 64 000 bytes and paced at the audio's own rate |

# What the limits do and do not guarantee

The bounds limit raw content and the records held in the structures above. They are **not** a guarantee of a specific maximum heap or CPU use in the browser, and the image limits bound compressed bytes, not decoded pixels. Audio is the same: a clip read whole and decoded expands in memory as 32-bit samples — about 21 MB per minute of stereo 44.1 kHz audio — which is why the decode bound (32 MiB) is lower than the read bound for a served clip (256 MiB). A clip over the decode bound is played streamed instead of decoded, so a long clip is never expanded as samples.[^review]

# Behaviour

Reaching a limit rejects the load or the growth with a message, and keeps any previously loaded bundle usable. Some features change as a result: very large local files are skipped, a large HTTP PDF on a server without Range support may have no metadata, and external and data-URI images do not load.[^review]

# Connections

- [Untrusted bundles](../principles/untrusted-bundles.md)
- [Markdown preview](../algorithms/markdown-preview.md)
- [URL and network bounds](url-and-network-bounds.md)
- [Bounded streaming and reserved capacity](streaming-and-budgets.md)
- [Assistant data flow](assistant-data-flow.md)
- [Residual risk](residual-risk.md)

[^review]: Security review, "Limits in revision 2-draft" and "Behavior changes".
[^source]: The `MAX_*` constants in the tool source.
