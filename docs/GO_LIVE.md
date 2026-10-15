# Going live with real payments

Written 2026-10-14. Production has run the full money path in Stripe **test mode**:
Checkout hold, webhooks, deliverable approval, a dispute blocking release, capture,
payout record and the Connect transfer. This runbook switches it to a new, separate
**AgentExchange** Stripe account in live mode. Steps marked **owner** need the account
holder; nothing here may be done by pasting keys into chat.

## 0. Before starting

- [ ] Merged and deployed: the hold-window/re-funding fixes, and the Stripe-mode tagging
      change with its migration `20261015013000_payment_provider_mode.sql` **applied
      before** that code deploys.
- [ ] Business details on the site: legal entity, address, support/privacy/abuse
      contacts. Lawyer review of `/terms`, `/privacy`, `/refunds` and `/acceptable-use`
      (they stay marked *Draft* until then). Stripe and Google both ask for these URLs.
- [ ] A monitored recipient for production alerts (section 7).
- [ ] No money in flight. Run the queries below; all three must return 0:

```sql
select count(*) from payments where status = 'authorized';
select count(*) from payouts where status = 'pending';
select count(*) from money_operations where completed_at is null;
```

## 1. Create the AgentExchange Stripe account (owner)

1. Create a new Stripe account for AgentExchange (not the TrainChat account), and
   complete business verification: legal entity, tax id, address, bank account.
2. **Public details**: business name `AgentExchange`, statement descriptor such as
   `AGENTEXCHANGE`, support email, support URL `https://www.agentsexchange.ai/contact`,
   privacy `…/privacy`, terms `…/terms`, refund policy `…/refunds`.
3. **Branding**: icon from `public/brand/agentexchange-mark.png`, brand colour `#78F0BC`,
   accent `#0B1214`. Checkout then shows "Pay AgentExchange".
4. **Connect**: enable Connect as a platform and complete the platform profile. Seller
   onboarding uses Stripe-hosted Accounts v2 links and requests card payments together
   with transfers (see `docs/PAYMENTS.md`). Confirm the live platform is approved for
   both. Set the connected-account payout schedule, and decide who files 1099s for US
   operators (Stripe's tax reporting for Connect can do it).
5. **Payment methods**: nothing to change. The code limits Checkout to cards, because the
   product is built on card authorization holds.

## 2. Live webhook (owner)

In the live account, add an endpoint `https://www.agentsexchange.ai/api/stripe-webhook`
for exactly these events, which are the ones `server/funding.ts` handles:

- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.succeeded`
- `payment_intent.canceled`
- `charge.refunded`

Keep the signing secret for step 4.

## 3. Reset test-mode references (run once, at the switch, with owner approval)

Pilot customers, saved cards and the connected account are test-mode objects that do
not exist in the live account. Clear them so users save a real card and operators
onboard again. Pilot payments and payouts stay as history; the migration tags them
`test`, and live reconciliation ignores them.

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

Project `agentexchange-7nnq`, **Production** environment only:

- `STRIPE_SECRET_KEY` = the live secret key (`sk_live_…`), or a restricted live key
  (`rk_live_…`) with the permissions the app uses.
- `STRIPE_WEBHOOK_SECRET` = the live endpoint's signing secret from step 2.

Keep payment secrets out of **Preview**, because previews use the production database.
Redeploy production; environment changes only apply to new deployments. The app picks
its mode from the key prefix, so new payments and payouts are tagged `live`.

## 5. Verify

1. `GET https://www.agentsexchange.ai/api/payments-config` returns `"enabled": true`.
2. The worker's operator account completes live seller onboarding (Account → Cards &
   earnings → Receive earnings).
3. Two independent accounts run one real $50 contract: post brief → hire → fund with a
   real card → deliver → approve → release. Check that:
   - Stripe shows a live PaymentIntent captured for $51.50;
   - `payments.provider_mode = 'live'`, and the payout row shows $50 / $7.50 / $42.50;
   - within 5 minutes, reconciliation logs `"transfers":1`, and the Connect transfer
     appears in Stripe;
   - Vercel logs `worker_dispatch` with `"accepted":1` for `contract_funded`.
4. Optional: refund that charge in the Stripe dashboard. Expect `charge.refunded` to
   be recorded, and the next reconciliation to reverse the seller transfer in
   proportion.

## 6. Rollback

Put the test keys back in Production and redeploy. Rows tagged `live` are then ignored
by test-mode reconciliation. Cancel any outstanding live holds in the live dashboard
first, so no customer is left with an authorization.

## 7. Alerts and monitoring (owner)

- Vercel → project → Settings → Notifications: send production alerts to a monitored
  address or a Slack channel, then trigger a test alert to prove delivery.
- Add an uptime monitor that treats a non-200 from `/api/reconcile-payments` (cron
  bearer) or `/api/payments-config` as down. Reconciliation answers 503 when payment
  work failed or needs review.
- `docs/PAYMENT_OPERATIONS.md` covers expired authorizations, card authentication,
  aged operations and failed reversals.

## Known limits at launch

- Card holds last about seven days and are never renewed. Contracts default to a 6-day
  due date, and the contract page warns in the last 48 hours. A lapsed hold can be
  funded again. The database defaults for negotiation and hire-request contracts are
  still 21 and 14 days.
- Cards that need extra authentication (3D Secure) during an off-session agent hold
  have no automated recovery flow. Human Checkout handles authentication itself.
- Payouts are labelled early access. Bank settlement follows Stripe's payout schedule
  and is not tracked to arrival.
