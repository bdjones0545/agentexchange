# AgentExchange release checklist

Updated September 26, 2026. This replaces the obsolete pre-payments MVP checklist.
A successful preview is not a live-money launch approval.

## Verified technical baseline

- [x] P0/P1 implementation in 19 ordered draft PRs; see [review index](upgrades/README.md).
- [x] Public server rendering, real 404s, crawler files, sharing images and accessible mobile navigation verified on the combined preview.
- [x] Google identity-only sign-in completed against the live application.
- [x] Stripe test funding, delivery, approval, capture and repeat-capture journey recorded in [payments](PAYMENTS.md).
- [x] 195 application tests, 6 diagnostic tests, TypeScript and client/SSR builds pass.
- [x] Clean npm installation and dependency audit: zero known advisories after patching React Router, PostCSS, nanoid and Vitest.
- [x] Disposable PostgreSQL verification: concurrent spending caps, fenced leases, privileged money writes, terminal-state protection and 86 three-party authorization checks pass.
- [x] CI includes the database authorization suite and dependency audit.
- [x] Constant fee function has a fixed empty search path; deployed readback still returns 1500 basis points.
- [x] Reconciliation changes return HTTP 503 for failed/review-required work and emit counts-only structured logs. These application changes still require deployment.

## Inputs and access required before release

- [ ] Owner supplies legal entity, address and monitored support/privacy/abuse contact channels.
- [ ] Owner confirms lawyer review; until then all legal pages remain marked Draft.
- [ ] Owner provides Hermes definition and payout timing, or approves continued explicit early-access wording.
- [ ] Reconnect Stripe or sign into the Dashboard to finish provider-backed verification. The connector currently loops on authentication; Vercel sensitive secrets cannot be exported. Do not weaken secret protection to work around this.
- [ ] Confirm seller recipient capabilities and complete the pending $85 **test** transfer; bank settlement is separately unverified.
- [ ] Complete provider-backed dedicated-card funding, declined-card, cancellation, duplicate-webhook, refund and transfer-reversal checks. Automated regressions are not substitutes for these checks.
- [ ] Define and test the operational response for expired authorizations, required card authentication, aged ambiguous operations, failed reversals and disputes. See [runbook](PAYMENT_OPERATIONS.md).

## Public release

- [ ] Review and integrate PR #26, then #27–45 in dependency order, followed by launch-readiness fixes.
- [ ] Publish the reviewed legal/contact pages to the actual public domain.
- [ ] Fill Google homepage/privacy/terms branding links with those live pages; complete publication/verification requirements. Do not submit drafts as approved policies.
- [ ] Configure an actual monitored failure alert destination and verify a synthetic alert. Structured logging and non-200 responses alone do not prove alerts reach anyone.
- [ ] Confirm production configuration, webhook signature secret and scheduled reconciliation; keep Stripe in test mode until live-money authorization and provider acceptance are complete.
- [ ] Deploy the reviewed commit; smoke-test Google sign-in, anonymous HTML, private route access controls, payment guards and cron authentication.
- [ ] Verify public social cards in an external debugger after deployment.
- [ ] Record rollback deployment and migration compatibility. The search-path migration is compatible with the previous app.

## Scope boundaries

No P2 features, automatic reauthorization, bank-payout tracking, fee changes or live-money activation are included. Agent actions remain delegated by a human/business owner; cards, spending scopes and shared limits must be explicitly configured.
