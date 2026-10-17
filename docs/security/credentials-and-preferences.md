---
type: Protocol
title: Credentials and preferences
description: What the tool writes to the browser — one opt-in secret and a handful of preferences — how it is read back, and what it refuses to store.
tags: [security, storage, credentials, localstorage, privacy]
okfx:
  mode: reference
  version: praxis/1
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – asLoad, asSave and the storage keys
---

# What is kept

| Key | Holds |
| --- | --- |
| `okfy.assistant` | the assistant's settings; the key and the OAuth token **only when remembering is on** |
| `okfy.assistant.ack` | that the acknowledgement was accepted |
| `okfy.assistant.warn` | the host whose provider notice was dismissed |
| `okfy.volume` | the player volume, clamped to 0 … 1 on the way back in |
| `okfy.lang` | the interface language, checked against the tool's own list |
| `okfy.as.width` | the assistant panel width, clamped to 320 px … 90 % of the window |
| `okfy.as.pkce` | a short-lived OAuth verifier and state, in **sessionStorage**, removed on sign-out |

Six keys in `localStorage` and one in `sessionStorage`: there is no cookie, no IndexedDB and no cache entry of the tool's own.[^source] See the [credentials and preferences explainer](attachments/credentials-and-preferences.svg) for the keys, the one secret, and what is written, read back and never stored.

# The one secret

Everything above is a preference except the **provider key** (and an OAuth access token). A key you type lives in the page's memory by default and is gone when the tab closes. Ticking **Remember the key in this browser** is what stores it, and then it is written **unencrypted** in `localStorage`, so it is readable by any script that runs on the origin. Untick it and save: the next write leaves it out, so the stored copy goes away. Signing out clears the token from storage too.[^assistant]

The consequence is worth stating plainly: the stored key is only as safe as the origin's own script discipline. What keeps that set of scripts at one is that the renderer never turns bundle text into markup — see [Input handling](input-handling.md) — and the policy forbids inline event handlers.

# What is written

`asSave` is an **allowlist**, not a dump of the settings:[^source]

- A fixed field list: the model and its provider, whether to remember the key, streaming, temperature, maximum and reported tokens, the context length, the session budget, speech, the microphone state and the input device.
- Per provider: the base URL, the auth kind, the API version, and the OAuth endpoint, scopes and client ID — endpoints, scopes and a client ID are not secrets, which is why they are stored whether or not the key is.
- The **key** and the **OAuth access token with its expiry** only when remembering is on.

Nothing else in memory is written: the transcript, the tool results, the graph, the decks and the preview history never reach storage. Nor is the **microphone state** — it can be read back, but it is never written — so a reload cannot open the microphone on its own.

# What is read back

`asLoad` **rebuilds** the configuration instead of trusting the blob:[^source]

1. Start from the tool's own defaults.
2. Copy only the field names it knows from the parsed JSON; anything else is ignored.
3. Keep only provider names the tool has, and merge each survivor onto that provider's own defaults.
4. Validate the rest: the language is checked against the tool's list, and the width and the volume are clamped.
5. A parse failure, or a blob that is not what it claims, simply yields the defaults.

Every read and every write is guarded, so a browser that blocks storage — a private window, a full quota — still works: it just remembers nothing.

# What is never stored

No bundle content, no page text or frontmatter, no transcript or tool results, no graph state (expansion pages, focus, preview history) and no deck. Clearing site data, or a private window, therefore forgets everything without leaving a trace of what was read.

# Limits of this control

Storage is per **origin**, so another page served from the same origin can read the same keys; keep a bundle on an origin of its own. And nothing here protects against a script that gets to run on the page — that is the escaping and policy story in [Input handling](input-handling.md).

# Connections

- [Input handling](input-handling.md)
- [Languages](../interface/languages.md)
- [Residual risk](residual-risk.md)

[^source]: `asLoad`, `asSave`, `pvLoadVolume`, `resolveLang`, `asSetWidth` and the storage keys in the tool source.
[^assistant]: The assistant concept, on Settings, providers and key handling.
