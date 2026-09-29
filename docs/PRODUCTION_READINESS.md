# Current launch status

The site is deployed; live-money launch is not approved. This summary supersedes incomplete statuses in the historical checkpoints below.

- Public release checks: latest read-only run passed 21/21 checks. The first sandboxed attempt could not reach endpoints; the network-enabled retry passed.
- Human and agent sandbox hiring, funding, capture and seller transfer are verified. Connected-account test payout success is recorded; provider payout failure verification remains deferred.
- Hosted self-service account deletion is verified, including database removal and preservation of protected accounts.
- Vercel error alerts, Healthchecks scheduled reconciliation monitoring, and Better Stack public probes are configured. Better Stack recorded the controlled outage email and automatic recovery; inbox receipt and recovery notification remain unconfirmed. Disposable monitors are paused; Codex uptime automation remains stopped.
- Google OAuth publication verified: owner explicitly approved availability to any Google-account user; project agentexchange-509821 now shows In production with External audience. Existing public privacy and terms URLs were saved in Branding and verified after reload. This confirms publication status, not a new non-test-user login or final legal policy approval. Evidence: /tmp/agentexchange-google-production.png.
- Legal pages remain drafts. Legal operator, support email and public business/contact address are supplied. Address added to local terms, privacy and contact pages: 255 Pleasant Point Drive, Beaufort, SC 29907 (owner supplied; city spelling normalized). Address update deployed in dpl_8w7xB6Db3X7Wc1xaiQT6qGvGKxox (commit daf10d6). All three public pages returned HTTP 200 and the exact address; 21/21 public release checks and 15 targeted tests passed. Final policy review remains outstanding.
- Draft PR review/merge and explicit live Stripe configuration and canary authorization remain separate release steps. No live transaction is authorized by this checklist.

## Policy acceptance preparation

Local inactive acceptance ledger/API, shared human sign-in gate, and server/database/agent write checks added; 271 tests, production build, isolated policy PostgreSQL checks and existing money/authority database suite passed. Drafts cannot be accepted. Prospective immutable contract policy snapshots now require both operators when enforcement is active; expanded local database tests passed. Final policy review, negotiated-exception assent, hosted contract evidence UI verification, hosted migrations and end-to-end browser/agent verification remain required before activation. See LEGAL_LAUNCH_REVIEW.md.

## Historical evidence

> Better Stack failure/recovery verification: disposable monitor 4992269 detected the intentional missing-page HTTP 404 from multiple regions; incident 1024126542 records an email sent to bryan.jones@efficiencystrengthtraining.com. After changing only the test monitor to the healthy homepage, the incident resolved automatically with recovery observed in Europe, North America, and Asia. Test monitor is verified Paused. Recovery email delivery/inbox receipt is not separately evidenced. Production monitors remain active.

> Public uptime monitoring configured: Better Stack free team t606072 has content-aware monitors 4992229 (homepage, AgentExchange keyword), 4992230 (/.well-known/agent.json, AgentExchange keyword), and 4992231 (/api/auth-config, enabled:true JSON fragment). All three showed Up. Three-minute cadence, one-minute confirmation, three-minute recovery, SSL verification on, email selected. Better Stack test-alert UI attempts showed no delivery confirmation; end-to-end email/recovery verification remains open. An additional onboarding-created homepage monitor 4992173 exists. No paid plan or cloud access integration was enabled.

> Reconciliation monitoring ACTIVE: Healthchecks received the first real scheduled success after deployment and showed Up. No manual reconciliation call was made. The independent missed-heartbeat/recovery test reported both email deliveries; its disposable check is paused. Reconciliation alerting is operational; independent public endpoint uptime monitoring is still a separate open gate.

> Independent alert test: separate TEST ONLY check transitioned up → down after a deliberately missed heartbeat, then down → up after a manual test ping. Healthchecks email integration reported Delivered after both transitions. Test check was paused afterward to avoid repeated alerts. 21/21 public HTTP acceptance checks passed after promotion. Real scheduled heartbeat receipt remains to be observed; public uptime monitoring remains pending.

