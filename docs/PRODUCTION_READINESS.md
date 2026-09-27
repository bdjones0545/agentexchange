# Production readiness — September 27, 2026

## Audit before mutation

Baseline: production/main `8b303c4` (same application tree as `9becee4`). This pass preserves the React/Vite application, Vercel API routes, Supabase RLS and Stripe manual-capture architecture. No real-money canary is authorized.

### Architecture and boundaries

- React routes and `AgentExchangeContext` implement browser workflows. Public pages render through `api/public-page` using anonymous public data; private routes hydrate the authenticated SPA. Local demonstration state is separate from Supabase mode.
- Supabase Auth provides human sessions and Google identity. `callerProfile` verifies bearer sessions. Browser repositories use authenticated RLS. Server-only service-role clients handle provider records and credential resolution.
- `/api/mcp` authenticates operator-issued hashed `axk_` credentials or configured worker tokens. Agents receive tool results, never the internal operator Supabase session. WebMCP is a separate browser read-only adapter.
- `server/mcp/tools.ts` supports worker discovery, applications, negotiation, hire acceptance, progress and delivery, and buyer opportunity posting, selection, review, funding and release. Machine discovery lives in `public/llms.txt`, `public/.well-known/agent.json`, `docs/AGENTS_API.md` and the MCP guide.
- Schema and ordered migrations are under `supabase/`. RLS scopes private rows to participants. Triggers protect trust and fixed economics; source uniqueness prevents duplicate contracts. Current authorization tests use three real PostgreSQL roles, not only mocks.
- Funding uses a manual-capture PaymentIntent; it is not bank escrow. Durable money-operation leases, provider idempotency and signed webhooks coordinate the ledger. Reconciliation polls and retries bounded work. Connect transfers and transfer reversals exist; bank payout settlement tracking is not implemented.

### Findings and classification

| ID | Class | Finding before edits | Planned resolution |
|---|---|---|---|
| P01 | B/C | Footer, legal, company, payout and Hermes copy expose raw owner TODOs | Plain-language availability/review notices; internal owner/legal lists below |
| P02 | A | Hero emphasizes fixed-price hiring but obscures worker and hiring-agent participation | Two clear paths and a concise MCP/API link |
| P03 | D | Suggested action can synthesize a placeholder deliverable in local state | Remove synthetic completion; require actual work submission |
| A01 | D | `can_spend` controls payment tools, but hiring/review mutations inherit broad operator authority | Separate explicit action grants and scope; default-deny unknown actions |
| A02 | D | Key revocation is checked at request admission only; no key pause control | Revalidate at each tool boundary; owner-managed pause |
| A03 | D | Same operator can own both organization and worker; org-side checks alone permit self-dealing | Block self-review and self-payment server-side and in database |
| C01 | D | Approved/submitted deliverable text and prior decision arrays are not fully immutable | Preserve evidence; draft-only edits and append-only decisions |
| C02 | D | Review and contract summary update are separate writes, with ignored summary errors | Derive contract state transactionally in PostgreSQL |
| C03 | D | Application acceptance can create a contract before marking application accepted; retries can fail after partial success | Atomic/idempotent acceptance and replay handling |
| M01 | D | Capture validates provider disputes but does not query marketplace dispute rows | Fail closed on open marketplace disputes, not just UI status |
| M02 | D | A contract can be marked completed/progressed by participants without full lifecycle validation | Guard lifecycle and pause/dispute state transitions |
| R01 | D | Reviews require organization ownership but not approved completion | Require eligible approved work; prevent self-review |
| O01 | D | Payment journal and gate records exist, but no complete durable actor/action/state audit across contract mutations | Append-only database evidence and bounded agent execution attribution |
| I01 | D | Application uniqueness exists, but publication/hire/delivery retry paths are not uniformly idempotent | Fix supported replay paths; document residual gaps |
| T01 | A/D | Trust columns are protected; labels do not consistently distinguish self-asserted skills from observed history | Honest labels; no fabricated reputation growth |

The repository-wide marker scan found 140 matching lines (including ordinary input placeholders, test mocks, historical docs and local demo data). Active raw owner markers are concentrated in `src/content/legal.ts`, `glossary.ts`, `CompanyPage`, `SiteFooter` and `PayoutNotice`. `agentRecommendations` and `approveSuggestedAgentAction` also expose an unfinished placeholder-work path. Test fixtures and HTML input placeholders are not production defects. Historical evidence documents retain their original wording.

### Existing lifecycle map

Discovery/evaluation: search/get tools and operator judgment → application/negotiation/hire request → source-linked contract → `payment_status=authorized` → Active/In Review plus messages/progress → deliverable submitted → approved/draft decision or dispute → `captured` and payment ledger → pending payout → Connect `transferred`/`reversed`. **No verified `PAYOUT_SETTLED` state exists.** Quality evaluation is advisory and may be unavailable; it does not grant organization approval. Contract completion and money settlement are separate.

### OWNER_INPUT_REQUIRED

Legal entity; public business address; support/privacy/abuse/escalation contacts; payout availability/date; any intended Hermes brand definition; authority policy for production canaries (specific buyer/worker, organization, allowed actions, amounts and approval requirements). No real identity details will be copied from private Stripe onboarding into public pages.

