---
type: Reference
title: Languages
description: How the viewer's own interface is translated, and how it picks a language, writing direction and mirrored layout.
tags: [interface, i18n, language, rtl]
okfx:
  mode: reference
  version: praxis/1
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – the locale dictionaries and the language selector
  - id: w3c-lang
    resource: https://www.w3.org/TR/i18n-html-tech-lang/
    title: W3C – Declaring language in HTML
  - id: w3c-bidi
    resource: https://www.w3.org/TR/i18n-html-tech-bidi/
    title: W3C – Authoring HTML – Handling right-to-left scripts
  - id: m3-bidi
    resource: https://m3.material.io/foundations/layout/bidirectionality-rtl
    title: Material Design – Bidirectionality (RTL)
  - id: unesco
    resource: https://www.unesco.org/en/multilingualism-linguistic-diversity
    title: UNESCO – Multilingualism and linguistic diversity
  - id: eu-langs
    resource: https://european-union.europa.eu/principles-countries-history/languages_en
    title: European Union – Languages
  - id: qa-tags
    resource: https://www.w3.org/International/questions/qa-choosing-language-tags
    title: W3C – Choosing a Language Tag
  - id: ltli
    resource: https://www.w3.org/TR/ltli/
    title: W3C – Language Tags and Locale Identifiers for the World Wide Web
  - id: cyrl-lreq
    resource: https://www.w3.org/TR/cyrl-lreq/
    title: W3C – Cyrillic Script Resources
  - id: eurlreq-cyrl
    resource: https://w3c.github.io/eurlreq/cyrl/
    title: W3C – European Language Enablement – Cyrillic
  - id: cldr
    resource: https://cldr.unicode.org/
    title: Unicode CLDR – Common Locale Data Repository
---

# What is translated

The viewer's own interface is translated: the toolbar, the filter sidebar, the About panel and the preview controls. A **Language** picker in the About panel switches language, and the choice is kept in the browser. The interface ships dictionaries for English, Spanish, French, German, Portuguese, Italian, Dutch, Polish, Swedish, Danish, Norwegian (Bokmål), Finnish, Greek, Czech, Slovak, Hungarian, Romanian, Bulgarian, Russian, Turkish, Hindi, Bengali, Urdu, Indonesian, Vietnamese, Persian, Chinese (Simplified), Japanese, Korean and Arabic. Further languages can be added as a new dictionary in the tool source, and a language without one keeps the English interface.

# Choosing a language

- The choice last saved in the browser wins, so the interface keeps the reader's language on the next visit.
- Otherwise the browser's own preferred languages (`navigator.languages`) are matched.
- Otherwise English, the base language, is used.

Language tags follow BCP 47 and are canonicalised with `Intl.getCanonicalLocales`, so a browser preference such as `de-DE` or `pt-BR` resolves to the matching base language. A tag the picker does not offer falls back to English.[^source]

# Finding a language

The **Language** picker is a dialog: the Language row in the About panel opens a searchable list of every language. It offers the ISO 639-1 languages that are in living use, with both Simplified and Traditional Chinese and Esperanto; ancient and liturgical languages (Latin, Sanskrit, Pali, Avestan, Church Slavic) and the other constructed auxiliary languages are left out. Every entry is written in English with the language's own name (autonym) in parentheses — for example *Spanish (español)* — so the list reads the same whatever the interface language is. A **search box** inside the dialog narrows the list as you type, folding case and accents and matching the English name, the autonym and the BCP 47 tag, so a language is easy to find in a long list.

The list is grouped by **geographic region**, using the UN M.49 continents, and the regions are listed in alphabetical order of their English name. Each heading is the English region name with the current interface language's name in parentheses when it differs — for example *Europe (Europa)* in a Dutch interface — so a reader can browse by region and keep every language available one scroll away.[^unesco] The region names come from the same dictionaries, so a locale without one keeps the English heading. A language spoken on more than one continent is listed under each of them — English, Spanish, Portuguese and French also appear under the Americas. The set covers the world's largest language groups and every European Union official language.[^eu-langs]

A chosen language with a dictionary translates the interface (the set above); one without a dictionary leaves the interface text in English. Even then the viewer follows the reader where it can — the writing direction, the names and plural selection — and it never declares the text as a language it is not written in. See *Languages without a translation* below.

# Scripts and Cyrillic

Language tags are kept as short as the W3C's BCP 47 guidance recommends: a **script subtag** appears only where the script is not implied by the language — Chinese (Simplified and Traditional) and Serbian written in Latin, offered beside the default Cyrillic. A language strongly associated with one script, such as Russian, Ukrainian, Bulgarian or the other Cyrillic-script languages, is tagged without a script subtag, because Cyrillic is its default.[^qa-tags] Language tags, whether from the saved choice, the browser or a bundle, are canonicalised with `Intl.getCanonicalLocales`, so a deprecated subtag is resolved to its preferred form and a region is kept only when it distinguishes something.[^ltli]

Cyrillic runs left to right in horizontal lines with spaces between words and is not cursive, so it needs none of the bidirectional handling described below.[^cyrl] Declaring the active language with `lang`, on the root and on the previewed content, is what lets the browser pick a font with the right Cyrillic coverage and apply the right styles.[^ltli] The search fold is limited to Latin letters, so a distinct Cyrillic letter such as `й` or `ё` is never folded onto `и` or `е`.[^cyrl]

# Declaring language

