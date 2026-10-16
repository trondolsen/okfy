---
type: Workflow
title: Build a deck of cards
description: Collect pages into a right-edge deck by press-holding nodes, dragging cards to the drop site, or adding from the preview.
tags: [workflow, deck, cards, interface, how-to]
okfx:
  mode: how-to
  version: praxis/1
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – the deck section
---

# Steps

1. Press and hold a **concept** on the graph for about half a second, without moving it (only concepts can be carded — not directories, index files, files or tags). A card appears under the pointer, ready to drag, and a separate fixed-size drop site appears at the deck to mark where it will land.
2. Drag the card to the right edge and release. The card keeps following the pointer; over a deck's stack the pages below it part to open a gap and the card slots under them at that position, showing where it will land. On release the first card creates the deck, every card **snaps** into that slot, and the deck stays aligned to its column. Release **clear of every stack** — in the deck's column but not over any deck, for example in the gap between two decks, where the drop site turns **dashed** — to start a **new deck** holding just that page instead. When the panel is already **full** or eight decks exist, a release clear of the decks starts nothing.
3. Alternatively, open a concept and choose the add-to-deck handle **⋮** in the preview header. Each deck is shown the way its docked stack looks — **every page** stacked, the first page about a tenth visible and each of the rest a thin sliver, with its **most prominent kind** chip on the top page and its **most prominent tag** chip under the bottom one — with the deck holding the page **ringed in the accent** and the rest **dimmed**. Clicking a highlighted deck **removes** the page from it; clicking a dimmed deck **adds** the page. The menu stays open while you move the page between decks, and closes when you click away, scrolling without a visible scrollbar when the decks outgrow it; the **+** button creates a deck and adds the page to it (disabled once eight decks exist).

# Adding a guide

A multi-page guide — a `Guide`-typed concept that links to two or more other concepts — can be added as a whole from the preview's add-to-deck menu **⋮**: choosing an **empty** deck opens the guide and its pages into it as a sub-deck, while a deck that already holds cards has the guide **appended** as a sub-deck, leaving the rest in place.

# Managing the deck

- Every deck is shown as its own **stack** in the panel, separated by a gap, and every deck looks the same — none is dimmed, and every deck's cards shuffle on hover. Every deck shows the same chips — a kind chip on its top card and a tag chip under its bottom card. The column spans the drop site and scrolls: the stacks sit at its top, with empty scroll room above and below, so the decks can be dragged (anywhere in the column) or scrolled off either edge. It keeps its scroll when it is rebuilt. It shows a small pill on the **top and/or bottom edge** once the first deck's top or the last deck's bottom passes it, pointing to the decks past that edge and counting them.
- The tiny panel-tab-like chip is stuck to the active deck's **current top page** (the first card, sitting on top of it just above its top edge), naming the **most prominent kind** among its pages — the kind on the most cards. A long kind is abbreviated, with its full name on hover. This chip is a plain label, not a control. A second chip hangs under the **bottom page**, right-aligned, with the **most prominent tag** among the pages. Both chips highlight while any card of the deck is pointed at.
- Point into a deck to hover a card: its neighbours above and below repel so the card is partly revealed, and the card keeps its place in the stack while the pointer stays in the deck; only leaving the deck resets the stack. On a touch screen a press-drag over the deck moves that pointer: the card under the finger parts its stack and shows its actions, sliding off the deck clears it, and releasing opens the page, removes it on its **×**, or toggles a sub-deck on its chevron.
- Click a card to read its page fullscreen (see below); if its deck is not active yet, it becomes active first, so one click opens the page.
- Use a sub-deck's chevron to expand or collapse its pages.
- Use a card's `×` to remove it; removing a deck's last card removes the deck (the next deck becomes active), and the add-to-deck menu never lists an empty deck.
- Click a deck's stack to make it the active deck. Start a new one by dragging a card clear of every stack, or with the add-to-deck handle **⋮ → +** in the preview (at most eight decks).

# Reading from the deck

Clicking a card reads the whole deck as one **continuous stream**, fullscreen within the browser window: the pages follow each other in deck order, and the reading page opens as its own layer above the untouched interface.

- The shared top bar follows what you read: it shows the page scrolled into view, with no controls.

- Leave reading by **pulling the top handle — or the top bar — down**. The reading view slides down to reveal the graph and closes once the pull passes a short distance; a shorter pull springs back. **Escape** also closes. There is no click-outside close in reading.

# Notes

The deck lives in memory only. It is not stored in the URL, and it is cleared when a new bundle is loaded.

# Connections

- [Deck of cards](../design/deck.md)
- [Declared decks](declared-decks.md)
- [File, image and media preview](file-preview.md)
- [Local folders](local-folders.md)

[^source]: The deck section of the tool source.
