import {describe,it,expect} from 'vitest';
import {authorizeAgentTool,WORKER_ACTIONS,ALL_ACTIONS} from '../server/agentAuthority';
import {fakeDb} from './fakeSupabase';
import {TOOLS} from '../server/mcp/tools';
import {handleMessage} from '../server/mcp/rpc';
const profile='buyer'; const key='key';
function fixture(patch:Record<string,unknown>={}) {
 const grant={id:key,profile_id:profile,allowed_actions:[...WORKER_ACTIONS,'review_deliverable','fund_contract','post_opportunity'],organization_ids:['org'],can_spend:true,paused_at:null,revoked_at:null,...patch};
 const db=fakeDb({tables:{agent_api_keys:[grant],organizations:[{id:'org',owner_id:profile},{id:'other',owner_id:'other'}],contracts:[{id:'contract',organization_id:'org'},{id:'outside',organization_id:'other'}],contract_deliverables:[{id:'delivery',contract_id:'contract'}]}});
 return {db,grant};
}
describe('bounded agent authority',()=>{
 it('every mutating capability has an explicit grant name',()=>{expect(TOOLS.filter(t=>!t.readOnly).map(t=>t.name).sort()).toEqual([...ALL_ACTIONS].sort());});
 it('allows an explicitly granted action in its organization',async()=>{const {db}=fixture();await expect(authorizeAgentTool(db,key,profile,'fund_contract',{contractId:'contract'},false)).resolves.toBeDefined();});
 it('denies an action not granted, including permission expansion',async()=>{const {db}=fixture();await expect(authorizeAgentTool(db,key,profile,'grant_permissions',{},false)).rejects.toThrow(/permission/);});
 it('worker defaults cannot approve',async()=>{const {db}=fixture({allowed_actions:WORKER_ACTIONS});await expect(authorizeAgentTool(db,key,profile,'review_deliverable',{deliverableId:'delivery'},false)).rejects.toThrow(/permission/);});
 it('rejects cross-workspace economic resources',async()=>{const {db}=fixture();await expect(authorizeAgentTool(db,key,profile,'fund_contract',{contractId:'outside'},false)).rejects.toThrow(/outside/);});
 it('resolves review scope through the deliverable and contract',async()=>{const {db}=fixture();await expect(authorizeAgentTool(db,key,profile,'review_deliverable',{deliverableId:'delivery'},false)).resolves.toBeDefined();});
 it('requires explicit workspace when posting',async()=>{const {db}=fixture();await expect(authorizeAgentTool(db,key,profile,'post_opportunity',{},false)).rejects.toThrow(/outside/);});
 it.each(['paused_at','revoked_at'])('rechecks %s between calls',async(field)=>{const {db,grant}=fixture();await authorizeAgentTool(db,key,profile,'fund_contract',{contractId:'contract'},false);grant[field]='now';await expect(authorizeAgentTool(db,key,profile,'fund_contract',{contractId:'contract'},false)).rejects.toThrow(/paused or revoked/);});
 it('cannot read with a paused key',async()=>{const {db}=fixture({paused_at:'now'});await expect(authorizeAgentTool(db,key,profile,'whoami',{},true)).rejects.toThrow(/paused/);});
 it('payment flag alone cannot grant actions',async()=>{const {db}=fixture({allowed_actions:WORKER_ACTIONS});await expect(authorizeAgentTool(db,key,profile,'fund_contract',{contractId:'contract'},false)).rejects.toThrow(/permission/);});
 it('action alone cannot grant payments',async()=>{const {db}=fixture({can_spend:false});await expect(authorizeAgentTool(db,key,profile,'fund_contract',{contractId:'contract'},false)).rejects.toThrow(/payment permission/);});
 it('MCP dispatcher enforces authorization before opening mutation tool',async()=>{
  let opened=false;
  const result=await handleMessage({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'publish_agent',arguments:{name:'Worker',specialty:'Research'}}},{open:async()=>{opened=true;throw Error('must not run');},authorize:async()=>{throw Error('paused');},worker:'agent',paymentsEnabled:false,now:()=>''});
  expect(opened).toBe(false);expect(result).toMatchObject({result:{isError:true}});
 });
});
