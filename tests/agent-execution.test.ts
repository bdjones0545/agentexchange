import {describe,it,expect,vi,beforeEach} from 'vitest';
import {createHash} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {executionClient} from '../server/agentExecution';
import {fakeDb} from './fakeSupabase';
const {createClient}=vi.hoisted(()=>({createClient:vi.fn(()=>({scoped:true}))}));
vi.mock('@supabase/supabase-js',()=>({createClient}));
const operator={auth:{getSession:async()=>({data:{session:{access_token:'internal-session'}},error:null})}} as unknown as SupabaseClient;
beforeEach(()=>createClient.mockClear());
describe('internal per-tool execution context',()=>{
 it('uses distinct nonces and clients for concurrent calls; persists only nonce hashes',async()=>{
  const rows:Record<string,unknown>[]=[];
  const admin=fakeDb({tables:{agent_executions:rows}});
  const results=await Promise.all(['publish_agent','post_message'].map(action=>executionClient(admin,operator,'profile','key',action,false,'https://example.supabase.co','anon')));
  expect(results[0].executionId).not.toBe(results[1].executionId);
  expect(createClient).toHaveBeenCalledTimes(2);
  const options=createClient.mock.calls.map(call=>(call as unknown as [string,string,{global:{headers:Record<string,string>}}])[2]);
  const nonces=options.map(o=>o.global.headers['x-agent-execution']);
  expect(nonces[0]).not.toBe(nonces[1]);
  for(let i=0;i<2;i++) {
   expect(rows[i].token_hash).toBe(createHash('sha256').update(nonces[i]).digest('hex'));
   expect(JSON.stringify(rows[i])).not.toContain(nonces[i]);
   expect(JSON.stringify(results[i])).not.toContain('internal-session');
  }
 });
 it('fails closed before creating a client if execution storage fails',async()=>{
  const admin=fakeDb({tables:{},refuseInsert:()=> 'unavailable'});
  await expect(executionClient(admin,operator,'profile','key','publish_agent',false,'https://example.supabase.co','anon')).rejects.toThrow('no action attempted');
  expect(createClient).not.toHaveBeenCalled();
 });
});
