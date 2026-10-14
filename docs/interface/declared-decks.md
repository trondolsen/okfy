---
type: Reference
title: Declared decks
description: How each page declares the decks it belongs to in frontmatter, and how the viewer builds them when the bundle loads.
tags: [interface, deck, frontmatter, okfx]
okfx:
  mode: reference
  version: praxis/1
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – applyBundleDecks, declaredDeckSpecs
---

# What it is

A bundle can ship **decks**: groups of concepts the viewer assembles when the
bundle loads, in place of the empty default deck. Each page names the decks it
belongs to, so a reader opens the bundle with a reading list already
assembled.[^source]

# Frontmatter

A page declares its membership under the OKF Praxis extension key `okfx.decks`, a
deck name or a list of deck names:

```yaml
---
type: Guide
title: Explore the graph
okfx:
  mode: how-to
  version: praxis/1
  decks: [Tour]
---
```

```yaml
okfx:
  decks: [Tour, Model]
```

- A deck holds every loaded page whose frontmatter names it; a page may belong to
  several decks. A name no page uses is not a deck.
- Decks are created and filled in as content loads: a deck appears when its first
  member page loads and its remaining members are appended as they load —
  including pages loaded on demand from a dashed node. Each new card fades in rather
  than highlighting. Members keep the bundle's order, and at most eight decks are
  built.
- Decks live in memory only, so editing one in the interface lasts until the
  bundle is loaded again.

# This bundle's decks

The user guides name a **Tour** deck and the model concepts name a **Model** deck,
each from its own frontmatter. A reader who opens the bundle finds both in the deck
panel.

# Connections

- [Deck of cards](deck.md)
- [Interface](index.md)
- [Deck of cards (design)](../design/deck.md)

[^source]: `applyBundleDecks` and `declaredDeckSpecs` in the tool source.
