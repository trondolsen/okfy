# AI transparency

okfy is an open-source, non-commercial tool for exploring Open Knowledge Format
(OKF) bundles. It is developed with AI assistance, under the instruction and review
of Trond Olsen (Mastodon: [@trond@sorbit.no](https://sorbit.no/@trond)).

- Source: [github.com/trondolsen/okfy](https://github.com/trondolsen/okfy)
- Hosted at: [okfy.no](https://www.okfy.no/) (registered in Norway, hosted in Germany)

## The assistant is an AI system

okfy includes an optional **assistant**. It is an AI system: when you chat with it,
you interact with a large language model through a provider you configure (DeepSeek,
Mistral, Azure OpenAI, a local llama.cpp server or any OpenAI-compatible endpoint).

- Its written and spoken answers are **AI-generated and can be incomplete or wrong**.
  Check them against the concepts they cite before you rely on them.
- okfy sends nothing until you ask a question, or open the model field's picker to
  list the provider's own models.
- Your prompt and the concepts the tools read go only to the provider you configure,
  under your own key. okfy has no server and keeps no copy. See
  [Assistant data flow](docs/security/assistant-data-flow.md).
- okfy makes **no automated decisions** about you. The assistant reads the bundle
  and, on your request, changes what the viewer shows; you stay in control of the
  viewer and of the model settings.

## AI-assisted content

The project's code and its documentation are written with AI assistance and
**reviewed by a human before publication**. The tool states this in its About panel,
which links here. AI-generated text is not published as authoritative information on
matters of public interest without that human review.

## Contact and liability

okfy runs entirely in your browser and does not collect personal data about you.
Questions about this statement, or a request relating to it, go to Trond Olsen:
[@trond@sorbit.no](https://sorbit.no/@trond). Limitation of liability applies as set
out in the terms of service.

---

This statement supports the transparency obligations for AI systems in Article 50 of
the EU AI Act (applicable from 2 August 2026) and the Norwegian KI-loven. It is not
legal advice.