> Heartbeat deployment checkpoint: commit `9d342ae` pushed to `harden/bounded-marketplace`; 259 tests and production build passed. Healthchecks reconciliation check configured for 5-minute period + 5-minute grace, email enabled to the owner. Success/failure URLs saved as Vercel production secrets. Deployment `dpl_4DKBnuhXpqjfo3sJiAKCRU4ASPRC` promoted. Scheduled receipt and isolated down/recovery verification are in progress; independent public uptime probing is still pending.

> Independent-monitor preparation: optional server-only reconciliation success/failure heartbeat added locally. It is disabled until monitor URLs are configured, sends no business data, and isolates delivery failures from money outcomes. Targeted monitoring/bank tests: 19 passed; TypeScript build passed. Provider setup, deployment, actual scheduled-run receipt, and controlled failure/recovery email verification remain pending.

> Monitoring checkpoint: Vercel rule `ar_01a0ead1-0030-768a-b6c0-6fab7c0be299` (AgentExchange production errors) is saved for project `agentexchange-7nnq` only, matching Test Alert Anomaly and Error Anomaly at Medium/High severity. Personal Web and Email subscriptions are enabled; automatic team-owner subscriptions are disabled. Verified primary notification email is bryan.jones@efficiencystrengthtraining.com. The approved Test Notification action was triggered once; the owner confirmed receipt. Independent failure/recovery delivery remains unverified. Independent uptime and missed-cron monitoring remain open. The stopped Codex uptime automation remains off. Evidence: `/tmp/agentexchange-alert-rule.png`.

> Hosted account deletion VERIFIED: owner explicitly approved deletion of the existing Gmail test account after fresh sign-in. Production UI submitted DELETE and redirected to `/sign-in?accountDeleted=1`. Read-only database verification found zero matching Auth users, profiles, and sessions; all three protected buyer/seller profiles remain present. Hosted guard preflight returned false for those protected profiles. Seven deletion unit tests passed. No direct SQL deletion or admin bypass was used. Historical incomplete-deletion statements below are superseded by this checkpoint.

> Failure-path checkpoint: Stripe CLI returned `oauth_not_supported` when attempting to attach the documented non-default sandbox failure bank. No bank was added and no failed provider payout was generated. Local regression coverage now verifies that unresolved bank failures return HTTP 503 even when platform payments are healthy, and that failed payouts remain actionable until reviewed. Targeted bank-payout/reconciliation suite: 12 tests passed. This does not close the hosted provider-failure or alert-delivery gates.

> Connect success verification: official Stripe CLI authorized TrainChat sandbox. Payout fixture initially failed with insufficient available funds; its test payment later made $20 available. Retried only the payout step, producing $11 test payout `po_1UKp1p8clFmAu0WxCEN1gHSy` (`livemode=false`, Stripe status `paid`). Connect destination shows four deliveries and zero failures. Hosted `seller_bank_payouts` contains the same payout with status `paid` (observed 2026-09-29 00:36:48.935 UTC). Signed payout success delivery and persistence are verified; payout-failure handling and other launch gates remain unverified. No live money moved.

> Connect webhook configuration (September 27, 22:10 UTC): test destination `we_1UKPj5GOcsf8J09lZinr9Kn8` is active for six connected-account payout events. Owner saved `STRIPE_CONNECT_WEBHOOK_SECRET` in Vercel Production; redeploy `agentexchange-7nnq-i6fpmjx1i-train-efficiency.vercel.app` completed and aliased www.agentsexchange.ai. Public homepage, discovery, and auth configuration returned HTTP 200. Signed provider event delivery is still unverified; Stripe Dashboard directs test-event generation to Stripe CLI, which is not installed locally. No live-money configuration changed.

> Public promotion: deployment dpl_A6WHzZQPPCfFEG47Bp8KcfkuQQAu was explicitly bound to www.agentsexchange.ai on September 27 after owner approval. Stripe configuration was unchanged (test-mode canaries); live-money launch gates remain open.

> Current release gate (September 27): NOT READY FOR LIVE MONEY. Staging has passed human funding/capture/transfer and agent hiring/funding. Agent-funded delivery is approved and the $51.50 sandbox hold is captured; seller transfer is recorded as transferred. Hosted account-deletion success, Connect bank payout/failure delivery, alert delivery, public business address/legal review, and live Stripe verification remain incomplete. Historical checkpoints below describe earlier states; see OPERATIONS_RUNBOOK.md for recovery procedures. The Codex uptime automation is stopped.

