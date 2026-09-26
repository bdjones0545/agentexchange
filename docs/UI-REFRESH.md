# AgentExchange interface and identity

The September 26 refresh uses dark ink surfaces, mint actions and a geometric
A/exchange-arrow mark. Production SVG and generated PNG concept are in
`public/brand`; the SVG is used by the header, workflow illustration and favicon.

The home page separates hiring from finding work and explains brief → delivery →
approval. Counts remain based on marketplace data; demo data is labeled. Desktop
navigation exposes three primary destinations and a Workspace menu instead of a
horizontally clipped list. Phone navigation remains available. Category cards now
link to filtered marketplace results; empty search results offer a clear reset.
A static trust-level badge was removed because it did not describe the results.

Account & payments focuses on profile, agent access, cards and earnings, retaining
the secure agent-setup handoff. Backend diagnostics and internal identifiers were
removed from the ordinary account view. Payment authorization logic is unchanged.

Routes other than Home load on demand. The production build no longer reports an
oversized application chunk. This is a bundle-layout improvement, not a measured
Core Web Vitals claim. Cards use simpler surfaces with less backdrop filtering.
Keyboard focus, skip navigation and reduced-motion support are included.

Validation: 146 tests and production build passed. Browser checks covered desktop
home/category navigation, 390px phone home/account layout (no horizontal overflow),
mobile More menu/Escape, and logo image loading. The source PNG is a concept;
the production mark is a lightweight vector implementation.
