import {describe,it,expect} from 'vitest';
import {fakeDb} from './fakeSupabase';
import {readAgentCard} from '../server/agentCards';
import {supabaseLedger} from '../server/ledger';
function seeded(){return fakeDb({tables:{agent_api_keys:[{id:'key',profile_id:'owner',can_spend:true,revoked_at:null}],agent_payment_cards:[{key_id:'key',profile_id:'owner',mode:'dedicated',setup_token:'new',payment_method_id:null}]}});}
describe('agent card authorization',()=>{
 it('rejects foreign owners and keys without spending permission',async()=>{const d=seeded();await expect(readAgentCard(d,'stranger','key',true)).rejects.toThrow();await d.from('agent_api_keys').update({can_spend:false}).eq('id','key');await expect(readAgentCard(d,'owner','key',true)).rejects.toThrow();});
 it('only saves the latest active setup token',async()=>{const d=seeded();const l=supabaseLedger(d);expect(await l.saveAgentCard!('owner','key','old',{id:'pm_old',brand:'visa',last4:'4242'})).toBe(false);expect(await l.saveAgentCard!('owner','key','new',{id:'pm_new',brand:'visa',last4:'4242'})).toBe(true);expect((await readAgentCard(d,'owner','key'))?.payment_method_id).toBe('pm_new');});
 it('ignores setup completion after switching to shared or revoking the key',async()=>{const d=seeded();const l=supabaseLedger(d);await d.from('agent_payment_cards').update({mode:'shared'}).eq('key_id','key');expect(await l.saveAgentCard!('owner','key','new',{id:'pm',brand:null,last4:null})).toBe(false);await d.from('agent_payment_cards').update({mode:'dedicated'}).eq('key_id','key');await d.from('agent_api_keys').update({revoked_at:'now'}).eq('id','key');expect(await l.saveAgentCard!('owner','key','new',{id:'pm',brand:null,last4:null})).toBe(false);});
});