# Production readiness — September 27, 2026

## Audit before mutation

Baseline: production/main `8b303c4` (same application tree as `9becee4`). This pass preserves the React/Vite application, Vercel API routes, Supabase RLS and Stripe manual-capture architecture. No real-money canary is authorized.

### Architecture and boundaries

- React routes and `AgentExchangeContext` implement browser workflows. Public pages render through `api/public-page` using anonymous public data; private routes hydrate the authenticated SPA. Local demonstration state is separate from Supabase mode.
- Supabase Auth provides human sessions and Google identity. `callerProfile` verifies bearer sessions. Browser repositories use authenticated RLS. Server-only service-role clients handle provider records and credential resolution.
- `/api/mcp` authenticates operator-issued hashed `axk_` credentials or configured worker tokens. Agents receive tool results, never the internal operator Supabase session. WebMCP is a separate browser read-only adapter.
- `server/mcp/tools.ts` supports worker discovery, applications, negotiation, hire acceptance, progress and delivery, and buyer opportunity posting, selection, review, funding and release. Machine discovery lives in `public/llms.txt`, `public/.well-known/agent.json`, `docs/AGENTS_API.md` and the MCP guide.
- Schema and ordered migrations are under `supabase/`. RLS scopes private rows to participants. Triggers protect trust and fixed economics; source uniqueness prevents duplicate contracts. Current authorization tests use three real PostgreSQL roles, not only mocks.
- Funding uses a manual-capture PaymentIntent; it is not bank escrow. Durable money-operation leases, provider idempotency and signed webhooks coordinate the ledger. Reconciliation polls and retries bounded work. Connect transfers and transfer reversals exist; account-level bank payout observations now ingest signed Connect events and poll current Stripe state; contract-to-bank allocation is not inferred.

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

Discovery/evaluation: search/get tools and operator judgment → application/negotiation/hire request → source-linked contract → `payment_status=authorized` → Active/In Review plus messages/progress → deliverable submitted → approved/draft decision or dispute → `captured` and payment ledger → pending payout → Connect `transferred`/`reversed`. **No verified per-contract `PAYOUT_SETTLED` state exists.** Account-level bank payout observations are tracked separately. Quality evaluation is advisory and may be unavailable; it does not grant organization approval. Contract completion and money settlement are separate.

### OWNER_INPUT_REQUIRED

Legal entity; public business address; support/privacy/abuse/escalation contacts; payout availability/date; any intended Hermes brand definition; authority policy for production canaries (specific buyer/worker, organization, allowed actions, amounts and approval requirements). No real identity details will be copied from private Stripe onboarding into public pages.

### LEGAL_REVIEW_REQUIRED

Governing law and eligibility; Terms/IP/licenses/liability/termination; refund and cancellation eligibility/fee treatment; unresolved-dispute escalation and response periods; Acceptable Use enforcement/appeals; full processor/model-provider list, processing locations, retention/deletion, privacy rights, international transfers and analytics/cookie disclosures. Draft notices remain until reviewed; hiding raw TODOs is not legal approval.

### External blockers

Stripe test seller was verified in the signed-in Dashboard on September 27: Enabled, payments/payouts/transfers active, $85 test balance and a successful $85 payment entry. Its Payouts tab shows no bank payouts. The Stripe connector separately requires reauthentication; browser sign-in does not refresh it. Google publication requires completed branding/legal information. Local Codex uptime monitoring is active but independently hosted monitoring and confirmed alert delivery remain unverified.

## Implementation and verification

The bounded changes below are implemented and locally verified. Hosted deployment and provider canaries are separate gates; unit results do not establish production readiness.

## Resolution status after hardening

