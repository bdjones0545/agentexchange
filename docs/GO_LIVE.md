# Going live with real payments

Written 2026-10-14. Production has run the full money path in Stripe **test mode**:
Checkout hold, webhooks, deliverable approval, a dispute blocking release, capture,
payout record and the Connect transfer. This runbook switches it to live mode on the
existing **TrainChat** Stripe account (`acct_1RZLnXGOcsf8J09l`, the one the pilot used
in test mode), which is already verified and taking live payments. AgentExchange shares
that account rather than having its own. Steps marked **owner** need the account
holder; nothing here may be done by pasting keys into chat.

## What sharing the TrainChat account means

- **Checkout** shows TrainChat's public business name, icon and colours, because those
  are set for the whole account. The line items name the contract and the 3% service
  fee.
- **Card statements** read `PREFIX* AGENTEXCHANGE`. Every AgentExchange charge sends
  the suffix `AGENTEXCHANGE`, and the account's shortened descriptor is the prefix
  (section 1).
- **Risk is shared.** AgentExchange disputes count against the TrainChat account, and
  a Stripe review or reserve would affect TrainChat's payouts too.
- **Webhooks cross over.** Each product's endpoint receives the other's events.
  AgentExchange records TrainChat's events by id and type and ignores them; this is
  tested. TrainChat's handler must ignore AgentExchange's (section 2).
- **One balance.** AgentExchange charges, transfers and fees land in TrainChat's balance
  and reports. Use the statement suffix or `metadata.contractId` to separate them.

## 0. Before starting

- [x] Hold-window and re-funding fixes, and Stripe-mode tagging, deployed 2026-10-14.
      Migration `20261015014913_payment_provider_mode.sql` applied.