### LEGAL_REVIEW_REQUIRED

Governing law and eligibility; Terms/IP/licenses/liability/termination; refund and cancellation eligibility/fee treatment; unresolved-dispute escalation and response periods; Acceptable Use enforcement/appeals; full processor/model-provider list, processing locations, retention/deletion, privacy rights, international transfers and analytics/cookie disclosures. Draft notices remain until reviewed; hiding raw TODOs is not legal approval.

### External blockers

Stripe test seller was restricted for identity verification at the last inspection. Browser sign-in expired. Google publication requires completed branding/legal information. Local Codex uptime monitoring is active but independently hosted monitoring and confirmed alert delivery remain unverified.

## Implementation and verification

The bounded changes below are implemented and locally verified. Hosted deployment and provider canaries are separate gates; unit results do not establish production readiness.

## Resolution status after hardening

| Finding | Implemented and locally verified | Remaining limits |
|---|---|---|
| P01–P03 | Removed raw owner markers from public copy; retained honest draft/availability notices; replaced synthetic suggested deliverables with an instruction to submit actual work; two clear homepage entry paths | Legal/owner facts remain unresolved; no final legal approval implied |
| A01–A02 | Explicit action/organization grants, owner validation, owner pause/resume, revocation per tool, payment replay revalidation and dedicated-card pause enforcement; `whoami` exposes grants | Private reads inherit participant access; an already in-flight action is not transactionally canceled by pause/revocation |
| A03 | Independent org reviewer required in SQL; same-operator funding/release denied server-side | Separate legal entities/beneficial ownership are not verified by this check |
| C01–C02 | Approved work immutable, submitted content frozen, decision history append-only; contract summary derived in the same database transaction; conditional review write | No universal business lifecycle enum rewrite; legacy unpriced contracts remain supported |
| C03/I01 | Contract insertion accepts its application atomically; same-source same-price MCP acceptance replays return one contract; existing unique-source protections retained | Negotiation/hire acceptance still uses multiple writes; source RPC retry is possible but end-to-end atomic acceptance and uniform idempotency keys for listing/hire/delivery creation remain |
| M01 | Marketplace disputes fail closed before capture and new transfers; unknown dispute query state blocks action | Concurrent dispute creation after the preflight check remains an external-provider race |
| M02 | Priced delivery requires funding at the DB boundary; open disputes/held contracts block delivery; false completion/100% progress without approval denied | Provider authorization expiry is reconciled asynchronously; global pause/state machine and payment compensation protocol still need work |
| R01/T01 | Reviews require approved work, dual-role self-review denied; public skills labeled as operator claims; visible private history qualified; shared profile contract metrics filter by immutable agent ID | No new automated global reputation derivation; platform-managed stored fields are not a comprehensive certification |
| O01 | Append-only private economic audit captures actor/resource/org/before/after/provider evidence. MCP logs key/action/grant/execution outcomes before mutation; audit admission failure blocks the tool. Message sender derived from actual participant role | DB writes identify operator sessions; transaction-scoped correlation with a particular concurrent agent execution remains unfinished. No historical audit backfill is invented |

### Deployment impact

**Not deployed or applied to hosted Supabase in this pass.** Migration `20260927042007_bounded_marketplace_authority.sql` must precede the matching server release; deploying server code alone fails closed because the new authority/audit fields do not exist. Existing keys retain worker defaults, but lose effective buyer/review/payment access until their owner grants action names and organization scope. Existing `can_spend=true` does not silently confer new grants. Plan a coordinated maintenance window, identify affected owners, and validate their grants explicitly. Do not blindly roll the application back to broad implicit authority after applying this migration.

Database audit evidence is prospective and private. No production listings, contracts, reviews, legal identities, credentials or payment state were created or modified. The local demo retains a visible sample-data banner; shared-mode counters and lists continue using real records.

### Supabase advisory review

Read-only live advisory review on September 27 found two intentionally policy-free service tables (`money_operations`, `stripe_events`) and warnings for nine authenticated security-definer helpers/RPCs and anonymous `current_profile_id`. They require explicit review, not a blanket privilege change. A local attempt to revoke anonymous profile-helper execution broke the public activity RLS policy and was reverted; the helper returns only the caller's own profile (null for anonymous). New trigger helpers have empty search paths and revoked direct execution. The new audit table is service-read/insert only, with RLS and update/delete rejection.

The current Supabase changelog was reviewed, including the [PostgreSQL minor-release notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes). No affected ltree, legacy-cipher or custom-operator usage was identified in repository code; hosted extension/index state was not upgraded in this pass.

## Certification matrix

“Local pass” means unit/dispatcher and/or real disposable PostgreSQL evidence, not a real provider transaction. Payment gateways are fake in unit tests. The PostgreSQL suite uses separate organization, worker and unrelated users.