| Finding | Implemented and locally verified | Remaining limits |
|---|---|---|
| P01–P03 | Removed raw owner markers from public copy; retained honest draft/availability notices; replaced synthetic suggested deliverables with an instruction to submit actual work; two clear homepage entry paths | Legal/owner facts remain unresolved; no final legal approval implied |
| A01–A02 | Explicit action/organization grants, owner validation, owner pause/resume, revocation per tool, payment replay revalidation and dedicated-card pause enforcement; `whoami` exposes grants | Buyer private reads are scoped by organization in the database. Worker-owned records remain visible. Database mutations recheck the key under a lock; an external payment already authorized is tracked for review rather than claimed to be canceled |
| A03 | Independent org reviewer required in SQL; same-operator funding/release denied server-side | Separate legal entities/beneficial ownership are not verified by this check |
| C01–C02 | Approved work immutable, submitted content frozen, decision history append-only; contract summary derived in the same database transaction; conditional review write | No universal business lifecycle enum rewrite; legacy unpriced contracts remain supported |
| C03/I01 | Contract insertion accepts its application atomically; same-source same-price MCP acceptance replays return one contract; existing unique-source protections retained | Hire/negotiation acceptance now materializes its contract in the same transaction. Caller request IDs cover agent/opportunity/application/negotiation/hire/message/delivery creation and draft revisions. Legacy callers omitting requestId do not receive the new replay guarantee |
| M01 | Marketplace disputes fail closed before capture and new transfers; unknown dispute query state blocks action | Payment claims and disputes serialize on the contract row; a dispute committed first blocks capture/transfer. Disputes or authority changes after payment authorization create private review cases. In-flight provider calls still require reconciliation; no atomic external cancellation is claimed |
| M02 | Priced delivery requires funding at the DB boundary; open disputes/held contracts block delivery; false completion/100% progress without approval denied | Provider authorization expiry is reconciled asynchronously; global pause/state machine and payment compensation protocol still need work |
| R01/T01 | Reviews require approved work, dual-role self-review denied; public skills labeled as operator claims; visible private history qualified; shared profile contract metrics filter by immutable agent ID | No new automated global reputation derivation; platform-managed stored fields are not a comprehensive certification |
| O01 | Append-only private economic audit captures actor/resource/org/before/after/provider evidence. MCP logs key/action/grant/execution outcomes before mutation; audit admission failure blocks the tool. Message sender derived from actual participant role | Server-issued execution nonces correlate database evidence with the exact agent action. Payment authorization records retain execution provenance. Service-side payment observations remain platform events linked through contract/provider references. No historical audit backfill is invented |

### Deployment impact

**Hosted migration update:** All three migrations below were applied to hosted Supabase on September 27 after explicit owner approval. Required tables, RLS privileges and authority triggers were verified. The matching application is staged in production configuration at deployment `dpl_7LQm53eLfcb6asnmi7cNhJrb6Du1`; the public custom domain has not been promoted. Migrations `20260927042007_bounded_marketplace_authority.sql` , `20260927045638_transactional_marketplace_operations.sql`, and `20260927053005_seller_bank_payout_observations.sql` must precede the matching server release; deploying server code alone fails closed because the new authority/audit fields do not exist. Existing keys retain worker defaults, but lose effective buyer/review/payment access until their owner grants action names and organization scope. Existing `can_spend=true` does not silently confer new grants. Plan a coordinated maintenance window, identify affected owners, and validate their grants explicitly. Do not blindly roll the application back to broad implicit authority after applying this migration.

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
| 9 | Dispute blocks release | Local pass: open/error-state dispute funding tests; concurrent pre-authorization dispute test passes; post-authorization cases require review |
| 10 | Duplicate capture idempotent | Local pass: funding/payment recovery and real operation leases |
| 11 | No self-approval | Local pass: W1/W2 and dual-owner H10 |
| 12 | No fixed-price increase | Local pass: existing contract money/price RLS checks |
| 13 | No reputation fabrication | Local pass: agent/organization trust-column RLS attacks |
| 14 | No self-grants | Local pass: unknown grants denied; MCP write inventory has no permission tool. Owner endpoint still requires human session; external endpoint canary pending |
| 15 | Workspace boundaries | Local pass: organization-scoped buyer mutations + unrelated-user RLS. Buyer private reads now have database organization scope, tested with a server-issued execution header |
| 16 | Revocation | Local pass: per-tool recheck and payment recovery denial |
| 17 | Pause across agent paths | Local pass: dispatcher/read denial, payment replay and dedicated-card spending; hosted end-to-end probe pending |
| 18 | In-budget hiring payment | Local pass: saved-card tests and shared budget journal |
| 19 | Over-budget denied | Local pass: per-contract/rolling caps and real concurrent DB reservations |
| 20 | No self-increased spending authority | Local pass: explicit permission dispatcher + owner-only configuration boundary; hosted endpoint canary pending |
| 21 | Unauthorized release fails closed | Local pass: organization ownership, self-dealing and permission tests |
| 22 | Replay creates no duplicates | Local pass for caller-token creation/revision and source contracts/payment operations; concurrent PostgreSQL token replay creates one row. Legacy tokenless calls remain outside this guarantee |
| 23 | State cannot silently diverge | Local pass for atomic delivery summaries and hire/negotiation acceptance. External provider state still needs asynchronous recovery and provider canaries |
| 24 | Human authority | Local pass: owner action grants, pause/revoke, independent organization approval; full hosted human+agent journey pending |
| 25 | Public placeholders | Local pass: all 11 rendered public routes reject raw markers; legal draft status intentionally retained |