- [ ] The shared-account change (statement suffix, and the webhook ignoring other
      products' ids) is merged and deployed.
- [ ] Business details on the site: legal entity, address, support/privacy/abuse
      contacts. Lawyer review of `/terms`, `/privacy`, `/refunds` and `/acceptable-use`
      (they stay marked *Draft* until then).
- [ ] A monitored recipient for production alerts (section 7).
- [ ] No money in flight. Run the queries below; all three must return 0:

```sql
select count(*) from payments where status = 'authorized';
select count(*) from payouts where status = 'pending';
select count(*) from money_operations where completed_at is null;
```

## 1. Prepare the TrainChat Stripe account (owner)

1. **Shortened descriptor** (Settings → Business → Public details): set it to 7
   characters or fewer, for example `TRNCHAT`. Stripe allows 22 characters in all, so
   `TRNCHAT* AGENTEXCHANGE` fits; with a longer prefix, Stripe cuts the end off
   (`TRAINCHAT* AGENTEXCHAN`). Only charges that send a suffix use the shortened
   descriptor, so TrainChat's own charges keep the full descriptor unless TrainChat
   also sends suffixes.
2. **Connect**: enable Connect as a platform and complete the platform profile,
   describing AgentExchange as a marketplace that pays independent agent operators.
   Seller onboarding uses Stripe-hosted Accounts v2 links and requests card payments
   together with transfers (see `docs/PAYMENTS.md`). Confirm the live platform is
   approved for both. Set the connected-account payout schedule, and decide who files
   1099s for US operators (Stripe's Connect tax reporting can do it). Expect Stripe to
   ask about the new business line.
3. **Payment methods**: nothing to change. The code limits Checkout to cards, because the
   product is built on card authorization holds.

## 2. Webhooks (owner)

**Add** an endpoint in the TrainChat account's live mode. Leave TrainChat's own
endpoints in place. Use `https://www.agentsexchange.ai/api/stripe-webhook`, for exactly
these events, which are the ones `server/funding.ts` handles:

- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.succeeded`
- `payment_intent.canceled`
- `charge.refunded`

Keep the signing secret for step 4.

**TrainChat's endpoints will start receiving AgentExchange events.** Before the switch,
confirm in TrainChat's code that its handler skips any object it did not create. For
example, it must not grant a TrainChat subscription on every
`checkout.session.completed`. AgentExchange objects can be recognised by:

- Checkout Sessions: `integration_identifier` starts with `agentexchange_`. Payment
  sessions carry `metadata.contractId`; card-saving sessions carry
  `metadata.purpose = "agent_card"` and `metadata.profileId`.
- PaymentIntents: `metadata.contractId`, and the `AGENTEXCHANGE` statement suffix.
- Customers: `metadata.profileId`.

## 3. Reset test-mode references (run once, at the switch, with owner approval)

Test-mode customers, saved cards and connected accounts do not exist in live mode,
even on the same Stripe account. Clear them so users save a real card and operators
onboard again. Pilot payments and payouts stay as history, tagged `test`, and live
reconciliation ignores them.

```sql
begin;
update billing_accounts
   set stripe_customer_id = null, default_payment_method_id = null,
       card_brand = null, card_last4 = null, card_exp_month = null, card_exp_year = null;
update agent_payment_cards
   set payment_method_id = null, card_brand = null, card_last4 = null;
delete from seller_accounts;   -- test-mode Connect account mappings; operators re-onboard
commit;
```

Spending caps (`agent_daily_cap_cents`, `agent_per_contract_cap_cents`) are kept.
`seller_bank_payouts` also holds test-mode ids, but only the unmerged iOS and hardening
branches read it. If one of them merges after the switch, deal with those rows first.

## 4. Switch the keys (owner, in Vercel)

Create a **restricted live key** (`rk_live_…`) for AgentExchange in the TrainChat
account, rather than reusing TrainChat's secret key. Either product's key can then be
revoked without touching the other. Grant write access to Checkout Sessions,
PaymentIntents, Customers, Refunds, Transfers, and Connect accounts and account links,
and read access to SetupIntents and PaymentMethods. A missing permission shows up as a
Stripe permission error in the Vercel logs during section 5.

Project `agentexchange-7nnq`, **Production** environment only:

- `STRIPE_SECRET_KEY` = the restricted live key.
- `STRIPE_WEBHOOK_SECRET` = the signing secret of the endpoint added in step 2.

Keep payment secrets out of **Preview**, because previews use the production database.
Redeploy production; environment changes only apply to new deployments. The app picks
its mode from the key prefix, so new payments and payouts are tagged `live`.

## 5. Verify

1. `GET https://www.agentsexchange.ai/api/payments-config` returns `"enabled": true`.
2. The worker's operator account completes live seller onboarding (Account → Cards &
   earnings → Receive earnings).
3. Two independent accounts run one real $50 contract: post brief → hire → fund with a
   real card → deliver → approve → release. Check that:
   - Stripe shows a live PaymentIntent captured for $51.50, with statement descriptor
     `PREFIX* AGENTEXCHANGE`;
   - `payments.provider_mode = 'live'`, and the payout row shows $50 / $7.50 / $42.50;
   - within 5 minutes, reconciliation logs `"transfers":1`, and the Connect transfer
     appears in Stripe;
   - Vercel logs `worker_dispatch` with `"accepted":1` for `contract_funded`;
   - TrainChat's webhook logs show the AgentExchange events skipped, and its own
     records are unchanged.
4. Optional: refund that charge in the Stripe dashboard. Expect `charge.refunded` to
   be recorded, and the next reconciliation to reverse the seller transfer in
   proportion.

## 6. Rollback

Put the test keys back in Production and redeploy. Rows tagged `live` are then ignored
by test-mode reconciliation. Cancel any outstanding live holds in the Stripe dashboard
first, so no customer is left with an authorization. Disabling the AgentExchange
endpoint and revoking its restricted key leave TrainChat untouched.

## 7. Alerts and monitoring (owner)

- Vercel → project → Settings → Notifications: send production alerts to a monitored
  address or a Slack channel, then trigger a test alert to prove delivery.
- Add an uptime monitor that treats a non-200 from `/api/reconcile-payments` (cron
  bearer) or `/api/payments-config` as down. Reconciliation answers 503 when payment
  work failed or needs review.
- Watch the AgentExchange endpoint in Stripe → Webhooks. Repeated failures there make
  Stripe disable it, and funding would stop confirming.
- `docs/PAYMENT_OPERATIONS.md` covers expired authorizations, card authentication,
  aged operations and failed reversals.

## Known limits at launch

- Buyers see TrainChat, not AgentExchange, on the Checkout page.
- Card holds last about seven days and are never renewed. Contracts default to a 6-day
  due date, and the contract page warns in the last 48 hours. A lapsed hold can be
  funded again. The database defaults for negotiation and hire-request contracts are
  still 21 and 14 days.
- Cards that need extra authentication (3D Secure) during an off-session agent hold
  have no automated recovery flow. Human Checkout handles authentication itself.
- Payouts are labelled early access. Bank settlement follows Stripe's payout schedule
  and is not tracked to arrival.
