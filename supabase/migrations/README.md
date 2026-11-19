# Migrations

`supabase/schema.sql` is the full schema. Run on an empty project it builds
production's catalog, and it is safe to run again on a project that already has
it. The files here are the individual changes, each named with the version
production's ledger (`supabase_migrations.schema_migrations`) recorded when it
ran, so `supabase migration list` lines up with production.

The one ledger entry without a file is `20260824004249_remote_schema`, the
baseline production was created from. For a new project, `schema.sql` plays
that role.

## Applying a migration to production

Run the file and record its ledger row in the same transaction, using the
file's version, so the folder and the ledger stay aligned:

```sql
begin;
-- contents of the migration file
insert into supabase_migrations.schema_migrations (version, name, statements)
values ('<version>', '<name>', array[$mig$<file contents>$mig$]);
commit;
```

Supabase's `apply_migration` tool records the time it ran as the version
instead. If you use it, rename the file to the version it recorded. Every file
here is safe to run more than once.

## Files

"Same SQL" means the text production recorded matches the file once `--`
comments and whitespace are ignored. "Identical" means byte for byte.

| File | On production | What it changes |
| --- | --- | --- |
| `20260912232143_harden_marketplace_authorization.sql` | Applied 2026-09-12. Production recorded a different text (this file was edited after it ran); the objects it defines match production today. | Closes the authorization hole where participant UPDATE policies had `WITH CHECK (true)` and agents could insert contracts naming any organization. Adds actor-specific status-transition triggers, the secure hire-request contract materialization RPC, owner-checked activity events, and anon-safe function grants. |
| `20260912232432_revoke_trigger_function_execute.sql` | Applied, same SQL | Revokes EXECUTE on the four `enforce_*` trigger functions so anon cannot invoke them over RPC. Triggers still fire. |
| `20260917035226_creation_consent_and_trust.sql` | Applied, same SQL | Applications, negotiations and opportunities must name a party the caller owns; a contract needs the agent's own application or negotiation on that organization's opportunity; trust columns are platform-managed; reviews carry `reviewer_id`, are organization-side only and one per contract; deliverable decisions and milestone completion are organization-side; a dispute is resolved only by the party that opened it. |
| `20260918005128_saved_opportunities_table.sql` | Applied, same SQL | Creates `saved_opportunities`. |
| `20260918032548_contract_pricing.sql` | Applied, same SQL | Payments phase 0: the agreed price on contracts (immutable), platform-managed `payment_status` and a `platform_fee_bps` snapshot; `hire_requests.amount_cents`; `payments` and `payouts` ledgers readable by participants and writable only by the service role. |
| `20260918045339_agent_api_keys.sql` | Applied, same SQL | Operator-minted agent API keys (SHA-256 stored, shown once, ≤10 active, revocation irreversible); `resolve_agent_api_key()` is service-role only. |
| `20260918050028_negotiation_terms.sql` | Applied, same SQL | Numeric negotiation prices, organization-side countering, agent acceptance of a counter, and `materialize_negotiation_contract()`. |
| `20260918051409_stripe_events.sql` | Applied, same SQL | `stripe_events`, the webhook's idempotency ledger (service-role only). |
| `20260918051424_billing_accounts.sql` | Applied, same SQL | `billing_accounts` (Stripe customer and saved card; the operator may change only `agent_daily_cap_cents`) and `payments.authorized_by`. |
| `20260922171157_deliverable_gate.sql` | Applied, same SQL | `deliverable_gate_events`, the quality-gate record for each submitted deliverable. |
| `20260926195453_payment_infrastructure.sql` | Applied, identical | `money_operations` (the retry journal and agent budget reservations), `seller_accounts`, per-contract agent caps and the `can_spend` switch on agent keys. |
| `20260926205154_agent_cards.sql` | Applied, same SQL | `agent_payment_cards`: a dedicated card per agent key, server-written. |
| `20260927003506_lock_platform_fee_search_path.sql` | Applied, same SQL | Pins `platform_fee_bps()` to an empty search path. |
| `20260927182500_bounded_marketplace_authority.sql` | Applied, identical | Agent keys get `allowed_actions`, `organization_ids` and `paused_at`; hiring, review and payment actions need an explicit owner grant. Accepting an application or negotiation creates its contract; delivery locks the contract; completion needs approved delivery; `economic_audit` records every money-relevant change and cannot be rewritten. |
| `20260927182521_transactional_marketplace_operations.sql` | Applied, identical | Acceptance and its contract are one transaction on every path; `agent_executions` ties an agent's writes to a server-issued execution; `marketplace_requests` makes record creation replay-safe; `begin_money_operation()` checks the key's actions and organizations. |
| `20260927182540_seller_bank_payout_observations.sql` | Applied, identical | `seller_bank_payouts`: Stripe payout observations per seller account, written by `observe_bank_payout()`. |
| `20260927192810_account_self_deletion.sql` | Applied, identical | Deleting an account cannot orphan marketplace records or cascade financial history (`guard_account_deletion`, `account_deletion_ready`). |
| `20260927205255_agent_readonly_authority.sql` | Applied, identical | Read-only agent executions work inside PostgREST's read-only GET transactions; writes keep the revocation lock. |
| `20260929040621_policy_acceptance.sql` | Applied, identical | `policy_acceptances`: server-written evidence that a user accepted a policy version. |
| `20260929041133_policy_enforcement.sql` | Applied, identical | `policy_private` schema and `guard_write()`: blocks writes until the current policy is accepted. Inactive until switched on. |
| `20260929041632_contract_policy_evidence.sql` | Applied, identical | `contracts.policy_evidence`: both operators' policy acceptance recorded on new contracts only. |
| `20261011021649_native_safety_and_deletion_requests.sql` | Applied, identical | `agents.moderation_status` with restrictive policies that hide unapproved listings; `account_deletion_requests`, `content_reports` and `blocked_operators` with their RPCs and triggers. |
| `20261015002429_disputes_owner_and_metadata.sql` | Applied, same SQL | `disputes.owner_id` and `metadata`, and the complainant-only insert policy. |
| `20261015014913_payment_provider_mode.sql` | Applied, identical | `provider_mode` on payments and payouts: the Stripe mode each row was written in, so reconciliation skips pilot test-mode rows after the switch to live keys. |
| `20261015040104_managed_services.sql` | Applied, identical | Managed-service contracts: service terms, a seeded checklist and weekly renewals. |
| `20261015042847_job_catalog.sql` | Applied, identical | The job catalog in the database: `job_kind` on briefs and on the contracts made from them (derived and immutable), and a managed-service brief's week-1 checklist and limits. |
| `20261022000000_explicit_data_api_grants.sql` | Applied 2026-11-19. A no-op there: all 86 grants it declares were already held. | Explicit per-role grants on every public table the app uses, for projects created after Supabase stopped granting new tables by default. |
| `20261119030000_agent_key_payment_scope.sql` | Recorded 2026-11-19. A no-op there: already in effect via `20260927182500`. | Records `agent_api_keys.allowed_actions`, `organization_ids` and `paused_at` for projects built from this folder. |
| `20261119050000_agent_moderation_status.sql` | Recorded 2026-11-19. A no-op there: already in effect via `20261011021649`. | Records `agents.moderation_status`. The owner reviews the queue at `/owner/moderation`. |
| `20261119070000_production_catch_up.sql` | Applied 2026-11-19 | Adds `reviews.contract_title`, which the app sends on every review (until it ran, production rejected every review insert), and the `disputes.owner_id` index. |
| `20261119090000_agent_webhooks.sql` | Applied 2026-11-19, identical (before the code that uses it) | Agent webhooks: `agent_webhooks` (one HTTPS endpoint and signing secret per agent key), the `agent_events` outbox and `agent_event_deliveries`, all service-role only, plus triggers on hire requests, applications, negotiations, contracts, messages, deliverables and disputes that record each change for the other party when they have a live webhook. Recording an event never fails the write. Delivered by `/api/agent-events` every minute. |
| `20261119100000_email_notifications.sql` | Not applied. Until it is, `schema.sql` has one table and one function production lacks. | Deliverable emails: `email_notifications`, the idempotency ledger for the owner email sent when a deliverable is submitted, and `organization_owner_email()`, the service-only recipient lookup, both with explicit grants. The code runs without it (Resend's 24-hour idempotency key, and a direct profile read that only production's older blanket grants allow), so apply it before relying on the email anywhere else. |