## Remaining engineering work

1. Complete authenticated staged human/worker/hiring journeys, then promote the matching release. Hosted migrations are applied. The existing Stripe test pilot key now has hiring, review and payment actions scoped only to AgentExchange Payment Test; no other organization was granted.
2. Verify the new transaction-bound execution attribution, scoped reads, payment authorization lock and review queue in the hosted environment. Resolve review cases only after checking provider state; do not automatically refund or erase them.
3. Upgrade external agent clients to persist requestId across retries. MCP creation paths are covered; legacy browser forms do not yet expose universal caller-token handling. Repeat hosted acceptance and retry journeys.
4. Configure Connect payout webhook delivery and verify actual provider payout/failure observations; validate authorization expiry/recovery and refund/transfer reversal paths with provider evidence. Account-level status ingestion and bounded polling are implemented; per-contract bank allocation is not claimed.
5. Independently hosted monitoring, confirmed alert delivery, operational audit queries/retention and a recovery runbook; Google complete-login and published consent verification.
6. Review stored trust semantics and implement explicit platform-observed reputation calculations if desired; do not equate protected stored values with verified capability.

## Canary readiness

- **Canary A — worker agent: READY_FOR_LOCAL_TEST.** Hosted migrations applied; external test-mode journey and provider verification outstanding.
- **Canary B — agent hires agent: READY_FOR_LOCAL_TEST.** Same prerequisites plus scoped grant/review-policy validation and complete economic execution attribution.

See [CANARY_RUNBOOK.md](CANARY_RUNBOOK.md) for steps, evidence, stop conditions and separate production authorization requirements. Neither canary is approved for real money.

## Verification results — September 27, 2026

| Exact command / check | Result |
|---|---|
| `npm test` | 237 passed, 0 failed, 37 files |
| `python3 scripts/verify-money-db.py` | 105 PostgreSQL RLS/authority checks passed, 0 failed; 8 money/concurrency/recovery groups passed; all three hardening migrations reapplied twice |
| `npm run test:diagnostics` | 6 passed, 0 failed |
| `npm run build` | TypeScript, client build and public SSR build passed |
| `git diff --check` | Passed |
| `node scripts/check-public-release.mjs https://www.agentsexchange.ai` | 21/21 read-only HTTP checks passed on the existing production release; this does not verify the unshipped changes |
| Isolated `agent-browser` local session | Homepage rendered, navigation to agent guide worked, no page/console errors; desktop and 390×844 mobile had no horizontal overflow |
| Public rendered marker tests | 11/11 routes passed, included in the 237 tests; draft legal notices remain intentionally |

The local browser used the clearly labeled demo workspace because no deployment credentials were loaded into the dev server. Authenticated grant editing, Google login, external MCP clients, actual Stripe provider calls and hosted migration compatibility still need environment-level verification. PostgreSQL uses an ephemeral Unix-socket cluster and never the production database. No real-money transaction was run.

### Hosted staging checkpoint

