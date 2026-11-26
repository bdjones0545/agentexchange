import Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runMoneyOperation, type OperationStore } from './moneyOperations.js';
import type { PaymentSnapshot, StripeGateway } from './stripe.js';

/**
 * What we tell Stripe about the seller's business up front, so onboarding
 * doesn't ask a seller with no website of their own for one. Stripe accepts a
 * seller-specific profile page on the marketplace as the business website.
 */
export interface SellerProfile { businessUrl?: string; name?: string }

export const SELLER_PRODUCT_DESCRIPTION =
  'Fixed-price AI agent services (research, writing, data, software and marketing work) sold to businesses through the AgentExchange marketplace. AgentExchange charges the buyer and transfers the seller their share after the work is approved.';

export interface SellerGateway {
  createAccount(profileId: string, email: string, country: string, profile?: SellerProfile): Promise<string>;
  /** Fill in the business website and description on an existing account that has none. Never overwrites. */
  ensureProfile(accountId: string, profile: SellerProfile): Promise<void>;
  onboarding(accountId: string, appUrl: string): Promise<string>;
  readiness(accountId: string): Promise<{ transfers: boolean; payouts: boolean }>;
  transfer(input: { payoutId: string; destination: string; amount: number; currency: string; chargeId: string }): Promise<string>;
  retrieveTransfer(id: string): Promise<{ reversed: number; amount: number }>;
  reverseTransfer(id: string, amount: number, target: number): Promise<void>;
}
export function sellerGateway(key: string): SellerGateway {
  const stripe = new Stripe(key, { apiVersion: '2026-08-26.dahlia', timeout: 5000, maxNetworkRetries: 1 });
  return {
    async createAccount(profileId, email, country, profile) {
      const a = await stripe.v2.core.accounts.create({
        dashboard: 'express', identity: { country }, contact_email: email, metadata: { profileId },
        defaults: {
          responsibilities: { fees_collector: 'application', losses_collector: 'application' },
          profile: {
            product_description: SELLER_PRODUCT_DESCRIPTION,
            ...(profile?.businessUrl ? { business_url: profile.businessUrl } : {}),
            ...(profile?.name ? { doing_business_as: profile.name.slice(0, 100) } : {}),
          },
        },
        configuration: { merchant: { capabilities: { card_payments: { requested: true } } }, recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
      }, { idempotencyKey: `seller:${profileId}` });
      return a.id;
    },
    async ensureProfile(accountId, profile) {
      const a = await stripe.v2.core.accounts.retrieve(accountId, { include: ['defaults'] });
      const current = a.defaults?.profile;
      const update: { business_url?: string; product_description?: string } = {};
      if (!current?.business_url && profile.businessUrl) update.business_url = profile.businessUrl;
      if (!current?.product_description) update.product_description = SELLER_PRODUCT_DESCRIPTION;
      if (Object.keys(update).length) await stripe.v2.core.accounts.update(accountId, { defaults: { profile: update } });
    },
    async onboarding(accountId, appUrl) {
      const link = await stripe.v2.core.accountLinks.create({ account: accountId,
        use_case: { type: 'account_onboarding', account_onboarding: { configurations: ['merchant', 'recipient'],
          refresh_url: `${appUrl}/account?seller=refresh#earnings`, return_url: `${appUrl}/account?seller=return#earnings` } } });
      return link.url;
    },
    async readiness(accountId) {
      const a = await stripe.v2.core.accounts.retrieve(accountId, { include: ['configuration.recipient'] });
      const caps = a.configuration?.recipient?.capabilities?.stripe_balance;
      return { transfers: !a.closed && caps?.stripe_transfers?.status === 'active', payouts: !a.closed && caps?.payouts?.status === 'active' };
    },
    async transfer(input) {
      const transfer = await stripe.transfers.create({ amount: input.amount, currency: input.currency.toLowerCase(),
        destination: input.destination, source_transaction: input.chargeId, metadata: { payoutId: input.payoutId } },
        { idempotencyKey: `transfer:${input.payoutId}` });
      return transfer.id;
    },
    async retrieveTransfer(id) { const t = await stripe.transfers.retrieve(id); return { reversed: t.amount_reversed, amount: t.amount }; },
    async reverseTransfer(id, amount, target) {
      await stripe.transfers.createReversal(id, { amount }, { idempotencyKey: `reverse:${id}:${target}` });
    },
  };
}
export interface PayoutRow {
  id: string; contract_id: string; operator_profile_id: string | null; payment_intent_id: string | null;
  net_cents: number; currency: string; provider_ref: string | null; status: string;
}
export function assertTransferable(payment: PaymentSnapshot, payout: PayoutRow) {
  if (payment.status !== 'succeeded' || payment.contractId !== payout.contract_id || payment.currency !== payout.currency ||
    payment.amountReceived !== payment.amount || !payment.chargeId || payment.refunded > 0 || payment.disputed || payout.net_cents > payment.amountReceived) {
    throw new Error('Payment is not eligible for seller transfer');
  }
}

/** The seller's public listing page (their oldest approved, listed agent), used as the business website. */
export async function sellerProfile(client: SupabaseClient, profileId: string, appUrl: string): Promise<SellerProfile> {
  const { data } = await client.from('agents').select('id,name').eq('owner_id', profileId).eq('moderation_status', 'approved').eq('listed', true)
    .order('created_at', { ascending: true }).limit(1);
  const agent = (data ?? [])[0] as { id: string; name: string } | undefined;
  return agent ? { businessUrl: `${appUrl}/agents/${agent.id}`, name: agent.name } : {};
}

export async function onboardSeller(client: SupabaseClient, operations: OperationStore, gateway: SellerGateway, profileId: string, appUrl: string, email: string, country: string) {
  const { data: existing, error } = await client.from('seller_accounts').select('stripe_account_id').eq('profile_id', profileId).maybeSingle();
  if (error) throw new Error('Could not read seller account');
  const profile = await sellerProfile(client, profileId, appUrl);
  if (existing?.stripe_account_id) {
    // Older accounts were created without a website, so Stripe asks the seller for
    // one. Best effort: a failure here must not block the seller finishing setup.
    await gateway.ensureProfile(existing.stripe_account_id, profile).catch(() => {});
  }
  const accountId = existing?.stripe_account_id ?? await runMoneyOperation(operations,
    { key: `seller:${profileId}`, kind: 'seller', profileId, request: { profileId } }, async () => {
      const id = await gateway.createAccount(profileId, email, country, profile);
      const { error: saveError } = await client.from('seller_accounts').upsert({ profile_id: profileId, stripe_account_id: id }, {onConflict:'profile_id', ignoreDuplicates:true});
      if (saveError) throw new Error('Could not save seller account');
      return id;
    });
  return { url: await gateway.onboarding(accountId, appUrl) };
}

/** Connect transfer != bank payout. Never mark a contract paid_out here. */
export async function transferPayout(client: SupabaseClient, operations: OperationStore, gateway: SellerGateway, payments: StripeGateway, payout: PayoutRow) {
  if (!payout.payment_intent_id || !payout.operator_profile_id) throw new Error('Payout needs payment/operator reconciliation');
  const payment = await payments.retrievePaymentIntent(payout.payment_intent_id);
  if (payout.provider_ref) {
    // Refunds and disputes can arrive after a transfer. Recover the corresponding
    // seller share; retain an auditable cumulative reversal amount.
    const target = payment.disputed ? payout.net_cents : Math.min(payout.net_cents, Math.floor(payout.net_cents * payment.refunded / Math.max(1, payment.amount)));
    const current = await gateway.retrieveTransfer(payout.provider_ref);
    if (target > current.reversed) {
      await runMoneyOperation(operations, {key:`reverse:${payout.provider_ref}:${target}`,kind:'reversal',contractId:payout.contract_id,
        request:{transferId:payout.provider_ref,target}}, async () => {
        const latest = await gateway.retrieveTransfer(payout.provider_ref!);
        if (target > latest.reversed) await gateway.reverseTransfer(payout.provider_ref!, target-latest.reversed, target);
        return { reversed: target };
      });
    }
    if (target > 0) {
      const {error} = await client.from('payouts').update({reversed_cents:Math.max(target,current.reversed),status:'reversed'}).eq('id',payout.id);
      if(error) throw new Error('Could not record transfer reversal');
    }
    return {state:'reconciled'};
  }
  assertTransferable(payment,payout);
  const { data: seller, error } = await client.from('seller_accounts').select('stripe_account_id').eq('profile_id',payout.operator_profile_id).maybeSingle();
  if(error) throw new Error('Could not read seller account');
  if(!seller) return {state:'awaiting_onboarding'};
  const ready = await gateway.readiness(seller.stripe_account_id);
  if(!ready.transfers || !ready.payouts) return {state:'awaiting_verification'};
  return runMoneyOperation(operations, {key:`transfer:${payout.id}`,kind:'transfer',profileId:payout.operator_profile_id,
    contractId:payout.contract_id,request:{payoutId:payout.id,destination:seller.stripe_account_id,amount:payout.net_cents}}, async () => {
    // Recheck immediately before mutation; old webhook payloads are not authority.
    const fresh = await payments.retrievePaymentIntent(payout.payment_intent_id!);
    assertTransferable(fresh,payout);
    const id = await gateway.transfer({payoutId:payout.id,destination:seller.stripe_account_id,amount:payout.net_cents,currency:payout.currency,chargeId:fresh.chargeId!});
    const {error: saveError} = await client.from('payouts').update({provider_ref:id,status:'transferred',transferred_at:new Date().toISOString()}).eq('id',payout.id);
    if(saveError) throw new Error('Could not record seller transfer');
    return {state:'transferred',transferId:id};
  });
}
