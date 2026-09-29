# AgentExchange launch and recovery

## Release gate

Keep Stripe in test mode until the owner explicitly authorizes live configuration and a priced live canary. A Vercel READY deployment is a build result, not payment or business readiness. The public custom domain must be promoted explicitly after the staged release passes acceptance.

Record the Git commit, Vercel deployment ID, applied migrations, test results, and canary IDs. The staging deployment currently includes uncommitted changes; commit the reviewed release before promotion. Never roll back to an application that ignores the deployed scoped-agent authorization model.

## Incident triage

1. Determine whether the failure affects availability, authentication, a worker, payment authorization, capture, transfer, or bank payout. These are separate states.
2. Run `node scripts/check-uptime.mjs` for public availability only. A network/tool failure means monitoring is unavailable, not proof the app is down.
3. Inspect Vercel runtime errors and payment_reconciliation logs. Expected reconciliation frequency is five minutes. Investigate two consecutive missing runs, non-200 results, failed operations, or needsReview counts. Do not invoke reconciliation solely to clear an alert: it can perform transfers and retry payment operations.
4. For a payment incident, inspect the contract, payments, payouts, money_operations, disputes, and payment_review_cases using authorized server access. Compare with current Stripe state and the correct test/live mode. Never print credentials, raw webhook bodies, card data, session cookies, or full operation payloads.
5. Preserve the stable requestId and provider idempotency key. Do not create a replacement charge to resolve an unknown response. Do not manually mark a payment captured, transferred, refunded, or paid out.

## Containment and recovery

Pause the affected agent key when a caller is misbehaving; revoke it if compromised. Already-authorized provider work may still finish, so inspect the journal and provider before concluding that revocation stopped money movement. Open review cases require a written resolution supported by provider evidence.

For stale or failed work, inspect the recorded lease, retry time and error classification. Only the bounded runner or an authorized existing operation should retry an intent. Operations older than the provider idempotency window require manual reconciliation. Refunds, transfer reversals, and cancellation require their own applicable authorization; do not infer permission from a support incident.

For deployment failures, choose a previously verified build compatible with current migrations. Stage rollback verification before domain promotion. Do not drop tables or reverse migrations as a routine rollback. Verify Google sign-in, public discovery, contract access, and protected endpoints after recovery.

## Payout handling

Capture means the buyer payment succeeded. Transfer means funds reached the seller's connected Stripe balance. An account-level bank payout is separate and cannot be attributed to one contract without allocation evidence. Inspect payout.failed and later changes to paid status. Confirm bank receipt independently when required. Never change stored provider status to silence an alert.

Configure a Connect endpoint for the documented payout events in CANARY_RUNBOOK.md and verify delivery signatures, duplicate handling, current-state retrieval, and a failure observation in test mode. The platform webhook and Connect webhook can have different signing secrets.

## Account deletion

Self-service deletion is restricted to a recently authenticated human with no retained marketplace/billing records. Verify the destructive success path only on a named disposable account. For retained records, verify HTTP 409 and preservation of both auth identity and records. Support review is required; do not delete transaction history to make an account eligible. A successful UI response alone is insufficient: verify auth deletion, profile removal, and rejection of subsequent protected requests.

## Monitoring acceptance

Vercel's AgentExchange-only error rule is enabled for medium/high anomalies, with personal email and web notifications. The owner confirmed receipt of its test notification. This does not detect a silent outage or missed cron runs. No independent recurring monitor is enabled by this document. The previous Codex uptime task was stopped at the owner's request. Before live launch, select an independently hosted monitor and alert recipient, verify a controlled failure reaches that recipient, verify recovery notification, and document the result. Public probes do not test complete OAuth, database health, missed reconciliation runs, or payments. Payment reconciliation needs its own heartbeat/failed-run coverage.

## Outstanding owner inputs

Public business/contact address, final legal policy review, independent monitoring provider, and explicit live Stripe authorization remain release gates. Support contact: bryan.jones@efficiencystrengthtraining.com. Legal operator: Efficiency Strength Training, LLC.

### Independent monitor setup (pending provider configuration)

- Public uptime: monitor `https://www.agentsexchange.ai/`, `/.well-known/agent.json`, and `/api/auth-config` using read-only GETs. Use the content validation in `scripts/check-uptime.mjs`. Require a repeated failed probe before sending an outage notification; send a recovery notification when healthy again. Recipient: bryan.jones@efficiencystrengthtraining.com.
- Reconciliation heartbeat: set server-only `RECONCILIATION_SUCCESS_URL` and `RECONCILIATION_FAILURE_URL` to the provider's HTTPS success/failure ping endpoints. No headers, business records, or response bodies are sent. Do not give the monitoring service CRON_SECRET or have it invoke reconciliation.
- For Healthchecks.io, use the check's success URL and its `/fail` URL, a five-minute period and five-minute grace. Missing successful completion should alert after approximately ten minutes; explicit failures should alert immediately. Keep URLs secret and never print them in logs.
- Deploy the heartbeat code before expecting signals. It sends success only after money and bank reconciliation are healthy, failure for unresolved work or runner/configuration failure, and no ping for unauthorized requests. Delivery is bounded to three seconds, redirects are rejected, and delivery errors do not change the payment result.
- Verify the independent monitor using a separate disposable check: force a missed heartbeat or explicit failure, confirm email delivery, then send success and confirm recovery. Record evidence; never manufacture payment failures or trigger money actions just to test alerts.
- Activate the real check only after observing an actual scheduled run. Confirm failed/missed-run and recovery delivery before closing the monitoring launch gate. The Codex automation remains stopped.
