# Security

The bounds that make an untrusted bundle safe to explore.

- [Input handling](input-handling.md) – what enters the tool and the rules every input passes through.
- [URL and network bounds](url-and-network-bounds.md) – how requests are confined to the origin and bundle root.
- [Credentials and preferences](credentials-and-preferences.md) – the one opt-in secret and the preferences, in this browser.
- [Bounded streaming and reserved capacity](streaming-and-budgets.md) – how reads stay bounded and how budgets and fetch slots are managed.
- [Resource lifecycle](resource-lifecycle.md) – how images, previews and requests are tied to the current bundle.
- [Limits and budgets](limits-and-budgets.md) – the concrete caps on files, bytes, graph size and images.
- [Assistant data flow](assistant-data-flow.md) – what the optional assistant sends off the page, and how it authenticates.
- [Residual risk](residual-risk.md) – the limits of the protections and the browser checks that remain.