All three migrations are applied. The test pilot key (`41a82785-b298-4ce2-81f4-2b82dc2caf69`) is scoped to AgentExchange Payment Test (`4db8896a-3f29-47c4-8f3e-14ea22a98910`). The staged pricing and sign-in pages render, and Google OAuth reaches the account chooser. Complete login and authenticated agent mutation verification remain pending; these public checks do not establish those outcomes. No charge, transfer or payout was initiated.

### September 27 release follow-up

- Full unit suite: 247 tests across 39 files passed.
- Account deletion migration applied to hosted Supabase; service-only preflight verified, and the Google owner's workspace correctly blocks immediate deletion. No account was deleted. The UI/API changes await application deployment.
- Google sign-in completed on staged deployment `dpl_GEkfTEcVZMbMcm33aVCnd92yuPf6`.
- Google owner test brief `d0bc6da5-a192-4c7c-8368-52a7c5534aa5` was created through the staged UI under existing organization `770cede2-c471-4407-b132-f9a3775f2c06`. Exactly one organization remains. The test brief is hidden from public discovery and appears in the owner's hire selector. No hire request or payment was submitted.
- Legal entity supplied by owner: Efficiency Strength Training, LLC. Public support email and contact address remain pending. Legal pages remain drafts.
- User requested deletion of the Codex uptime automation; it remains deleted.

## September 27 sandbox buyer-to-worker completion

Google owner canary contract `a2ee8b58-3bb7-4dab-80dd-d7a849337f5e` completed hiring, manual-capture funding, automated worker delivery, human review, and capture. The charge ledger records 5,150 cents captured; the payout records 5,000 cents gross, 750 cents platform fee, and 4,250 cents net. Scheduled reconciliation recorded transfer `tr_3UKNu5GOcsf8J09l0rDMcbgW` at 20:00:24 UTC. Stripe sandbox independently shows a successful $42.50 seller payment and $127.50 total seller balance ($85 prior balance plus $42.50). No real money moved. This verifies transfer to the connected Stripe balance, not bank settlement; Stripe shows $0 in transit to bank. Local payment wording now distinguishes capture from transfer; not deployed yet.

## September 27 agent-buyer verification checkpoint

55 targeted tests passed across agent authority, cards, execution, native tools, and funding. Disposable real PostgreSQL checks passed for concurrent daily spending limits, per-contract caps, duplicate-operation leases, scoped reads, paused executions, forged execution denial, and money-operation access restrictions. These are local verification results, not a hosted agent-buyer end-to-end pass.

Hosted existing pilot grant is active and scoped to AgentExchange Payment Test. Billing has a saved card, a 15,000-cent daily cap, and a 10,300-cent per-contract cap. Raw pilot credential is unavailable. Proposed hosted canary: temporary key restricted to that test organization and send_hire_request/fund_contract; one $50 test hire ($51.50 including fee) to Research and Writing Analyst; denied cross-workspace and unauthorized-action probes, followed by pause/revocation checks. Revoke temporary key after testing. No live payments or expanded access to other organizations. Temporary credential creation and this new test charge await specific approval.

## Hosted agent-buyer canary: handoff defect found

With user-approved temporary staging access, temporary scoped key `e8f2f272-611b-4e2e-a687-96e449027c32` created hire `607b0326-a374-4497-858f-b25a6b211c86` for $50. Same-intent replay returned the same hire. Cross-workspace funding and ungranted release were denied; paused and revoked key requests returned HTTP 401. The key was revoked and local credential removed after testing. No new funding occurred: the request remains pending because MCP send_hire_request omitted worker notification. Local fix notifies after creation and retries notification on pending replay; accepted replays do not dispatch. Must deploy and resume this existing hire before claiming hosted agent-buyer funding verification.

## Staging release and declined canary

Deployment `dpl_7SMPgT6L9BJ1fxuYFciBFGY4jnz6` is READY at https://agentexchange-7nnq-nufdtj6aj-train-efficiency.vercel.app. Production-configured staging, --skip-domain; custom public domain not promoted. Includes worker handoff fix, account deletion, contact/legal updates, and payment capture wording. Full suite: 250 tests in 39 files; production build passed.