The root `<html>` element carries `lang="en"` in the markup, and the script updates it to the language the interface text is actually written in — the chosen language when it has a dictionary, otherwise English — so assistive technology, spell-check and font selection follow the text rather than the reader's wish.[^w3c-lang] The writing direction is set separately, from the chosen language's script (see below).

The preview also declares the language of **what it shows**, rather than leaving the content to inherit the interface language:

- a concept's own `lang` (or `language`) frontmatter field, when a bundle provides one;
- English for the generated `Runtime internals` pages.

Content whose language is unknown inherits the language declared for the interface — the language its text is in, which is English when the chosen language has no dictionary.

# Languages without a translation

The picker offers more languages than the interface is translated into, so a language often has no dictionary. Four concerns are kept apart, each with its own source, so a missing dictionary degrades gracefully instead of mislabelling the page:[^w3c-lang]

- **The language of the text.** The root `lang` is the language the interface text is actually written in: the chosen language when it has a dictionary, otherwise English. The text is never declared as a language it is not written in.
- **The writing direction.** `dir` follows the chosen language's script, so a right-to-left reader still gets a right-to-left interface before a dictionary exists, with left-to-right values isolated (see below).[^w3c-bidi]
- **The formatting locale.** Data the viewer gets from `Intl` — the region headings in the picker and `Intl.PluralRules` for counted nouns — comes from CLDR rather than from the dictionaries.[^cldr]
- **The choice.** The chosen language is remembered in the browser and shown in the picker, so it survives reloads and takes effect as soon as a dictionary is added.

A missing string falls back to the English default rather than a machine guess, so a control is never blank and never wrong for an unknown reason. New dictionaries are added in the tool source and are ideally reviewed by a speaker of the language.[^cldr]

# Writing direction

The base direction follows the chosen language's script, whether or not that language has a dictionary. It is read from `Intl.Locale(lang).textInfo.direction`, which follows the **script**, so e.g. `az-Arab` is right-to-left while `az-Latn` is not; a base-language list is the fallback for engines without `Intl.Locale.textInfo`. Right-to-left languages set `dir="rtl"` on the page and the rest set `dir="ltr"`, and the preview's content region gets a `dir` to match the content language it declares.

# Bidirectional text

Left-to-right values shown inside the right-to-left interface are kept readable:[^w3c-bidi]

- file and directory **paths** (`#graphPath`, `#pvPath`) are marked `dir="ltr"` and `unicode-bidi: isolate`, so an `/` or `.` in a path cannot reorder the surrounding text;
- the preview's inline **code** and fenced code blocks are `direction: ltr` and isolated;
- the preview **title** uses `dir="auto"`, so an unknown-direction title takes its base direction from its first strong character;
- graph node **labels** are drawn with the context's direction set per label from the label's own first strong character (canvas has no `dir="auto"`), so a path-like label is not reordered;
- values substituted into interface messages (a bundle name, a URL) are wrapped in `<bdi dir="auto">`, and the message box is `dir="auto"`, so an opposite-direction value cannot reorder the sentence around it;
- direction-sensitive layout uses **logical properties** (`inset-inline`, `margin-inline`, `padding-inline`, `text-align: start`, `float: inline-end`), so the sidebar, toolbar, docked deck, popovers, preview header and lists mirror with the direction.

# Mirroring the layout

A right-to-left base direction mirrors the interface, following Material's bidirectionality guidance:[^m3-bidi]

- the docked **panels** move to the opposite edge — the filter sidebar docks to the inline-end edge and the legend to the inline-start edge — and their slide direction flips with them;
- the **toolbar** and its inset, the loading **spinner**, the docked **deck** of cards and its drop site, and the deck's edge cues all follow the same edge;
- directional **glyphs** — the toolbar and preview **back and forward chevrons** and the deck cards' **disclosure triangle** — are flipped horizontally, so “back” points the way the reader's script runs.

Content with an intrinsic direction is left unmirrored: the graph **canvas** and its node thumbnails, page screenshots and the brand **wordmark** stay as drawn. Paths, code and fenced code blocks stay marked left-to-right (see above).

# Plurals and names

Counted text, such as the "files · links" summary, uses `Intl.PluralRules` together with the language's CLDR plural categories, and the file and link nouns come from the dictionary. A language's name in the selector is the English name from `Intl.DisplayNames`, with the language's own name (autonym) in parentheses. A translation that is missing falls back to the English default, so a control is never left blank.

# Scope and limits

Only the viewer's own interface is translated. Labels drawn from the bundle (concept types, tags, statuses and the legend's kind names), the deck menu and the attachment notes are shown as the bundle or the source provides them and stay in English.

# Connections

- [Interface](index.md)

[^source]: The `I18N` dictionaries and the language selector in the tool source.
[^w3c-lang]: W3C, *Declaring language in HTML*.
[^w3c-bidi]: W3C, *Authoring HTML – Handling right-to-left scripts*.
[^m3-bidi]: Material Design, *Bidirectionality (RTL)*.
[^unesco]: UNESCO, *Multilingualism and linguistic diversity*.
[^eu-langs]: European Union, *Languages*.
[^qa-tags]: W3C, *Choosing a Language Tag*.
[^ltli]: W3C, *Language Tags and Locale Identifiers for the World Wide Web*.
[^cyrl]: W3C, *Cyrillic Script Resources* and *European Language Enablement – Cyrillic*.
[^cldr]: Unicode CLDR, *Common Locale Data Repository*.
