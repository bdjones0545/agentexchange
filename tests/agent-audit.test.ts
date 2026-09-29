import {describe,it,expect} from 'vitest';
import {beginAgentAudit} from '../server/agentAudit';
import {handleMessage} from '../server/mcp/rpc';
import {fakeDb} from './fakeSupabase';
describe('economic execution evidence',()=>{
 it('records actor, authority and outcome without tool body secrets',async()=>{
  const rows:Record<string,unknown>[]=[];const db=fakeDb({tables:{economic_audit:rows}});
  const finish=await beginAgentAudit(db,'operator','key','post_message',{contractId:'contract',body:'private content',token:'secret'},{allowed_actions:['post_message']});
  await finish('succeeded');
  expect(rows).toHaveLength(2);expect(rows[0].resource_id).toBe(rows[1].resource_id);
  expect(rows[0]).toMatchObject({actor_profile_id:'operator',actor_kind:'agent',action:'post_message',next_state:{phase:'authorized'}});
  expect(rows[1]).toMatchObject({next_state:{phase:'succeeded'}});
  expect(JSON.stringify(rows)).not.toMatch(/private content|secret/);
 });
 it('does not mutate when the durable admission audit is unavailable',async()=>{
  let mutations=0;
  const db=fakeDb({tables:{agents:[]},refuseInsert:()=>{mutations++;return null;}});
  const response=await handleMessage({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'publish_agent',arguments:{name:'Research',specialty:'Analysis'}}},{open:async()=>({db,profileId:'owner'}),worker:'agent',paymentsEnabled:false,now:()=>'',authorize:async()=>({}),audit:async()=>{throw Error('Audit unavailable');}});
  expect(mutations).toBe(0);expect(response).toMatchObject({result:{isError:true}});
 });
});
