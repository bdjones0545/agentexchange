import Stripe from 'stripe';
import type {SupabaseClient} from '@supabase/supabase-js';
export interface BankPayout {id:string;amount:number;currency:string;status:string;automatic:boolean;arrival_date:number;failure_code:string|null}
export interface BankGateway {
 retrieve(account:string,id:string):Promise<BankPayout>;
 list(account:string):Promise<BankPayout[]>;
}
export function bankGateway(key:string):BankGateway {
 const stripe=new Stripe(key,{apiVersion:'2026-08-26.dahlia',timeout:5000,maxNetworkRetries:1});
 return {
  retrieve:(account,id)=>stripe.payouts.retrieve(id,{}, {stripeAccount:account}),
  list:async account=>(await stripe.payouts.list({limit:10},{stripeAccount:account})).data,
 };
}
async function save(db:SupabaseClient,account:string,payout:BankPayout,observedAt:string) {
 const {error}=await db.rpc('observe_bank_payout',{p_account:account,p_payout:payout.id,p_amount:payout.amount,p_currency:payout.currency,
  p_status:payout.status,p_automatic:payout.automatic,p_arrival:new Date(payout.arrival_date*1000).toISOString(),p_failure:payout.failure_code,p_observed:observedAt});
 if(error) throw new Error('Could not save bank payout observation');
}
/** Only called after signature verification. Always retrieve current provider state. */
export async function observeBankEvent(db:SupabaseClient,gateway:BankGateway,event:{account?:string;type:string;data:{object:{id?:string}}}) {
 if(!event.account || !event.type.startsWith('payout.')) return {ignored:true};
 const {data:seller,error}=await db.from('seller_accounts').select('profile_id').eq('stripe_account_id',event.account).maybeSingle();
 if(error) throw new Error('Seller lookup unavailable');
 if(!seller) return {ignored:true};
 const id=event.data.object.id;
 if(!id?.startsWith('po_')) throw new Error('Invalid payout identifier');
 const observedAt=new Date().toISOString();
 const payout=await gateway.retrieve(event.account,id);
 if(payout.id!==id) throw new Error('Payout identifier mismatch');
 await save(db,event.account,payout,observedAt);
 return {observed:true};
}
/** Read-only provider polling complements webhook delivery; never initiates payouts. */
export async function reconcileBankPayouts(db:SupabaseClient,gateway:BankGateway) {
 const report={bankChecked:0,bankFailed:0};const deadline=Date.now()+15_000;
 const {data:sellers,error}=await db.from('seller_accounts').select('stripe_account_id').order('bank_checked_at',{nullsFirst:true}).limit(2);
 if(error) throw new Error('Could not read seller bank polling queue');
 for(const seller of sellers ?? []) {
  if(Date.now()>=deadline) break;
  const observedAt=new Date().toISOString();
  try {
   for(const payout of await gateway.list(seller.stripe_account_id)) {await save(db,seller.stripe_account_id,payout,observedAt);report.bankChecked++;}
   const {error:updated}=await db.from('seller_accounts').update({bank_checked_at:observedAt}).eq('stripe_account_id',seller.stripe_account_id);
   if(updated) throw new Error('Could not advance bank polling queue');
  } catch {report.bankFailed++;}
 }
 // Paid can later fail: revisit known observations, including older payouts.
 const {data:known,error:knownError}=await db.from('seller_bank_payouts').select('account_id,payout_id').in('status',['pending','in_transit','paid']).order('observed_at').limit(2);
 if(knownError) throw new Error('Could not read bank observations');
 for(const row of known ?? []) {
  if(Date.now()>=deadline) break;
  try {await observeBankEvent(db,gateway,{account:row.account_id,type:'payout.updated',data:{object:{id:row.payout_id}}});report.bankChecked++;}
  catch {report.bankFailed++;}
 }
 const {data:failed,error:failedError}=await db.from('seller_bank_payouts').select('payout_id').eq('status','failed').is('failure_reviewed_at',null).limit(100);
 if(failedError) throw new Error('Could not read failed bank payouts');
 report.bankFailed+=(failed ?? []).length;
 return report;
}
