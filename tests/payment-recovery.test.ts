import { describe,it,expect,vi } from 'vitest';
import { runMoneyOperation, type OperationStore } from '../server/moneyOperations';
import { assertTransferable, transferPayout, type PayoutRow, type SellerGateway } from '../server/connect';
import type { PaymentSnapshot, StripeGateway } from '../server/stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { memoryOperations } from './money-operation-store';

const operation={key:'fund:c1',kind:'fund_agent',profileId:'buyer',contractId:'c1',request:{amount:10000}};
const snapshot:PaymentSnapshot={id:'pi_1',status:'succeeded',amount:10300,amountReceived:10300,currency:'USD',contractId:'c1',chargeId:'ch_1',captureBefore:null,refunded:0,disputed:false};
const payout:PayoutRow={id:'p1',contract_id:'c1',operator_profile_id:'seller',payment_intent_id:'pi_1',net_cents:8500,currency:'USD',provider_ref:null,status:'pending'};

describe('durable money operations',()=>{
  it('returns the committed result without charging again',async()=>{
    const store=memoryOperations();const run=vi.fn(async()=>({id:'pi_1'}));
    expect(await runMoneyOperation(store,operation,run)).toEqual({id:'pi_1'});
    await runMoneyOperation(store,operation,run);expect(run).toHaveBeenCalledTimes(1);
  });
  it('retries a failure instead of acknowledging it as processed',async()=>{
    const store=memoryOperations();const run=vi.fn().mockRejectedValueOnce(new Error('database unavailable')).mockResolvedValue({id:'pi_1'});
    await expect(runMoneyOperation(store,operation,run)).rejects.toThrow('database unavailable');
    expect(await runMoneyOperation(store,operation,run)).toEqual({id:'pi_1'});
  });
  it('refuses busy and stale ambiguous operations without invoking Stripe',async()=>{
    for(const state of ['busy','review'] as const) {
      const store={begin:async()=>({state}),finish:vi.fn(),fail:vi.fn()} satisfies OperationStore;
      const run=vi.fn();await expect(runMoneyOperation(store,operation,run)).rejects.toMatchObject({status:409});expect(run).not.toHaveBeenCalled();
    }
  });
  it('does not persist provider error text that may include cardholder data',async()=>{
    const fail=vi.fn();const store={begin:async()=>({state:'acquired' as const,token:'t'}),finish:vi.fn(),fail};
    await expect(runMoneyOperation(store,operation,async()=>{throw new Error('sensitive@example.com');})).rejects.toThrow();
    expect(fail).toHaveBeenCalledWith(operation.key,'t','Error');
  });
});

describe('seller transfers',()=>{
  it.each([{refunded:1},{disputed:true},{status:'requires_capture'},{contractId:'other'},{currency:'EUR'},{amountReceived:5000},{chargeId:null}])('rejects ineligible payment %j',patch=>{
    expect(()=>assertTransferable({...snapshot,...patch},payout)).toThrow();
  });
  function setup() {
    let saveFails=false;const rows:Record<string,unknown>[]=[];
    const client={from:(table:string)=>({
      select:()=>({eq:()=>({maybeSingle:async()=>({data:{stripe_account_id:'acct_seller'},error:null})})}),
      update:(row:Record<string,unknown>)=>({eq:async()=>{if(saveFails){saveFails=false;return {error:{message:'db down'}};}rows.push({table,...row});return {error:null};}}),
    })} as unknown as SupabaseClient;
    let transferCreated=0;let reversed=0;
    const gateway={readiness:async()=>({transfers:true,payouts:true}),transfer:vi.fn(async()=>{transferCreated=1;return 'tr_1';}),
      retrieveTransfer:async()=>({amount:8500,reversed}),reverseTransfer:vi.fn(async(_id:string,amount:number)=>{reversed+=amount;})} as unknown as SellerGateway;
    const stripe={retrievePaymentIntent:vi.fn(async()=>({...snapshot}))} as unknown as StripeGateway;
    return {client,gateway,stripe,rows,failSave:()=>{saveFails=true;},created:()=>transferCreated};
  }
  it('recovers a transfer whose local record failed, reusing the payout id',async()=>{
    const f=setup();const store=memoryOperations();f.failSave();
    await expect(transferPayout(f.client,store,f.gateway,f.stripe,payout)).rejects.toThrow('record seller transfer');
    await transferPayout(f.client,store,f.gateway,f.stripe,payout);
    const calls=vi.mocked(f.gateway.transfer).mock.calls;
    expect(calls[0][0]).toEqual(calls[1][0]);expect(f.created()).toBe(1);
    expect(f.rows[0]).toMatchObject({status:'transferred',provider_ref:'tr_1'});
    expect(f.rows[0].status).not.toBe('paid');
  });
  it('waits for seller verification without starting a transfer',async()=>{
    const f=setup();f.gateway.readiness=async()=>({transfers:true,payouts:false});
    expect(await transferPayout(f.client,memoryOperations(),f.gateway,f.stripe,payout)).toEqual({state:'awaiting_verification'});
    expect(f.gateway.transfer).not.toHaveBeenCalled();
  });
  it('reverses the proportional seller share once after a partial refund',async()=>{
    const f=setup();vi.mocked(f.stripe.retrievePaymentIntent).mockResolvedValue({...snapshot,refunded:5150});
    const row={...payout,provider_ref:'tr_1'};const ops=memoryOperations();
    await transferPayout(f.client,ops,f.gateway,f.stripe,row);await transferPayout(f.client,ops,f.gateway,f.stripe,row);
    expect(f.gateway.reverseTransfer).toHaveBeenCalledTimes(1);expect(f.gateway.reverseTransfer).toHaveBeenCalledWith('tr_1',4250,4250);
  });
});


describe('agent payment permission', () => {
  it.each(['fund_contract','release_payment'])('denies %s before opening privileged payment dependencies', async name => {
    const {TOOLS}=await import('../server/mcp/tools');
    const result=await TOOLS.find(t=>t.name===name)!.run({contractId:'11111111-1111-4111-8111-111111111111',action:'capture'} as never,
      {paymentsEnabled:true,paymentsAllowed:false,worker:'test',now:()=>new Date().toISOString(),open:async()=>{throw new Error('Must not open account');}});
    expect(result).toMatchObject({ok:false,error:expect.stringContaining('payment permission')});
  });
});
