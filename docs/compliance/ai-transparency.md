---
type: Reference
title: AI transparency
description: How okfy's optional AI assistant and its AI-assisted content relate to the transparency rules for AI systems.
tags: [compliance, ai, transparency, assistant]
okfx:
  mode: reference
  version: praxis/1
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – the tool's source
  - id: transparency
    resource: ../../TRANSPARENCY.md
    title: okfy – AI transparency statement
  - id: readme
    resource: ../../README.md
    title: okfy – README
  - id: ai-act
    resource: https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50
    title: EU AI Act, Article 50 – transparency obligations
  - id: eu-guidelines
    resource: https://digital-strategy.ec.europa.eu/en/policies/guidelines-ai-transparency-obligations
    title: European Commission – guidelines on AI transparency obligations
  - id: nkom
    resource: https://nkom.no/ki/i-et-notteskall
    title: Nkom – KI-loven i et nøtteskall
  - id: datatilsynet
    resource: https://www.datatilsynet.no/regelverk-og-verktoy/rapporter-og-utredninger/kunstig-intelligens/anbefalinger/
    title: Datatilsynet – anbefalinger for utvikling og bruk av KI
---

# What is AI in okfy

The viewer itself is not an AI system. It is deterministic, local software that renders Markdown and a graph, and it runs entirely in the browser.[^source] Two things bring AI in: the optional **assistant** you can chat with, and the AI-assisted way the tool and its documentation are developed.[^transparency]

# The assistant is a limited-risk AI system

The assistant is an interactive, generative system backed by an external language model that the user configures.[^source] In the AI Act's risk tiers it is **limited risk** — a chatbot — so the obligations are those of transparency, not the heavier requirements for high-risk systems.[^nkom] The project is the provider and deployer of the assistant feature; the model vendor is the upstream general-purpose-AI provider.[^eu-guidelines]

# What the transparency rules ask for

- Article 50 of the AI Act, applicable from 2 August 2026, requires that people are informed when they interact directly with an AI system, that AI-generated content is marked and detectable, and that deployers disclose deepfakes and AI-generated text published to inform the public on matters of public interest without human review; the information must be clear, distinguishable and accessible.[^ai-act]
- Norway adopts the AI Act through the **KI-loven**; Nkom summarises the risk tiers and the duty to inform users, and notes that limited-risk systems such as chatbots require clear labelling and information to users.[^nkom]
- The Commission's guidelines clarify who is a provider or a deployer and how compliance can be shown — through a code of practice for AI-generated content, or by other equivalently adequate means.[^eu-guidelines]
- Datatilsynet's recommendations add the privacy duties — information, documented safeguards and individual rights — for systems that process personal data.[^datatilsynet]

# What okfy discloses

- The **About panel** says the tool was generated with AI assistance, asks you to review it before relying on it, and links to the AI transparency statement, which is also embedded as the generated `.runtime/transparency.md` page.[^source][^transparency]
- The **assistant** labels its replies as coming from the assistant, and the README describes the assistant, the providers it can reach, and what leaves the page.[^readme]
- Before a provider model can be configured, the assistant's **Settings** asks you to **acknowledge** what enabling a model means — that okfy is an agent harness, that your prompt and the concepts the tools read go to the provider you configure, and that the model's answers can be wrong and its tool calls act in the viewer — and remembers that choice per browser.[^source]
- The **AI transparency statement** ([`TRANSPARENCY.md`](../../TRANSPARENCY.md)) collects, in one place, the author and contact, the source and the website, the fact that the assistant is an AI system whose answers can be wrong, the data flow, and that no automated decisions are made.[^transparency]
- The **data flow** is documented: okfy sends nothing until a question is asked, and only the provider you configure receives the prompt and the concepts the tools read.[^dataflow]

# Human oversight and no automated decisions

The assistant reads the bundle and, on request, changes what the viewer shows; it makes no decisions about people, and the project's AI-assisted content is reviewed by a human before publication.[^transparency] The viewer has no server and collects no personal data, so a user who configures a provider is the party responsible for that provider call.[^dataflow][^datatilsynet]

# Limits and open points

- This concept records the project's transparency posture. It is not a legal assessment and not legal advice: the AI Act applies from 2 August 2026, and Norway is introducing the KI-loven through the EEA, so the obligations and their timing should be confirmed.[^ai-act][^nkom]
- Machine-readable marking of AI-generated output is primarily a duty on the providers of the generative model; okfy shows the assistant's text in labelled bubbles but does not watermark the model's output.[^ai-act]

# Connections

- [Local processing](../principles/local-processing.md)
- [Untrusted bundles](../principles/untrusted-bundles.md)
- [About this bundle](../about-this-bundle.md)

[^source]: The tool's source file, a single HTML document.
[^transparency]: okfy's AI transparency statement.
[^readme]: Project README.
[^dataflow]: Assistant data flow.
[^ai-act]: EU AI Act, Article 50 – transparency obligations.
[^eu-guidelines]: European Commission – guidelines on AI transparency obligations.
[^nkom]: Nkom – KI-loven i et nøtteskall.
[^datatilsynet]: Datatilsynet – recommendations for developing and using AI.
