---
type: Algorithm
title: Assistant loop
description: The bounded agent loop behind one question — at most eight tool steps, a replayed history that is trimmed and compacted, and a bundle treated as data.
tags: [algorithm, assistant, agent-loop, tools, context]
okfx:
  mode: reference
  version: praxis/1
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – asAgent, asFinalAnswer, asWireMessages and asCompactContext
  - id: assistant
    resource: ../interface/assistant.md
    title: The assistant – Tools, and the agent loop
  - id: limits
    resource: ../security/limits-and-budgets.md
    title: Limits and budgets – the assistant row
---

# Problem

One question may need several lookups before it can be answered, so the assistant runs a loop of requests and tool calls rather than answering once. The panel and the tools themselves are described in [the assistant concept](../interface/assistant.md).[^assistant]

The loop must stay bounded in steps, in the size of the prompt and each result, and in the history it replays — and it must never leave the conversation in a shape a provider rejects.

# Steps

See the [assistant loop explainer](attachments/assistant-loop.svg) for the loop, the message rule, the trimmed history, compaction and the bounds.[^source]

1. Send the replayed messages with the fixed tool schema, an automatic tool choice and, by default, streaming.[^source]
2. Push the reply as an assistant message. If it carries **no tool calls** the turn ends here.
3. Otherwise reserve a reply for **every** call in the same synchronous step as the call, run each tool, and push its result capped to the per-result character limit. A tool that throws still answers its call.[^source]
4. Repeat from step 1, at most **eight** times. At the cap, send one further request **with the tools withheld**, so the model closes with an answer about what it found instead of the turn ending on an error.[^source]
5. Before each request, if the prompt has grown past three quarters of the model's context length, **compact** the older conversation first.[^source]

# The message rule

A tool-call message and its replies must never be split: providers require each call to be followed by exactly its replies. Reserving the replies before any tool runs is what makes that safe even though a tool awaits — the microphone can open a user bubble mid-turn. A **thinking-mode** model's reasoning rides back on every tool-call message and goes out on the next request, and the field is present on every such message — an empty string rather than an omitted field — because those providers reject the next request otherwise.[^source]

# Keeping the history small

Every message is kept, so each tool call still has its reply, but only what is **replayed** is bounded. The most recent few tool results go out in full; an older one is shortened to a leading excerpt, never dropped to a content-free placeholder, so the assistant can still recall what it did. Reasoning from older tool-call rounds is shortened too, while the most recent round's reasoning is kept whole so a thinking-mode model can continue it. When the window still fills, **compaction** summarizes the older turns with one capped request, resumes the replay at the sixth most recent user turn, and carries the summary as a system message, marked in the transcript by a notice. A tool call is never separated from its replies and the in-progress turn is never cut.[^source]

# Invariants

- At most eight tool steps per question, each request under the request timeout and the streamed-byte cap; the prompt and each tool result are capped in characters.
- Each tool-call message is followed by exactly its replies, and a failing tool still answers its call.
- Every message is kept; only the replayed history is trimmed or compacted.
- The bundle is untrusted input: the system prompt tells the model to treat concept text and tool results as data, never as instructions.

# Failure modes

A request past the deadline or over the streamed-byte cap fails and is reported. If the closing tools-withheld request also fails, the turn ends on an error. A session token budget stops a new question once it is spent. See [Assistant data flow](../security/assistant-data-flow.md) for the network and privacy model, and [limits and budgets](../security/limits-and-budgets.md) for the concrete caps.[^limits]

# Connections

- [Assistant](../interface/assistant.md)
- [Assistant data flow](../security/assistant-data-flow.md)
- [Limits and budgets](../security/limits-and-budgets.md)
- [Large language models](large-language-models.md)

[^source]: `asAgent`, `asFinalAnswer`, `asWireMessages` and `asCompactContext` in the tool source.
[^assistant]: The assistant concept, "Tools" and the agent loop.
[^limits]: Limits and budgets, the assistant row.
