import {readAgentCard} from './agentCards.js';
import {hasPaymentAuthority, KEY_AUTHORITY_COLUMNS, type KeyAuthority} from './agentAuthority.js';
import type { SupabaseClient } from '@supabase/supabase-js';

/** A navigation link, never a bearer credential. Ownership is checked after sign-in. */
export function setupLink(appUrl: string, keyId?: string) {
  const url=new URL('/account', appUrl);
  url.searchParams.set('agentSetup',keyId ?? 'worker');
  return url.toString();
}
export async function setupStatus(client: SupabaseClient, profileId: string, keyId: string | undefined, enabled: boolean,
  readiness: (id:string)=>Promise<{transfers:boolean;payouts:boolean}>) {
  const {data:key,error:keyError}=keyId ? await client.from('agent_api_keys').select(KEY_AUTHORITY_COLUMNS).eq('id',keyId).eq('profile_id',profileId).maybeSingle() : {data:null,error:null};
  if(keyError || (keyId && (!key || key.revoked_at))) throw new Error('Setup request unavailable for this account');
  const {data:billing,error}=await client.from('billing_accounts').select('default_payment_method_id,agent_daily_cap_cents,agent_per_contract_cap_cents').eq('profile_id',profileId).maybeSingle();
  const {data:seller,error:sellerError}=await client.from('seller_accounts').select('stripe_account_id').eq('profile_id',profileId).maybeSingle();
  if(error || sellerError) throw new Error('Setup status unavailable');
  let receiving=false; let verificationUnavailable=false;
  if(enabled && seller) {try {const r=await readiness(seller.stripe_account_id);receiving=r.transfers && r.payouts;} catch {verificationUnavailable=true;}}
  const agentCard=keyId ? await readAgentCard(client,profileId,keyId) : null;
  const cardSource=agentCard?.mode==='dedicated'?'dedicated':'shared';
  const cardSaved=cardSource==='dedicated'?!!agentCard?.payment_method_id:!!billing?.default_payment_method_id;
  const limitsSet=(billing?.agent_daily_cap_cents ?? 0)>0 && (billing?.agent_per_contract_cap_cents ?? 0)>0;
  // The database also needs both money actions and an organization on the key;
  // can_spend alone used to report "ready" while every hold was refused.
  const authority=(key ?? {}) as KeyAuthority;
  const paymentPermission=key ? hasPaymentAuthority(authority) : false;
  const {data:orgs,error:orgError}=keyId ? await client.from('organizations').select('id,name').eq('owner_id',profileId) : {data:[],error:null};
  if(orgError) throw new Error('Setup status unavailable');
  const covered=new Set(Array.isArray(authority.organization_ids)?authority.organization_ids:[]);
  const organizations=((orgs ?? []) as Array<{id:string;name:string|null}>).map(o=>({id:o.id,name:o.name ?? 'Untitled organization',covered:covered.has(o.id),canPayFor:paymentPermission && covered.has(o.id)}));
  return {enabled,cardSource,cardLabel:cardSource==='dedicated' && agentCard?.payment_method_id ? `${agentCard.card_brand ?? "Card"} •••• ${agentCard.card_last4 ?? ""}` : null,agentName:key?.name ?? 'Platform worker',cardSaved,limitsSet,paymentPermission,
    paymentSwitchOn:key?.can_spend===true,organizations,
    canPay:enabled && cardSaved && limitsSet && paymentPermission,canReceive:enabled && receiving,
    sellerConnected:!!seller,verificationUnavailable};
}
