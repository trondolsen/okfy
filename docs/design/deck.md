---
type: Reference
title: Deck of cards
description: The floating right-edge deck of small page cards, their drop placement and hover shuffle, the page screenshots and the guide sub-decks.
tags: [design, deck, cards, interface, layout]
okfx:
  mode: reference
  version: praxis/1
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – the deck section
---

# Overview

The **deck** is an optional set of cards on the right edge that holds **concepts**. Only a concept can be carded — a directory, index file, file or tag cannot — and it is built from the graph or the preview, staying out of the way until it has a card. The deck has **no panel**: the cards float over the canvas with only their shadows. A tiny, panel-tab-like **title chip** is stuck to the active deck's **current top page** — a child of the first card, sitting on top of it just above its top edge — so it rides that card when the stack shuffles and follows whichever page becomes the top. It names the **most prominent kind** among the pages the deck holds (the kind that appears on the most cards). A long kind is abbreviated to keep the chip small, with its full name shown on hover. A second chip, hanging under the deck's **bottom page** and aligned to the right side, names the **most prominent tag** among those pages (the tag on the most cards). Both chips highlight while any card of the deck is pointed at, so the deck's kind and tag read together from whichever card the pointer is on. Beside it, a separate **fixed-size** drop site marks where a dragged card lands: it does not resize with the deck, reaches from near the top of the window down near its bottom, and is shown for the whole drag (whether the deck is empty or already holds cards). Several decks can be kept at once: each is a separate **stack** in the panel, set apart by a gap, anchored to the bottom of the drop site so a new deck enters at the bottom, with the **active** one live and the rest dimmed. The deck is the only place where several pages are shown together at once.

# Cards

A card is a small, **A4-proportioned** portrait slip that shows one whole page, and nothing else:[^source]

- The **screenshot** of the page's top-left, at the normal preview size, filling the card; there is no header.
- A **remove** button (`×`) and, for a sub-deck, an expand chevron — bare glyphs over the page image that appear on card hover; the remove button just reddens its glyph on hover (no highlight), while the chevron gains a round accent highlight.
- Clicking a card opens the page in the full preview.

The card dragged from a concept is a **real card**, not a simplified stand-in, so it looks identical to a docked card while it is moved. It keeps following the pointer for the whole drag and only docks when it is released. On touch, the press-hold that starts the grab also suppresses the browser's context menu on the canvas, so a long press cannot interrupt the drag.

# Placement and hover

Cards sit in tightly spaced vertical slots, so they overlap down to a header strip, and a dropped page **snaps** into the slot nearest where it was released. Each card's stacking order follows its slot, so a card covers the one above it and is covered by the one below.

Hovering a card **shuffles** the deck vertically: the cards above it nudge up and the cards below it nudge down, so they part around it. The hovered card keeps its place in the stacking order rather than being raised, so it never covers the pages below it. It gains an accent glow, and the highlight is kept while the pointer stays anywhere in the deck — the cards do not fill its column, so the gaps between them do not drop it, and only leaving the deck resets the stack. The shuffle is vertical only. On a touch screen, where there is no hover, a **press-drag** over the deck moves a hover-like pointer: the card under the finger parts its stack and shows its actions, and sliding off the deck clears it. Releasing acts on the card under the finger — its page opens, its **×** removes it from the deck, and a sub-deck's chevron toggles it.

While a page is **dragged** over the decks, the dragged card **keeps following the pointer** and is not docked until it is released. A separate, fixed-size drop site is shown for the whole drag: it is dim while the card is outside it and **lightens while the card is inside it**, so the drop site is always visible and reads as active when it can receive the card. While the card is inside the drop site, the docked decks **scroll** as the pointer nears the panel's top or bottom, or with the wheel, so a deck scrolled out of view can still be reached. The card lands in whichever deck's stack the pointer is over, and takes the **stacking order of the slot it would land in** in that stack, so the pages below that slot cover it and the pages above it stay behind — the dragged card reads as being in that deck while it still tracks the pointer. Those pages also **shift down one step**, opening its place. A drag owns the deck while it lasts, so hovering cannot shuffle the stack under it.

A release **clear of every stack** — in the deck's column but not over any deck, for example in the gap between two decks — does not join a deck: it starts a **new deck** holding just that page, which becomes the active deck and is brought into view. The drop site marks this by turning **dashed**, so the two outcomes are told apart before the drop. The column scrolls, so a new deck always has room; only the cap of **eight decks** stops a release clear of the decks from starting one, in which case the card is not docked.

A card that joins a deck gets a brief cue, so the addition is noticed without a jump. A dropped or preview-added card gets an **accent pulse** (a ring that fades in and out over about 0.7 s); a card added automatically as a declared deck's pages load instead **fades in**.

# Page screenshot

A card shows a **screenshot** of its page rather than live HTML. The page is rendered offscreen with the same bounded Markdown renderer, the same content the preview builds (the page title, the frontmatter chips, then the rendered Markdown) and the tool's **own stylesheet**, drawn into an SVG `foreignObject`, and rasterised to a canvas. It fills a viewport of the **normal preview size** — `min(840px, 92vw)` by `min(82vh, 940px)` — anchored at the top-left, so it wraps and reads the same as when the preview opens it. That viewport is then anchored into the card's top-left, filling the card and cropping the overflow on the right. The page title is set about **three times** the body size. Images embedded in a page are not drawn, because an SVG loaded as an image does not fetch external resources. The bitmap is generated when the card is created, so a card always carries its page image.

