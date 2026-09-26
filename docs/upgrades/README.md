# AgentExchange P0/P1 review index

19 stacked draft PRs, one per requested task. Review and integrate in the order below. The first is based on `feat/payment-infrastructure` (PR #26); each subsequent PR is based on the preceding task branch. P2 is not implemented.

[Combined preview](https://agentexchange-7nnq-5ga6p5up3-train-efficiency.vercel.app) · [Verification evidence](verification.md)

| Task | PR | Change |
|---|---|---|
| P0-1 | [#27](https://github.com/bdjones0545/agentexchange/pull/27) | Legal drafts |
| P0-2 | [#28](https://github.com/bdjones0545/agentexchange/pull/28) | Global footer |
| P0-3 | [#29](https://github.com/bdjones0545/agentexchange/pull/29) | Fixture filtering and counter thresholds |
| P0-4 | [#30](https://github.com/bdjones0545/agentexchange/pull/30) | Real 404 responses |
| P0-5 | [#31](https://github.com/bdjones0545/agentexchange/pull/31) | Robots and sitemap |
| P0-6 | [#32](https://github.com/bdjones0545/agentexchange/pull/32) | Early-access payouts |
| P1-1 | [#33](https://github.com/bdjones0545/agentexchange/pull/33) | Route metadata and canonicals |
| P1-2 | [#34](https://github.com/bdjones0545/agentexchange/pull/34) | Social cards and PNG images |
| P1-3 | [#35](https://github.com/bdjones0545/agentexchange/pull/35) | Public server rendering |
| P1-4 | [#36](https://github.com/bdjones0545/agentexchange/pull/36) | Navigation and accessibility |
| P1-5 | [#37](https://github.com/bdjones0545/agentexchange/pull/37) | Home hero |
| P1-6 | [#38](https://github.com/bdjones0545/agentexchange/pull/38) | Directory heading |
| P1-7 | [#39](https://github.com/bdjones0545/agentexchange/pull/39) | Signed-out match prompts |
| P1-8 | [#40](https://github.com/bdjones0545/agentexchange/pull/40) | Budget labels |
| P1-9 | [#41](https://github.com/bdjones0545/agentexchange/pull/41) | Loading and empty states |
| P1-10 | [#42](https://github.com/bdjones0545/agentexchange/pull/42) | Hermes glossary |
| P1-11 | [#43](https://github.com/bdjones0545/agentexchange/pull/43) | Agent spending copy |
| P1-12 | [#44](https://github.com/bdjones0545/agentexchange/pull/44) | Ledger-backed pricing |
| P1-13 | [#45](https://github.com/bdjones0545/agentexchange/pull/45) | Contract lifecycle |

## Owner inputs still required

- Legal entity, business address, monitored contact/privacy/abuse/escalation channels.
- Lawyer review of legal drafts: jurisdiction/eligibility, intellectual property, licenses, liability, termination, dispute/refund/cancellation process and timing, processor list and locations, retention/deletion, privacy rights and analytics. All legal pages retain **Draft, pending legal review**.
- Payout launch date; Hermes worker definition.
- Confirm home counter thresholds (implemented: 25 agents and 10 visible contracts).

These placeholders are also listed in the individual PR descriptions. No company facts, demand metrics, testimonials or payout dates were invented.

## Release boundary

The verified build is a protected preview. Production, Stripe mode, Google OAuth settings, database policies and payment behavior were not changed by this upgrade. Public link-preview debugger verification must follow an approved production release: the canonical and OG URLs intentionally target the public domain, while the review deployment remains protected.
