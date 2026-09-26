# P0/P1 verification — 26 September 2026

[Preview](https://agentexchange-7nnq-5ga6p5up3-train-efficiency.vercel.app) · [PR index](README.md) · [Machine-readable evidence](verification.json)

Verified application commit: `5360fb3a647c31552dd1a5cf63ddf2ea8d727ac1`, deployment `dpl_2RX3tAk55xES5r2uwGaJJiuroLdB`. The documentation commit following it changes only this review handoff. Production was not changed.

## Checks completed

- **190 tests across 30 files pass.** TypeScript, Vite client build, bundled SSR build and `git diff --check` pass. The repository has no lint script. Existing payment, funding, recovery, agent-card, agent-key and MCP regressions remain green.
- All four legal pages and pricing return **GET/HEAD 200**, their own H1 and exactly one title. Legal pages show the draft banner and date.
- Unknown routes and nonexistent public agent/brief IDs return **404**. Private sign-in still receives the SPA shell with 200.
- `/robots.txt` returns **text/plain**; `/sitemap.xml` returns **application/xml**, listing the public agent and two open briefs with lastmod.
- Home, marketplace, directory, informational pages and real agent/brief details contain their actual content, unique title, description, canonical and OG/Twitter metadata in response HTML. JSON-LD is Organization on home, Service on profiles and CreativeWork on briefs (no misleading employment JobPosting).
- Default, agent and brief OG images return **200 image/png, 1200×630**.
- No TEST PILOT appears in rendered public pages. The browser’s read-only search returns zero fixtures. A server MCP regression verifies filtering and counts at `search_opportunities`; tool names and schemas are unchanged.
- Signed-out desktop/mobile navigation excludes private workspace destinations. Active search alone shows “no matches”; clear-filters also clears URL filters. Direct filtered marketplace HTML now matches the client’s filter state.
- At **375px**, home, marketplace and directory each measure 375px document width. The footer sits above the mobile bar. The pricing lifecycle link scrolls to the seven-step section. Search placeholders use the full muted color; mint focus outlines and the skip link remain visible.
- **No browser console errors** in the three final Lighthouse runs or the checked browser journeys. Hydration preserves a single title, description and canonical.

## Lighthouse desktop results

Measured on the final preview with Lighthouse 13.5.0 in one isolated Chrome session after establishing preview access. These are warm-session synthetic navigations, not a promise for every network or cold start.

| Page | Performance | Accessibility | Best practices | FCP | LCP |
|---|---:|---:|---:|---:|---:|
| home | 100 | 100 | 100 | 0.28s | 0.30s |
| marketplace | 94 | 100 | 100 | 0.40s | 0.81s |
| agents | 100 | 100 | 100 | 0.52s | 0.59s |

Home’s observed load event was **0.62s** in that session. An earlier access-link run measured 1.22s FCP/LCP, including roughly 0.52s of Vercel authentication redirects; that result is kept distinct from normal navigation.

A separate throttled directory run used 300ms request latency and 400/200 Kbps download/upload. Its filmstrip went from a blank navigation frame to the actual directory with the agent visible at 1.125s, with no “No agents match” flash observed. Component regressions also cover pending, failed, unfiltered-empty, filtered-empty and populated states. This run preceded only the URL-filter and placeholder-contrast fixes; the loading logic is unchanged.

## Release checks still outstanding

The review deployment is access-controlled. Public social-link debugger verification must follow an approved public release: canonical/OG URLs intentionally reference `www.agentsexchange.ai`, and this task did not promote the preview there. Image endpoints and crawler metadata are verified on the preview.

Legal documents remain **Draft, pending legal review**. Owner inputs are listed in the PR index and individual PRs. No live card charge, payout, legal approval, Google OAuth publication, production deployment, or P2 feature was performed by this upgrade.
