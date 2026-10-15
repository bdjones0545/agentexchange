import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {beforeEach,describe,expect,it,vi} from 'vitest';
// An agent's owner sets the job kinds it takes from its profile. The write goes
// through updateAgentJobKinds; RLS lets only the owner update an agent, and a
// non-owner's update matches no rows instead of failing, so the repository has
// to tell that apart from a save.
const env=vi.hoisted(()=>({shared:true,viewer:'owner-1',db:null as unknown}));
vi.mock('../src/lib/supabase',()=>({
 get isSupabaseConfigured(){return env.shared;},
 get supabase(){return env.shared?env.db:null;},
 getSupabaseErrorMessage:(error:{message:string})=>error.message,
}));
vi.mock('../src/state/AuthContext',()=>({useAuth:()=>({isAuthenticated:true,loading:false,user:{id:'user-1'}})}));
import {fakeDb} from './fakeSupabase';
import {agents} from '../src/data/agents';
import {cleanJobKinds} from '../src/lib/jobCatalog';
import {updateAgentJobKinds} from '../src/lib/repositories/agentsRepository';
import {AgentExchangeProvider,useAgentExchange} from '../src/state/AgentExchangeContext';

const AGENT='1e6b8619-585b-4c55-b6ef-975e93f2bf5b';
let rows:Array<Record<string,unknown>>;
beforeEach(()=>{
 env.shared=true;env.viewer='owner-1';
 rows=[{id:AGENT,owner_id:'owner-1',name:'Research bot',job_kinds:[]}];
 env.db=fakeDb({tables:{agents:rows},canUpdate:(table,row)=>table!=='agents'||row.owner_id===env.viewer});
});

describe('cleanJobKinds',()=>{
 it('keeps catalog ids once each and maps the legacy alias to its catalog id',()=>{
  expect(cleanJobKinds(['seo','research_report','seo'])).toEqual(['seo','research_report']);
  expect(cleanJobKinds(['other','other_managed'])).toEqual(['other_managed']);
 });
 it('refuses ids the catalog does not have, and an empty list',()=>{
  expect(()=>cleanJobKinds(['seo','web_scraping'])).toThrow('Unknown job kinds: web_scraping.');
  expect(()=>cleanJobKinds([])).toThrow('Pick at least one job');
 });
});

describe('updateAgentJobKinds',()=>{
 it("stores the owner's picks on the agent and resolves to what was stored",async()=>{
  await expect(updateAgentJobKinds(AGENT,['seo','research_report','seo'])).resolves.toEqual(['seo','research_report']);
  expect(rows[0].job_kinds).toEqual(['seo','research_report']);
 });
 it('reports a refusal when RLS matched no row, and leaves the agent as it was',async()=>{
  env.viewer='someone-else';
  await expect(updateAgentJobKinds(AGENT,['seo'])).rejects.toThrow("Only this agent's owner can change the jobs it takes.");
  expect(rows[0].job_kinds).toEqual([]);
 });
 it('never sends ids outside the catalog to the database',async()=>{
  await expect(updateAgentJobKinds(AGENT,['Totally Custom'])).rejects.toThrow('Unknown job kinds');
  expect(rows[0].job_kinds).toEqual([]);
 });
 it('surfaces a database error instead of swallowing it',async()=>{
  env.db=fakeDb({tables:{agents:rows},refuseUpdate:()=>'permission denied for table agents'});
  await expect(updateAgentJobKinds(AGENT,['seo'])).rejects.toThrow('Unable to update agent: permission denied for table agents');
 });
});

describe('the updateAgentJobKinds context action',()=>{
 function context(){
  let value:ReturnType<typeof useAgentExchange>|undefined;
  function Probe(){value=useAgentExchange();return null;}
  const agent={...agents[0],id:AGENT,ownerId:'owner-1',createdAt:'2026-10-15T00:00:00Z',jobKinds:[]};
  renderToStaticMarkup(createElement(AgentExchangeProvider,{initialState:{createdAgents:[agent]}},createElement(Probe)));
  return value!;
 }
 it("refuses, before any write, a signed-in viewer who does not own the agent",async()=>{
  // No profile has loaded for this viewer, so they own nothing.
  const {ownsAgent,updateAgentJobKinds:update}=context();
  expect(ownsAgent(AGENT)).toBe(false);
  await expect(update(AGENT,['seo'])).rejects.toThrow("Only this agent's owner can change the jobs it takes.");
  expect(rows[0].job_kinds).toEqual([]);
 });
 it('in demo mode keeps the cleaned picks in memory without touching the database',async()=>{
  env.shared=false;
  const {updateAgentJobKinds:update}=context();
  await expect(update(AGENT,['social','other','social'])).resolves.toEqual(['social','other_managed']);
  await expect(update(AGENT,[])).rejects.toThrow('Pick at least one job');
  expect(rows[0].job_kinds).toEqual([]);
 });
});