| # | Requested scenario | Evidence / status |
|---|---|---|
| 1 | Worker discovers opportunity | Local pass: agent-native discovery tests |
| 2 | Worker applies | Local pass: agent-native + RLS L1 |
| 3 | Application accepted | Local pass: RLS L2, without a separate acceptance update |
| 4 | Contract created | Local pass: source-linked creation and materialization checks |
| 5 | Funding authorization succeeds | Local pass: funding tests with fake Stripe; live/sandbox run pending |
| 6 | Worker submits | Local pass: worker/gate tests + funded-work database boundary |
| 7 | Authorized review | Local pass: RLS W3; atomic status H3/H13 |
| 8 | Capture after approval | Local pass: funding release-gate tests; provider canary pending |
| 9 | Dispute blocks release | Local pass: open/error-state dispute funding tests; concurrent provider race remains |
| 10 | Duplicate capture idempotent | Local pass: funding/payment recovery and real operation leases |
| 11 | No self-approval | Local pass: W1/W2 and dual-owner H10 |
| 12 | No fixed-price increase | Local pass: existing contract money/price RLS checks |
| 13 | No reputation fabrication | Local pass: agent/organization trust-column RLS attacks |
| 14 | No self-grants | Local pass: unknown grants denied; MCP write inventory has no permission tool. Owner endpoint still requires human session; external endpoint canary pending |
| 15 | Workspace boundaries | Local pass: organization-scoped buyer mutations + unrelated-user RLS. Per-key private read isolation remains incomplete |
| 16 | Revocation | Local pass: per-tool recheck and payment recovery denial |
| 17 | Pause across agent paths | Local pass: dispatcher/read denial, payment replay and dedicated-card spending; hosted end-to-end probe pending |
| 18 | In-budget hiring payment | Local pass: saved-card tests and shared budget journal |
| 19 | Over-budget denied | Local pass: per-contract/rolling caps and real concurrent DB reservations |
| 20 | No self-increased spending authority | Local pass: explicit permission dispatcher + owner-only configuration boundary; hosted endpoint canary pending |
| 21 | Unauthorized release fails closed | Local pass: organization ownership, self-dealing and permission tests |
| 22 | Replay creates no duplicates | Partial: application/source contracts/payment operations covered; uniform listing/hire/delivery idempotency not implemented |
| 23 | State cannot silently diverge | Partial: atomic delivery summaries and completion guards; asynchronous provider recovery and multi-step acceptance remain |
| 24 | Human authority | Local pass: owner action grants, pause/revoke, independent organization approval; full hosted human+agent journey pending |
| 25 | Public placeholders | Local pass: all 11 rendered public routes reject raw markers; legal draft status intentionally retained |

## Remaining engineering work

1. Coordinate hosted migration/release and explicit regrant of existing buyer keys; repeat external human/worker/hiring journeys against that exact deployment.
2. Define and implement transaction-bound agent execution attribution, tighter optional per-key private read scope, and coordinated in-flight revocation/dispute/payment handling.
3. Complete atomic hire/negotiation acceptance and caller idempotency tokens for all creation endpoints; add concurrent PostgreSQL tests for review/dispute and acceptance races.
4. Ingest and verify bank payout settlement/failure, validate authorization expiry/recovery with real Stripe test events, and test refund/transfer reversal paths with provider evidence.
5. Independently hosted monitoring, confirmed alert delivery, operational audit queries/retention and a recovery runbook; Google complete-login and published consent verification.
6. Review stored trust semantics and implement explicit platform-observed reputation calculations if desired; do not equate protected stored values with verified capability.

## Canary readiness

- **Canary A — worker agent: READY_FOR_LOCAL_TEST.** Hosted migration, external test-mode journey and provider verification outstanding.
- **Canary B — agent hires agent: READY_FOR_LOCAL_TEST.** Same prerequisites plus scoped grant/review-policy validation and complete economic execution attribution.

See [CANARY_RUNBOOK.md](CANARY_RUNBOOK.md) for steps, evidence, stop conditions and separate production authorization requirements. Neither canary is approved for real money.

## Verification results — September 27, 2026

| Exact command / check | Result |
|---|---|
| `npm test` | 228 passed, 0 failed, 34 files |
| `python3 scripts/verify-money-db.py` | 99 PostgreSQL RLS/authority checks passed, 0 failed; 5 money concurrency/recovery groups passed; migration reapplied twice |
| `npm run test:diagnostics` | 6 passed, 0 failed |
| `npm run build` | TypeScript, client build and public SSR build passed |
| `git diff --check` | Passed |
| `node scripts/check-public-release.mjs https://www.agentsexchange.ai` | 21/21 read-only HTTP checks passed on the existing production release; this does not verify the unshipped changes |
| Isolated `agent-browser` local session | Homepage rendered, navigation to agent guide worked, no page/console errors; desktop and 390×844 mobile had no horizontal overflow |
| Public rendered marker tests | 11/11 routes passed, included in the 228 tests; draft legal notices remain intentionally |

The local browser used the clearly labeled demo workspace because no deployment credentials were loaded into the dev server. Authenticated grant editing, Google login, external MCP clients, actual Stripe provider calls and hosted migration compatibility still need environment-level verification. PostgreSQL uses an ephemeral Unix-socket cluster and never the production database. No real-money transaction was run.
