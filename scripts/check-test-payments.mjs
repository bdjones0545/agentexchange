// Read-only provider acceptance evidence. Never prints credentials or personal data.
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
const key=process.env.STRIPE_SECRET_KEY;
if(!key || !/^(sk|rk)_test_/.test(key)) throw new Error('A Stripe test key is required');
const stripe=new Stripe(key,{apiVersion:'2026-08-26.dahlia',timeout:10000,maxNetworkRetries:1});
const db=createClient(process.env.SUPABASE_URL??process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:payouts,error}=await db.from('payouts').select('id,status,net_cents,provider_ref,payment_intent_id,operator_profile_id');
if(error) throw new Error('Cannot read payout evidence');
for(const payout of payouts){
  const {data:seller,error:sellerError}=await db.from('seller_accounts').select('stripe_account_id').eq('profile_id',payout.operator_profile_id).maybeSingle();
  if(sellerError) throw new Error('Cannot read seller mapping');
  const account=seller?await stripe.v2.core.accounts.retrieve(seller.stripe_account_id,{include:['configuration.recipient','requirements']}):null;
  const pi=payout.payment_intent_id?await stripe.paymentIntents.retrieve(payout.payment_intent_id):null;
  if(pi?.livemode) throw new Error('Unexpected live payment');
  console.log(JSON.stringify({payoutId:payout.id,status:payout.status,netCents:payout.net_cents,transferId:payout.provider_ref,
    paymentStatus:pi?.status,receivedCents:pi?.amount_received,
    capabilities:account?.configuration?.recipient?.capabilities,
    requirements:account?.requirements?.entries?.map(e=>({description:e.description,status:e.awaiting_action_from}))}));
}
const hooks=await stripe.webhookEndpoints.list({limit:100});
console.log(JSON.stringify({webhooks:hooks.data.filter(h=>h.url==='https://www.agentsexchange.ai/api/stripe-webhook').map(h=>({enabled:h.status,events:h.enabled_events,livemode:h.livemode}))}));
