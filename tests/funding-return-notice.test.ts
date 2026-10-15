import {it,expect} from 'vitest';
import {nextReturnNotice} from '../src/components/FundingPanel';
import type {ContractPaymentStatus} from '../src/state/marketplaceTypes';
// Returning from Checkout lands on ?funding=complete. The URL keeps it, so after
// the hold was confirmed and then cancelled the panel used to say "Checkout
// finished; confirming with the payment provider" again.
function seen(start:string|null,statuses:ContractPaymentStatus[]){let notice=start;return statuses.map(status=>(notice=nextReturnNotice(notice,status)));}
it('spends the Checkout return notice once the hold is confirmed, so a cancel does not bring it back',()=>{
 expect(seen('complete',['unfunded','unfunded','authorized','unfunded'])).toEqual(['complete','complete',null,null]);
});
it('keeps the notice while the status is still unfunded after return',()=>{
 expect(seen('complete',['unfunded'])).toEqual(['complete']);
 expect(seen('cancelled',['unfunded'])).toEqual(['cancelled']);
 expect(seen('complete',['captured'])).toEqual([null]);
});
