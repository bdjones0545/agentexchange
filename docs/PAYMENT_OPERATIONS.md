# Payment operations runbook

## Detect

The reconciliation cron runs every five minutes. The launch-readiness handler returns 200 only when `failed=0` and `needsReview=0`; otherwise 503. Unexpected runner errors return 500. All responses are uncached. Inspect the structured `payment_reconciliation` event in Vercel runtime logs. Logs contain counters and a generic failure category, never card details, journal requests or credentials.

Configure the production alert to detect non-2xx responses on `/api/reconcile-payments` and missed scheduled executions. Route it to an owner-confirmed monitored destination and test delivery. This repository does not claim an external alert is configured.

## Investigate without moving money

1. Confirm Stripe **test versus live** mode, the exact contract and current deployment.
2. Read the local payment, payout and money-operation rows using an authorized server-side connection. Match the PaymentIntent and transfer in Stripe; never infer success solely from a browser redirect.
3. Check the signed webhook deliveries and current provider object. A captured payment, Connect transfer and bank payout are different states.
4. Check Connect recipient capabilities and outstanding requirements for pending payouts. Owner completion of onboarding does not prove all capabilities are active.
5. Record provider IDs, state, timing and the chosen resolution in the incident record; exclude personal data and secrets.

`scripts/check-test-payments.mjs` is a read-only test-mode evidence helper for an authorized environment. It refuses live keys and performs no charge, transfer or database write. It requires server credentials supplied securely by the runtime; Vercel sensitive variables intentionally cannot be downloaded.

## Resolve

- Transient failure: permit the existing fenced journal operation to retry with its original idempotency key. Verify both provider and ledger afterward.
- Ambiguous operation older than 23 hours: inspect Stripe before any further attempt. Do not delete the operation or invent a new key; the provider's idempotency retention may expire.
- Expired/canceled authorization or authentication-required card: the current pilot has no automatic reauthorization or hosted recovery. Escalate to the operator; do not promise unattended completion or mark the contract funded.
- Seller awaiting verification: complete hosted requirements, then allow reconciliation to recheck capability state and transfer eligibility.
- Refund/dispute: resolve through an authorized operator in Stripe according to approved policy. Verify the cumulative refund and corresponding seller reversal. Failed reversals need manual follow-up; a won dispute does not trigger automatic retransfer.
- Possible duplicate charge or unauthorized access: pause affected processing through the existing operational controls, preserve evidence and involve the account owner. Never repair this by deleting financial records.

## Acceptance evidence still needed

One captured test payment exists in the ledger, with a pending $85 payout. All current money-operation journal entries are complete with no outstanding errored entry. Provider-backed seller transfer, dedicated-card charge, failed card, cancellation, duplicate webhook and refund/reversal verification remain uncompleted. Stripe access must be restored first. No live funds have been moved in this readiness task.
