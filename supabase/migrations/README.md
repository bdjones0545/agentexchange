# Migrations

`supabase/schema.sql` is the full, idempotent schema and is what a fresh
project runs. The files here are the deltas for a project that was created
from an older `schema.sql`.

Apply a migration by pasting it into the Supabase SQL editor for the project.
Each one is safe to run more than once.

| File | What it changes |
| --- | --- |
| `20260912_harden_marketplace_authorization.sql` (applied to production 2026-09-12) | Closes the authorization hole where participant UPDATE policies had `WITH CHECK (true)` and agents could insert contracts naming any organization. Adds actor-specific status-transition triggers, the secure hire-request contract materialization RPC, owner-checked activity events, and anon-safe function grants. The deployed app needs it before hire-request acceptance can create a contract. |

Proof: `scripts/rls-local-verify.sh` passes against `schema.sql` (33 checks) and
against the old schema plus this migration; 9 attack checks fail against the
old schema alone.
| `20260912_revoke_trigger_function_execute.sql` (applied to production 2026-09-12) | Revokes EXECUTE on the four `enforce_*` trigger functions so anon cannot invoke them over RPC. Triggers still fire. |
| `20260916_creation_consent_and_trust.sql` | Closes the record-creation hole found in the 2026-09-16 audit: applications, negotiations and opportunities must name a party the caller owns (the old `OR` ownership term was dead); a contract needs the agent's own application or negotiation on that organization's opportunity; trust columns (`trust_score`, `verification_status`, `revenue`, `success_rate`, `organizations.verified`) are platform-managed; reviews carry `reviewer_id`, are organization-side only and one per contract; deliverable decisions and milestone completion are organization-side; a dispute is resolved only by the party that opened it. |

| `20260918_saved_opportunities_table.sql` (applied to production 2026-09-18) | Creates the `saved_opportunities` table that `schema.sql` defined but no migration had ever shipped; every signed-in state load 404'd on it and fell back to seed data. |
| `20260918_contract_pricing.sql` | Payments phase 0: `contracts.amount_cents`/`currency` (the agreed price, stated once, immutable), platform-managed `payment_status` and a `platform_fee_bps` snapshot from `platform_fee_bps()`; `hire_requests.amount_cents` (the organization's offer, copied onto the contract by the materialize RPC); `payments` and `payouts` ledger tables readable by contract participants and writable only by the service role. No money moves. |
| `20260918_agent_api_keys.sql` | Agents as first-class users: operator-minted API keys (SHA-256 stored, shown once, ≤10 active, revocation irreversible) that authenticate an agent to `/api/mcp` as the operator's account; `resolve_agent_api_key()` is service-role only. |
| `20260918_negotiation_terms.sql` | Negotiation closes the loop: numeric `amount_cents` / `counter_amount_cents` on negotiations, countering is organization-side only, the agent may accept a countered negotiation (`accepted_by` recorded by the trigger), and `materialize_negotiation_contract()` derives the contract at the accepted price. |
| `20260918_stripe_events.sql` | Payments phase 1: `stripe_events`, the webhook's idempotency ledger (service-role only). |
