import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {it,expect,vi} from 'vitest';
// The profile's "Jobs it takes" card: its owner can edit the list and is asked
// to add jobs when there are none; everyone else only sees the list.
const viewer=vi.hoisted(()=>({owns:false,jobKinds:[] as string[]}));
vi.mock('../src/state/AgentExchangeContext',async()=>{
 const {agents}=await import('../src/data/agents');
 const noop=()=>undefined;
 return {useAgentExchange:()=>({
  agentActivities:[],agentReviews:[],applications:[],approveSuggestedAgentAction:noop,contractDisputes:[],contractWorkspaces:[],
  createdAgents:[{...agents[0],id:'agent-1',ownerId:'owner-1',createdAt:'2026-10-15T00:00:00Z',jobKinds:viewer.jobKinds}],
  createdOpportunities:[],hireRequests:[],isSharedMode:true,isWorkerAgent:()=>false,loading:false,localContracts:[],negotiations:[],
  ownsAgent:()=>viewer.owns,ownsOpportunity:()=>false,submitHireRequest:noop,updateAgentJobKinds:async()=>viewer.jobKinds,
 })};
});
import {AgentProfilePage} from '../src/routes/AgentProfilePage';
import {JobKindPicker} from '../src/components/JobKindPicker';
import {JOB_KINDS} from '../src/lib/jobCatalog';
function page(owns:boolean,jobKinds:string[]){
 Object.assign(viewer,{owns,jobKinds});
 return renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:['/agent/agent-1']},createElement(Routes,null,createElement(Route,{path:'/agent/:id',element:createElement(AgentProfilePage)}))));
}
const EDIT='>Edit</button>';
it('prompts the owner of an agent with no job kinds to add them',()=>{
 const html=page(true,[]);
 expect(html).toContain('Jobs it takes');
 expect(html).toContain('No jobs picked yet');
 expect(html).toContain('>Add jobs</button>');
 expect(html).not.toContain(EDIT);
});
it("lets the owner edit an agent's job kinds",()=>{
 const html=page(true,['research_report','seo']);
 expect(html).toContain('Research report');
 expect(html).toContain('SEO');
 expect(html).toContain(EDIT);
 expect(html).not.toContain('Add jobs');
});
it('shows other viewers the job kinds without a way to change them',()=>{
 const html=page(false,['research_report','seo']);
 expect(html).toContain('Jobs it takes');
 expect(html).toContain('Research report');
 expect(html).not.toContain(EDIT);
 expect(html).not.toContain('Add jobs');
});
it('shows other viewers nothing for an agent with no job kinds',()=>{
 const html=page(false,[]);
 expect(html).not.toContain('Jobs it takes');
 expect(html).not.toContain('Add jobs');
});
it('offers every catalog kind as a chip and marks the picked ones',()=>{
 const html=renderToStaticMarkup(createElement(JobKindPicker,{onToggle:()=>undefined,selected:['seo','research_report']}));
 expect((html.match(/aria-pressed=/g)||[]).length).toBe(JOB_KINDS.length);
 expect((html.match(/aria-pressed="true"/g)||[]).length).toBe(2);
 expect(html.indexOf('One-off work')).toBeLessThan(html.indexOf('Ongoing weekly work'));
});
