---
type: Algorithm
title: Large language models
description: What one call of a language model does — tokens, attention, sampling — and what the harness around it has to supply.
tags: [algorithm, llm, transformer, tokens, sampling]
okfx:
  mode: reference
  version: praxis/1
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – the assistant client, the context assembly and the tool loop
  - id: transformer
    resource: https://arxiv.org/abs/1706.03762
    title: Vaswani et al. – Attention Is All You Need
  - id: gpt3
    resource: https://arxiv.org/abs/2005.14165
    title: Brown et al. – Language Models are Few-Shot Learners
  - id: nucleus
    resource: https://arxiv.org/abs/1904.09751
    title: Holtzman et al. – The Curious Case of Neural Text Degeneration
  - id: tools
    resource: https://platform.openai.com/docs/guides/function-calling
    title: OpenAI – Function calling
---

# Problem

The assistant's answers come from a model the tool does not run. What the model can do in one call, and what therefore has to be supplied around it, follows from how it works: it reads a window of tokens and predicts the next one.[^transformer]

# Steps

See the [large language model explainer](attachments/large-language-models.svg) for the window, one forward pass, sampling, the harness boundary and the round trip.

1. **Assemble the window.** The harness sends the system prompt, the conversation and the tool results. The model has no memory between calls, so the whole window is re-sent every time.[^source]
2. **Tokenise.** The text is split by the model's tokenizer into ids; a token is a subword piece, not a word.
3. **Embed and position.** Each id becomes a learned vector, and a position signal is added, because order carries meaning.[^transformer]
4. **Mix, layer by layer.** Attention weights each position against the ones before it — a causal mask keeps the future out — and a feed-forward network transforms each position on its own. Every block keeps a residual connection and a normalisation.[^transformer]
5. **Score and sample.** The last layer gives one score per token in the vocabulary; a softmax turns the scores into a distribution, and sampling picks one token, with temperature, top-p and top-k reshaping it.[^nucleus]
6. **Append and repeat.** The chosen token joins the window and the model runs again, so a reply is generated one token at a time. Streaming is just those tokens arriving as they are produced; generation stops at an end token, a stop sequence or the output cap.
7. **Call a tool.** A tool call is only text: it names a tool and passes arguments matching that tool's schema. The harness runs it, appends the result and asks again.[^tools][^source]

# The environment

The model cannot read a file, run a command, open a socket or remember an earlier call; it can only turn tokens into tokens. Everything else is the harness: it assembles the context, sends the request to the provider, executes the tool calls, appends the results, and enforces the limits. Nothing the model writes executes on its own.

# What follows from it

- **The window is the whole world.** Anything the harness leaves out does not exist to the model, and anything it puts in is indistinguishable from instructions — which is why bundle text is treated as data.[^assistant] See Assistant data flow.
- **It is a predictor, not a lookup.** It answers from what is in the window, so a claim can be wrong even when the text reads confidently; the tools exist to put facts into the window.[^gpt3]
- **A reply is not deterministic.** Sampling makes the same prompt produce different text; a low temperature narrows the spread but does not fix it.
- **One call is bounded.** The window has a length, the reply has a cap and the loop has a step limit, all enforced by the assistant. See [Limits and budgets](../security/limits-and-budgets.md).

# Connections

- [Limits and budgets](../security/limits-and-budgets.md)

[^source]: `okfy.html`, the assistant section: the context assembly, the request and the tool loop.
[^assistant]: The assistant concept, on providers, models and tools.
[^transformer]: Vaswani et al., "Attention Is All You Need".
[^gpt3]: Brown et al., "Language Models are Few-Shot Learners".
[^nucleus]: Holtzman et al., "The Curious Case of Neural Text Degeneration".
[^tools]: OpenAI, "Function calling".
