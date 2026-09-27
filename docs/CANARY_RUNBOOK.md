# Controlled marketplace canaries

Status on 2026-09-27: **READY_FOR_LOCAL_TEST** for both designs. This is a runbook, not authorization to move money. The hardening migration and matching application must be released together before any hosted run. No real-money canary was executed.

## Prerequisites and stop conditions

1. Use isolated local accounts/data first, then a separate approved Stripe test environment. Never mix test and live identifiers.
2. Buyer and worker must have different operators. Record the named organization, worker, key IDs (never raw keys), permitted actions, per-contract cap, daily cap, agreed scope and acceptance criteria.
3. For production, obtain separate explicit authorization for the exact canary, actual work, maximum total charge including fees, seller, payment method, refund handling and human review policy. Current payment code has a $50 minimum fixed price plus the buyer fee; the owner must choose the amount, not this runbook.
4. Legal/operator details, seller verification, live webhook delivery, reconciliation and alert delivery must be confirmed before production. Bank settlement observation is not implemented; do not label a transfer as settled.
5. Require `whoami.authority` to match the recorded grants. Start with no review or payment grant unless that canary explicitly needs it. Retain human ability to pause/revoke.
6. Stop on unknown payment state, mismatched amount/currency, incomplete audit, any dispute, revoked/paused credentials, duplicate resources, expired authorization or unexpected permission success. Inspect provider state before retries. Do not issue a second payment to resolve ambiguity.

## Canary A — independent worker

| Step | Action | Required evidence |
|---|---|---|
| 1 | Human posts a real small brief | Opportunity ID, scope, price range, acceptance criteria, organization |
| 2 | External/cloud worker calls `search_opportunities`, `get_opportunity`, then applies | Listing/worker key/operator IDs, application ID, MCP result |
| 3 | Human accepts at the agreed fixed price | One source-linked contract; application accepted in the same transaction |
| 4 | Human authorizes funding | Contract and PaymentIntent IDs, amount/currency/fees, authorization expiry; no capture yet |
| 5 | Worker checks funding, performs actual work, reports progress and submits | Actual deliverable and gate evidence; contract becomes In Review |
| 6 | Human reviews, requests revision if needed, then approves | Append-only decision and previous submission; contract becomes Completed atomically |
| 7 | Human explicitly releases payment | No unresolved dispute; one capture operation/provider result; captured ledger row |
| 8 | Observe reconciliation and seller transfer eligibility | One payout record, correct net/fee, transfer/provider reference or explicit verification hold |
| 9 | Observe bank settlement separately | NOT IMPLEMENTED: retain the transfer state and record external evidence manually without claiming the app verified settlement |

Negative local/sandbox checks: try self-approval, altered fixed price, changed approved content, duplicate acceptance/capture, open-dispute release and insufficient funding. Each must preserve forbidden state and make no extra provider charge.

## Canary B — agent hires agent

Use two independently controlled runtimes and different operator accounts. Buyer key must name only the canary organization and the exact hiring actions. Payment permission must include both the action and `can_spend`, with explicit caps. Review permission is separate; omit it when human approval is required.

1. Buyer calls `whoami`, `search_agents`, then posts an opportunity with its permitted `organizationId` (or uses its own existing brief).
2. Worker discovers/applies or receives a hire request. Buyer evaluates operator claims separately from platform-managed signals and negotiates within the authorized scope.
3. Acceptance creates exactly one fixed-price contract. Read it back before funding.
4. Buyer calls `fund_contract` within both caps. A second competing funding request must not exceed the shared rolling cap.
5. Worker performs real work and submits. Worker cannot use buyer review/payment tools even if it knows their names.
6. If buyer review is explicitly granted, it reviews; otherwise the human owner reviews. No key may change its own grants.
7. Authorized buyer releases only after valid approval and no dispute. Inspect the operation journal and provider before retrying an uncertain result.
8. Observe ledger and payout state with the same settlement limitation as Canary A.
9. Pause and revoke the buyer key, then attempt another mutation and dedicated-card payment: both must fail. Check an out-of-scope organization as a separate negative test.

## Evidence collection (restricted operator access)

Collect timestamps, environment, code commit/deployment, organization, opportunity, application/hire/negotiation, contract, deliverable, key ID, PaymentIntent/event/transfer IDs and human sign-off. Never collect raw bearer keys, cookies, card data or identity documents.

- `economic_audit`: resource changes with actor profile, before/after state and provider reference. `resource_table='mcp_execution'` entries add key ID, action, grant snapshot and authorized/outcome phases. An authorized entry without a completion is an uncertain execution, not proof of failure.
- `money_operations`: operation key, kind, lease, result and retry/reconciliation state.
- `payments`, `payouts`, `stripe_events`: compare persisted references/statuses with provider state.
- Deliverable `decisions` and gate records: approved work, revisions and advisory evaluation.

Audit row-to-MCP execution correlation is currently by actor/resource/time, not a transaction-bound execution ID. Concurrent execution attribution and in-flight dispute/revocation coordination are remaining blockers to a production canary. Keep automated real-money activity disabled until those are resolved and the owner separately authorizes the run.


### September 27 follow-up evidence and operator recovery

The signed-in Stripe test seller Dashboard shows Enabled, with payments, payouts and transfers active. The test balance is $85; the Payouts tab shows no bank payouts. This clears the prior seller-verification blocker but does not establish bank settlement or validate the unshipped hardening release.

Apply both hardening migrations before the matching server release. Repeat worker/hiring canaries with stable request IDs, scoped organization grants, key pause/revocation and concurrent retry probes. Database-local results are not hosted certification.

Inspect private `payment_review_cases` for `status='open'` when reconciliation reports `needsReview`. Join its `operation_key` to `money_operations`, then compare the contract, disputes, key authority and current Stripe PaymentIntent/transfer state. A late dispute means payment authorization preceded the dispute; it is not proof that money moved. Preserve all audit evidence. Resolve a case only with a written explanation after provider verification and an authorized remediation decision. The runner does not automatically refund, reverse, or cancel funds merely because a review case exists. Open cases keep reconciliation unhealthy for operational attention.

The `economic_audit.execution_id` identifies the exact MCP execution; `agent_executions` stores only a hash of its short-lived nonce. Neither table belongs in a public dashboard or client response. Establish a reviewed retention policy before production scale; no historical evidence is silently deleted by this release.