# Sub-decks

When a multi-page guide is added as a **sub-deck**, the guide becomes one card whose pages appear as nested cards. The chevron expands and collapses the pages in place. A sub-deck is the way the deck holds a guide and its pages together, rather than as unrelated cards.

# Multiple decks

Up to **eight** decks can be kept at once. Every deck is shown as its own **stack** in the panel, separated by a gap, and every deck looks the same — none is dimmed. Every deck's cards **shuffle on hover**, and a dragged card lands in whichever deck's stack it is over. Every deck carries the same two chips — a **kind chip** on its top card and, when the deck has one, a **tag chip** under its bottom card. The deck column spans the drop site and is a fixed scroll area: the stacks sit at its top, with empty scroll room both above and below, so the decks can be dragged (anywhere in the column) or scrolled off either edge even when they are shorter than the column. It **scrolls** with no visible scrollbar and keeps its scroll when it is rebuilt (and returns to home when it empties, so the next deck it shows is in view). A small accent pill appears on the panel's **top edge** once the first deck's top passes it, and on its **bottom edge** once the last deck's bottom passes it, pointing toward the decks past that edge and counting them. The **kind chip** is a plain label, not a control: a click on a card opens its page, making that deck active first, while a click on a deck's **stack** around the cards makes it active without opening a page; a new deck is started by dropping a card clear of every stack, or with the preview's add-to-deck handle **⋮ → +**.

In the preview, the add-to-deck handle **⋮** opens a menu of the decks, plus a **+** button for a new one. Each deck is shown the way its docked stack looks: **every page** stacked, the first page showing about a tenth of its height and each of the rest a thin sliver, with its **most prominent kind** chip on the top page and its **most prominent tag** chip under the bottom one — falling back to the deck's ordinal name when it holds nothing recognisable. The deck that already holds the page is **ringed in the accent** and the rest **dimmed**. The menu stays open while you choose, so the page can be moved between decks in one go: clicking a highlighted deck **removes** the page from it, clicking a dimmed deck **adds** the page and makes that deck active, and the **+** button creates a deck and adds the page to it (disabled once eight decks exist). It closes only when the pointer is clicked outside it, and scrolls—without a visible scrollbar—when the decks outgrow it. A multi-page guide added to an empty deck opens into it as a sub-deck.

A deck holds no cards only when it is the last one left: removing a deck's last card removes the deck, and the add-to-deck menu never shows an empty deck. If the emptied deck was the active one, the next deck becomes active; when no deck is left, a single empty one stands ready for the next card.

# Reading from the deck

Opening a page from a deck card reads the whole deck as one **continuous stream**, fullscreen within the browser window: the decked pages follow each other in deck order, each as a section under a shared **top bar** that shows the page scrolled into view. The stream reads as a **centred column** (about 720px wide) with no visible scrollbar. The reading page opens as its own top layer, and the interface is left untouched beneath it rather than being hidden or minimized, while the docked deck also keeps its dock, below the page. No OS fullscreen is requested, and small screens read the same way as desktop.

The reading top bar keeps only the current page (title and path): the history controls, the add-to-deck handle and the close button are not shown, and a small **grabber pill** sits at the top edge. Reading is left by **pulling the top handle — or the top bar — down**, which slides the reading view down to reveal the graph behind and closes once the pull passes a short distance; a shorter pull springs back. **Escape** also leaves reading. Reading is the **user's to leave**: the assistant's viewer tools decline to close it or step out of it, so a turn never tears down the page being read, and the deck being read is **locked** while it is open — a change would rebuild the stream and reset the reader's place. There is no click-outside close in reading, and the handle is clear of the text, so a pull is never taken for a text selection.

# Placement

The deck floats at the right edge with no panel of its own; the toolbar, spinner and filter sidebar are unaffected. Its empty space is dragged to **scroll** the docked decks, rather than reaching the graph behind it. Its drop site is a separate rectangle that marks where a dragged card lands for the whole drag, whether the deck is empty or already holds cards; on every screen it reaches **from near the top of the window down near its bottom**, so there is room to drop above the tab and clear of the decks to start a new one. On desktop it **docks to the left of the filter sidebar** when that panel is open, and to the **right edge** when the sidebar is hidden, with its content clearing the **Filters tab** (so the tab stays visible as the sidebar's handle) and, when the assistant panel is open, the **Assistant tab** above it. On small screens it takes the same window column, narrower and clearing the **stacked toolbar** instead of the tabs. On every screen the deck column is a fixed scroll area spanning the drop site: the docked decks sit at its top with empty scroll room above and below, so they can be dragged anywhere in the column or scrolled off either edge. The preview overlay sits above the deck; while reading from the deck the deck stays in its dock, below the reading page, so the page is unobstructed. The filter sidebar also sits above the deck, and on small screens the legend panel does too, so neither panel is covered by the deck. Hovering is a pointer gesture; on a touch screen a press-drag over the deck moves that pointer and acts on release instead, and that gesture does not scroll the panel.

# Connections

- [Interface design](interface-design.md)
- [Build a deck](../interface/deck.md)
- [Graph model](../model/graph-model.md)
- [Markdown preview](../algorithms/markdown-preview.md)

[^source]: The deck section of the tool source.