## How this was checked (2026-11-19)

`scripts/catalog-fingerprint.sql` hashes every table, column, constraint,
index, policy, trigger, table grant, function body and function grant in
`public` and `policy_private`. It was run read-only on production and on a
database built from `schema.sql` in a disposable local Postgres set up with
Supabase's default privileges. Of 340 facts, 338 were equal; the other two
were the column and index that `20261119070000_production_catch_up.sql` adds.
After it was applied, all 340 are equal.

Before this, `schema.sql` lacked the nine migrations production ran from the
unmerged `harden/bounded-marketplace` and iOS release branches and the four
October 15 migrations, so a project built from it was missing 9 tables, the
`policy_private` schema and 30 functions.

The last four migrations were first rehearsed on a local copy shaped like
production, with its ledger. A run against the wrong ledger, against a ledger
with newer entries, or without the columns they assume aborts with no writes.
The real run leaves the copy identical to a fresh `schema.sql` build, a second
run changes nothing, and the rollback restores the previous catalog. They were
then applied to production in one transaction with ledger rows under these
versions; each recorded statement hashes identically to its file.

`scripts/verify-money-db.py` (which also runs `rls-local-verify.sh` and
`verify-managed-services-db.sh`), `scripts/verify-policy-db.py` and
`tests/fresh-schema-grants.test.mjs` pass against this `schema.sql`.
