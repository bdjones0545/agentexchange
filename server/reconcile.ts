import type { SupabaseClient } from '@supabase/supabase-js';
import { createFunding, fundWithSavedCard, handleStripeEvent, releaseFunds, type FundingDeps } from './funding.js';
import { transferPayout, type PayoutRow, type SellerGateway } from './connect.js';
import { quoteContract } from './pricing.js';

/** Bounded runner over the durable journal. Failed work remains visible and retryable. */
export async function reconcileMoney(client: SupabaseClient, deps: FundingDeps, sellers: SellerGateway, now = () => Date.now()) {
  const deadline=now()+20_000;
  const report={replayed:0,transfers:0,checked:0,failed:0,needsReview:0};
  const {data: jobs,error} = await client.from('money_operations').select('*').is('completed_at',null)
    .in('kind',['webhook','fund_agent','fund_human','capture','cancel']).lte('next_attempt_at',new Date().toISOString()).order('next_attempt_at').limit(5);
  if(error) throw new Error('Could not read payment retry journal');
  for(const job of jobs ?? []) {
    if(now()>=deadline) break;
    if(job.lease_until && Date.parse(job.lease_until)>now()) continue;
    try {
      if(job.kind!=='webhook' && job.attempts>0 && Date.parse(job.created_at)<now()-23*3600_000) {
        report.needsReview++;
        await client.from('money_operations').update({next_attempt_at:new Date(now()+3600_000).toISOString(),last_error:'manual_reconciliation_required'}).eq('key',job.key);
        continue;
      }
      const input={contractId:job.contract_id,callerProfileId:job.profile_id};
      if(job.kind==='webhook') await handleStripeEvent(deps,job.request.event);
      else if(job.kind==='fund_agent') await fundWithSavedCard(deps,input);
      else if(job.kind==='fund_human') await createFunding(deps,input);
      else if(job.kind==='capture' || job.kind==='cancel') await releaseFunds(deps,{...input,action:job.kind});
      else continue; // Seller creation requires the owner; transfer/reversal work runs below.
      report.replayed++;
    } catch { report.failed++; }
  }
  // Poll current provider state, including authorization expiry and a capture
  // whose HTTP response or webhook was lost. No fabricated Stripe events.
  const {data: payments,error: readError}=await client.from('payments').select('provider_ref,contract_id,status')
    .eq('kind','charge').in('status',['authorized','captured']).order('checked_at',{nullsFirst:true}).limit(8);
  if(readError) throw new Error('Could not read unsettled payments');
  for(const row of payments ?? []) {
    if(now()>=deadline) break;
    try {
      const pi=await deps.stripe.retrievePaymentIntent(row.provider_ref);
      const contract=await deps.ledger.getContract(row.contract_id);
      if(!contract) throw new Error('Missing contract');
      const quote=quoteContract(contract.amount_cents ?? 0,contract.platform_fee_bps,contract.currency);
      if(pi.contractId!==contract.id || pi.amount!==quote.totalCents || pi.currency!==quote.currency) throw new Error('Payment mismatch');
      if(pi.status==='canceled') {
        await deps.ledger.updatePayment(pi.id,{status:'failed'});
        await deps.ledger.setPaymentStatus(contract.id,'unfunded');
      } else if(pi.status==='succeeded') {
        if(pi.amountReceived!==quote.totalCents) throw new Error('Captured amount mismatch');
        await deps.ledger.updatePayment(pi.id,{status:'captured'});
        await deps.ledger.setPaymentStatus(contract.id,'captured');
        await deps.ledger.recordPayout({contractId:contract.id,agentId:contract.agent_id,operatorProfileId:await deps.ledger.operatorProfileForAgent(contract.agent_id),
          grossCents:quote.amountCents,feeCents:quote.platformFeeCents,currency:quote.currency,paymentIntentId:pi.id});
        if(pi.refunded>0) {
          await deps.ledger.recordPayment({contractId:contract.id,providerRef:`${pi.id}:refund-total`,kind:'refund',amountCents:pi.refunded,currency:pi.currency,status:'refunded'});
          if(pi.refunded===pi.amount) await deps.ledger.setPaymentStatus(contract.id,'refunded');
        }
      } else if(pi.status==='requires_capture') {
        if(pi.captureBefore!==null && pi.captureBefore*1000<=now()) await deps.stripe.cancelPaymentIntent(pi.id);
        await deps.ledger.updatePayment(pi.id,{metadata:{captureBefore:pi.captureBefore}});
      }
      report.checked++;
    } catch { report.failed++; }
    finally { await client.from('payments').update({checked_at:new Date().toISOString()}).eq('provider_ref',row.provider_ref); }
  }
  const {data: payouts,error:payoutError}=await client.from('payouts').select('*').in('status',['pending','transferred','reversed'])
    .order('checked_at',{nullsFirst:true}).limit(8);
  if(payoutError) throw new Error('Could not read seller payouts');
  for(const payout of (payouts ?? []) as PayoutRow[]) {
    if(now()>=deadline) break;
    const leaseUntil=new Date(now()+120_000).toISOString();
    const {data:claimed,error:claimError}=await client.from('payouts').update({check_until:leaseUntil}).eq('id',payout.id)
      .or(`check_until.is.null,check_until.lt.${new Date(now()).toISOString()}`).select('id').maybeSingle();
    if(claimError) {report.failed++;continue;}
    if(!claimed) continue;
    try {
      const decisions=await deps.ledger.deliverableSummary(payout.contract_id);
      if(!payout.provider_ref && (decisions.total===0 || decisions.approved!==decisions.total)) continue;
      const result=await transferPayout(client,deps.operations,sellers,deps.stripe,payout);
      if(result.state==='transferred') report.transfers++;
    } catch { report.failed++; }
    finally { await client.from('payouts').update({checked_at:new Date().toISOString(),check_until:null}).eq('id',payout.id).eq('check_until',leaseUntil); }
  }
  return report;
}