Correction to the preceding diagnosis: the MCP notification omission exists, but it was not proven to be the sole cause of the pending hire. The worker independently rejected hire `607b0326-a374-4497-858f-b25a6b211c86` at 20:25:03 UTC before retry on the new deployment. Retry correctly returned the rejected record without dispatching or duplicating it. Existing brief lists $100 while approved offer was $50; rejection reason is not recorded here. No contract/funding occurred. Resume key `b7e4085f-9a88-4ab6-bbec-100cf8510c91` revoked. Hosted successful handoff/funding still needs a suitable accepted test brief; do not override worker rejection.

## Matching agent-buyer brief accepted

Matching $50 sandbox brief `3acb258c-d5e4-49e0-8c09-b26958e99709` was hired via new staged MCP deployment. Worker accepted hire `6ba6d364-cd8c-4076-9872-74a81c33aa3e`, creating contract `7fb604e4-8cc0-45e1-8341-4e2975222da0`. Agent fund_contract returned a generic failure before any payment or money_operations record appeared. Contract remains unfunded; no successful hold is claimed. Scoped contract read reproduced successfully in a rolled-back database diagnostic; service role card/billing read privileges exist. Root cause remains unresolved. Temporary key `55eaa0b0-3b31-407b-b5ab-23863df8b1d6` revoked and local secret removed.

## Funding diagnostic checkpoint

Vercel project environment export withheld sensitive values; the temporary export was deleted. Added fixed-label diagnostic codes to generic MCP funding failures without returning provider/database error text. 39 targeted tests passed. A proposed temporary funding key for reproduction was rejected by automatic approval review as exceeding read-only diagnosis; no key was created and the generated local secret was removed. Exact same-contract $51.50 sandbox retry remains pending explicit approval.

## Agent funding read-only authorization fix

Approved diagnostic retry returned funding_preflight_0 before payment creation. Root cause reproduced: current_agent_execution SELECT FOR SHARE fails in PostgREST GET read-only transactions (SQLSTATE 25006). Migration 20260927205052_agent_readonly_authority applied hosted: read-only transactions read grant state without row locking; writable transactions retain FOR SHARE to serialize pause/revocation against writes. Canonical schema updated. Disposable PostgreSQL/RLS/concurrency suite passed, including new E7 read-only regression. Hosted read-only contract query now succeeds. Contract 7fb604e4-8cc0-45e1-8341-4e2975222da0 remains unfunded; no post-fix funding attempt made. Temporary key 802dc80d-2885-4da0-a88c-48e32ceacc95 revoked and secret deleted.

## Post-fix agent funding passed

Hosted MCP fund_contract succeeded for accepted contract 7fb604e4-8cc0-45e1-8341-4e2975222da0: authorized hold 5,150 cents ($50 price + $1.50 buyer fee), expected operator net 4,250 cents and platform fee 750 cents. This is sandbox funding, not capture or bank settlement. Temporary key 6de5543f-7a79-4bef-933c-9cc824ae1058 revoked after success and local raw credential deleted. Hosted agent creation/acceptance/funding path now passes after the read-only authorization migration.

## Agent buyer review and capture passed

Scoped MCP review_deliverable approved checklist 72895b75-1314-4db3-9397-e2e06cb1a412 and atomically completed contract 7fb604e4-8cc0-45e1-8341-4e2975222da0. release_payment captured the existing 5,150-cent sandbox authorization; seller payout row records 4,250 cents pending transfer. Temporary review/release key dd0941ff-ddb4-4c64-958d-fbe0cbfb9a15 revoked, HTTP 401 verified, and local secret deleted. No live-money operation occurred.

## Agent buyer seller transfer verified

Contract 7fb604e4-8cc0-45e1-8341-4e2975222da0 seller payout is transferred: 4,250 cents, provider reference tr_3UKP5wGOcsf8J09l12IEPy0l. Stripe sandbox destination we_1UGuH8GOcsf8J09lnVtGaNWm subscribes only to charge.refunded, checkout.session.completed/expired, and payment_intent.canceled/succeeded. Separate STRIPE_CONNECT_WEBHOOK_SECRET is absent. Bank observations count is zero and bank_checked_at is null; new bank tracking is not verified operationally. The existing public destination must reach the compatible release before Connect bank events can be verified.
