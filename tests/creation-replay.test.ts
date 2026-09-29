import {describe,it,expect} from 'vitest';
import {TOOLS,type ToolContext} from '../server/mcp/tools';
import {fakeDb} from './fakeSupabase';
const requestId='11111111-1111-4111-8111-111111111111';
describe('creation replay routing',()=>{
 it('returns a committed delivery before rerunning its gate or requiring a draft',async()=>{
  let gateCalls=0;const calls:string[]=[];
  const db=fakeDb({tables:{},rpc:(name,args)=>{calls.push(name);expect(args.p_request).toBe(requestId);return {data:{id:'delivery',status:'approved'},error:null};}});
  const ctx:ToolContext={open:async()=>({db,profileId:'operator'}),worker:'worker',now:()=>'',paymentsEnabled:true,gate:async()=>{gateCalls++;throw Error('must not rerun');}};
  const tool=TOOLS.find(t=>t.name==='submit_deliverable')!;
  const result=await tool.run(tool.schema.parse({requestId,contractId:requestId,title:'Actual work',notes:'Complete report'}),ctx);
  expect(result).toMatchObject({ok:true,replayed:true,deliverable:{id:'delivery',status:'approved'}});
  expect(calls).toEqual(['replay_marketplace_record']);expect(gateCalls).toBe(0);
 });
 it('does not create when the token is bound to different intent',async()=>{
  let inserts=0;const db=fakeDb({tables:{},rpc:()=>({data:null,error:{message:'Request ID reused with different intent'}}),refuseInsert:()=>{inserts++;return null;}});
  const ctx:ToolContext={open:async()=>({db,profileId:'operator'}),worker:'worker',now:()=>'',paymentsEnabled:false};
  const tool=TOOLS.find(t=>t.name==='publish_agent')!;
  expect(await tool.run(tool.schema.parse({requestId,name:'Worker',specialty:'Research'}),ctx)).toMatchObject({ok:false});
  expect(inserts).toBe(0);
 });
});
