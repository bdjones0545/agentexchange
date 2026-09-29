import {describe,it,expect,vi} from 'vitest';
import {observeBankEvent,reconcileBankPayouts,type BankGateway} from '../server/bankPayouts';
import {fakeDb} from './fakeSupabase';
const payout={id:'po_test',amount:8500,currency:'usd',status:'failed',automatic:true,arrival_date:1790500000,failure_code:'account_closed'};
describe('connected bank payout observations',()=>{
 it('ignores stale event status and retrieves the current connected-account payout',async()=>{
  const saved:Record<string,unknown>[]=[];
  const db=fakeDb({tables:{seller_accounts:[{stripe_account_id:'acct_test',profile_id:'seller'}]},rpc:(_,args)=>{saved.push(args);return {data:null,error:null};}});
  const retrieve=vi.fn(async()=>payout);const gateway:BankGateway={retrieve,list:async()=>[]};
  await observeBankEvent(db,gateway,{account:'acct_test',type:'payout.paid',data:{object:{id:'po_test'}}});
  expect(retrieve).toHaveBeenCalledWith('acct_test','po_test');
  expect(saved[0]).toMatchObject({p_status:'failed',p_account:'acct_test',p_amount:8500,p_failure:'account_closed'});
 });
 it.each([{account:'acct_unknown',type:'payout.paid'},{account:'acct_test',type:'charge.succeeded'},{type:'payout.paid'}])('does not touch the provider for unrelated events: %j',async event=>{
  const retrieve=vi.fn(async()=>payout);
  const db=fakeDb({tables:{seller_accounts:[{stripe_account_id:'acct_test',profile_id:'seller'}]}});
  expect(await observeBankEvent(db,{retrieve,list:async()=>[]},{...event,data:{object:{id:'po_test'}}})).toEqual({ignored:true});
  expect(retrieve).not.toHaveBeenCalled();
 });
 it('fails for database errors so Stripe retries the event',async()=>{
  const db=fakeDb({tables:{seller_accounts:[{stripe_account_id:'acct_test'}]},rpc:()=>({data:null,error:{message:'offline'}})});
  await expect(observeBankEvent(db,{retrieve:async()=>payout,list:async()=>[]},{account:'acct_test',type:'payout.failed',data:{object:{id:'po_test'}}})).rejects.toThrow('Could not save');
 });
});

describe('bank payout failure review monitoring',()=>{
 it('keeps unreviewed failures actionable and excludes reviewed failures',async()=>{
  const rows=[{payout_id:'po_failed',status:'failed',failure_reviewed_at:null},
   {payout_id:'po_reviewed',status:'failed',failure_reviewed_at:'2026-09-28T00:00:00Z'}];
  const db=fakeDb({tables:{seller_accounts:[],seller_bank_payouts:rows}});
  const gateway={retrieve:vi.fn(),list:vi.fn()};
  expect(await reconcileBankPayouts(db,gateway)).toEqual({bankChecked:0,bankFailed:1});
  rows[0].failure_reviewed_at='2026-09-28T00:01:00Z';
  expect(await reconcileBankPayouts(db,gateway)).toEqual({bankChecked:0,bankFailed:0});
  expect(gateway.retrieve).not.toHaveBeenCalled();
 });
});
