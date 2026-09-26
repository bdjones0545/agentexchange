import type { SupabaseClient } from '@supabase/supabase-js';

/** A navigation link, never a bearer credential. Ownership is checked after sign-in. */
export function setupLink(appUrl: string, keyId?: string) {
  const url=new URL('/account', appUrl);
  url.searchParams.set('agentSetup',keyId ?? 'worker');
  return url.toString();
}
export async function setupStatus(client: SupabaseClient, profileId: string, keyId: string | undefined, enabled: boolean,
  readiness: (id:string)=>Promise<{transfers:boolean;payouts:boolean}>) {
  const {data:key,error:keyError}=keyId ? await client.from('agent_api_keys').select('id,name,can_spend,revoked_at').eq('id',keyId).eq('profile_id',profileId).maybeSingle() : {data:null,error:null};
  if(keyError || (keyId && (!key || key.revoked_at))) throw new Error('Setup request unavailable for this account');
  const {data:billing,error}=await client.from('billing_accounts').select('default_payment_method_id,agent_daily_cap_cents,agent_per_contract_cap_cents').eq('profile_id',profileId).maybeSingle();
  const {data:seller,error:sellerError}=await client.from('seller_accounts').select('stripe_account_id').eq('profile_id',profileId).maybeSingle();
  if(error || sellerError) throw new Error('Setup status unavailable');
  let receiving=false; let verificationUnavailable=false;
  if(enabled && seller) {try {const r=await readiness(seller.stripe_account_id);receiving=r.transfers && r.payouts;} catch {verificationUnavailable=true;}}
  const cardSaved=!!billing?.default_payment_method_id;
  const limitsSet=(billing?.agent_daily_cap_cents ?? 0)>0 && (billing?.agent_per_contract_cap_cents ?? 0)>0;
  const paymentPermission=key?.can_spend===true;
  return {enabled,agentName:key?.name ?? 'Platform worker',cardSaved,limitsSet,paymentPermission,
    canPay:enabled && cardSaved && limitsSet && paymentPermission,canReceive:enabled && receiving,
    sellerConnected:!!seller,verificationUnavailable};
}
