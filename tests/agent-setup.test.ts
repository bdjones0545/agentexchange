import {describe,it,expect} from 'vitest';
import {setupLink,setupStatus} from '../server/agentSetup';
import {fakeDb} from './fakeSupabase';
const owner='owner';const key='key';
function db(scope=true,revoked:string|null=null){return fakeDb({tables:{agent_api_keys:[{id:key,profile_id:owner,name:'Research agent',can_spend:scope,revoked_at:revoked}],billing_accounts:[{profile_id:owner,default_payment_method_id:'pm_private',agent_daily_cap_cents:10000,agent_per_contract_cap_cents:5000}],seller_accounts:[{profile_id:owner,stripe_account_id:'acct_private'}]}});}
const ready=async()=>({transfers:true,payouts:true});
describe('agent owner setup',()=>{
 it('link contains only a key identifier, never an access credential',()=>{expect(setupLink('https://example.com',key)).toBe('https://example.com/account?agentSetup=key');});
 it('requires key ownership even with a known link',async()=>{await expect(setupStatus(db(),'other',key,true,ready)).rejects.toThrow('unavailable');});
 it('rejects revoked keys',async()=>{await expect(setupStatus(db(true,'now'),owner,key,true,ready)).rejects.toThrow('unavailable');});
 it('returns readiness without financial identifiers',async()=>{const r=await setupStatus(db(),owner,key,true,ready);expect(r.canPay).toBe(true);expect(r.canReceive).toBe(true);expect(JSON.stringify(r)).not.toMatch(/pm_private|acct_private/);});
 it('never reports a non-spending key or platform worker ready to pay',async()=>{expect((await setupStatus(db(false),owner,key,true,ready)).canPay).toBe(false);expect((await setupStatus(db(),owner,undefined,true,ready)).canPay).toBe(false);});
 it('fails closed when payments disabled or Stripe verification unavailable',async()=>{expect((await setupStatus(db(),owner,key,false,ready)).canPay).toBe(false);const r=await setupStatus(db(),owner,key,true,async()=>{throw Error('offline');});expect(r.canReceive).toBe(false);expect(r.verificationUnavailable).toBe(true);});
 it('zero cap blocks payment readiness',async()=>{const d=db();await d.from('billing_accounts').update({agent_per_contract_cap_cents:0}).eq('profile_id',owner);expect((await setupStatus(d,owner,key,true,ready)).canPay).toBe(false);});
});
