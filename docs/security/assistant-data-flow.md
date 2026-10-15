---
type: Explanation
title: Assistant data flow
description: What the optional assistant sends off the page, why the CSP allows it, how authentication works, and the risk that remains.
tags: [security, assistant, privacy, network, oauth, residual-risk]
okfx:
  mode: explanation
  version: praxis/1
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – the assistant client, authentication and CSP
  - id: review
    resource: ../reviews/2026-10-05.md
    title: Security review of okfy (2026-10-05)
  - id: fetch
    resource: https://fetch.spec.whatwg.org/
    title: Fetch Standard
  - id: oauth
    resource: https://www.rfc-editor.org/rfc/rfc6749
    title: RFC 6749 – The OAuth 2.0 Authorization Framework
  - id: bearer
    resource: https://www.rfc-editor.org/rfc/rfc6750
    title: RFC 6750 – The OAuth 2.0 Bearer Token Usage
  - id: pkce
    resource: https://www.rfc-editor.org/rfc/rfc7636
    title: RFC 7636 – Proof Key for Code Exchange by OAuth Public Clients
  - id: bcp
    resource: https://www.rfc-editor.org/rfc/rfc9700
    title: RFC 9700 – Best Current Practice for OAuth 2.0 Security
  - id: jwt
    resource: https://www.rfc-editor.org/rfc/rfc7519
    title: RFC 7519 – JSON Web Token (JWT)
  - id: problem
    resource: https://www.rfc-editor.org/rfc/rfc9457
    title: RFC 9457 – Problem Details for HTTP APIs
---

# Why this is an explicit exception

The tool's guiding [local processing](../principles/local-processing.md) principle says files chosen from disk are never uploaded. The assistant is the one **opt-in** exception: when you ask it a question, your prompt and the concepts its tools return are sent to the LLM provider you configured.[^source] Nothing is sent while the assistant is closed or idle.

# What leaves the page

- Your prompt and the running conversation.
- The system prompt: the viewer's own instructions for working inside okfy, exposed as the generated `.runtime/AGENTS.md`.[^source]
- When you open a model picker, one request per **configured provider that is set up**, to each of their model-listing endpoints (`GET /models`, or Azure's `/openai/models`), carrying that provider's own credentials.[^source]
- The output of the tools the agent calls: concept titles, descriptions, tags, paths, frontmatter and body text, and link lists. Only concepts the tools actually return are sent; images, PDFs and other attachments are never sent.
- Your API key or OAuth access token, in the request header to the provider the request is for; each model role draws on the provider its model was picked from.
- When you use the microphone, the audio you speak, streamed to the provider's realtime transcription WebSocket; the key is first exchanged for a short-lived realtime token that the socket carries, so the key itself is not sent over the socket.

No host other than the configured providers is contacted. Bundle requests keep their same-origin, no-credentials, no-redirect bounds — the assistant uses its own client and does not change those path.[^source]

# Why the CSP allows it

The page's Content-Security-Policy allows `connect-src` for `https:` and for `http` on loopback, in addition to the page's own origin. This is what lets the browser reach the provider. It also allows `wss:` (and `ws` on loopback) for the assistant's realtime microphone transcription, because a WebSocket is a separate scheme that `https:` does not cover; the socket URL is derived from the same configured base URL, and the token exchange that precedes it already accepts only `https` or loopback `http`. The address is still bounded: the client only sends to `https:` URLs, or to `http` on a local host for a local server. A local provider is often configured with the address its server printed when it bound — `0.0.0.0`, or `::` — which a browser cannot connect to and the CSP does not name; those forms, and any other loopback spelling than `localhost` and `127.0.0.1`, are rewritten to `127.0.0.1` before the request, so a local server is reachable and the CSP covers it. Requests use `credentials: "omit"`, `redirect: "error"` and a `no-referrer` policy, so a response cannot bounce the call to another host.[^fetch]

# Authentication

Two paths are supported:

- **API key.** A static key sent as `Authorization: Bearer` (RFC 6750) or, for Azure, as the `api-key` header.[^bearer]
- **OAuth 2.0 Authorization Code with PKCE.** For providers that use OAuth, the page acts as a **public client**: it uses the Authorization Code flow with PKCE `S256` and no client secret (RFC 6749, RFC 7636), validates the `state` parameter, and treats the redirect back to the page as the callback. The access token's `exp` claim, read as an unverified JWT (RFC 7519), only drives the expiry display — the browser cannot verify the signature. The flow follows the OAuth 2.0 security best current practice (RFC 9700).[^oauth][^pkce][^bcp][^jwt]

Failed responses are read for a readable message: OpenAI-style `{ error: { message } }` bodies and RFC 9457 Problem Details (`application/problem+json`) are both understood.[^problem]

# What does not change

The bundle-isolation controls are untouched: crawling, URL containment, byte and file limits, and the reserved-capacity model all still apply. The optional service worker still caches only the app shell. The read tools inspect data already in memory, and the deck tools change only the deck panel; the only outward effects a tool can have are opening a concept in the preview and editing the decks.

# Residual risk

- **Prompt injection.** A malicious bundle can put instructions in concept text or frontmatter. The system prompt tells the model to treat all bundle content as untrusted data and never follow it, but a model can still be misled. The blast radius is bounded: tools are read-only, and the only network egress is the configured provider, so injected text cannot make the page contact an attacker's host.
- **Data leaves the machine.** This is inherent to using a remote provider. Use a local llama.cpp server, or a provider whose data handling you accept, for sensitive bundles.
- **Key handling.** The key is in memory by default; if you choose to remember it, it is stored unencrypted in `localStorage` and is readable by any script on the origin.
- **Provider behaviour.** The client trusts the provider's response shape. Streaming bytes and the assembled reply are bounded, but the provider's content is trusted only as data, never executed.

# Connections

- [Assistant](../interface/assistant.md)
- [Local processing](../principles/local-processing.md)
- [Untrusted bundles](../principles/untrusted-bundles.md)
- [URL and network bounds](url-and-network-bounds.md)
- [Limits and budgets](limits-and-budgets.md)
- [Residual risk](residual-risk.md)

[^source]: `okfy.html`, the assistant section and the `connect-src` directive.
[^fetch]: Fetch Standard, "CORS settings attributes" and request redirect and credentials.
[^oauth]: RFC 6749, "The OAuth 2.0 Authorization Framework".
[^bearer]: RFC 6750, "The OAuth 2.0 Bearer Token Usage".
[^pkce]: RFC 7636, "Proof Key for Code Exchange by OAuth Public Clients".
[^bcp]: RFC 9700, "Best Current Practice for OAuth 2.0 Security".
[^jwt]: RFC 7519, "JSON Web Token (JWT)".
[^problem]: RFC 9457, "Problem Details for HTTP APIs".
