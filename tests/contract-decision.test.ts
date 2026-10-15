import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {it,expect,vi} from 'vitest';
// The database refuses deliverable decisions from an organization owner who also
// owns the agent, so that viewer gets a note instead of Approve/Reject.
const viewer=vi.hoisted(()=>({ownsAgent:false,ownsOrganization:true}));
vi.mock('../src/state/AgentExchangeContext',()=>{
 const contract={id:'c1',sourceId:'a1',sourceType:'application',organizationId:'o1',organization:'Acme',agentId:'agent-1',agent:'Analyst',title:'Market memo',value:'$50',status:'In Review',startDate:'2026-10-01',dueDate:'2026-10-31',progress:50,accent:'violet',amountCents:5000,currency:'USD',paymentStatus:'authorized',platformFeeBps:1500};
 const workspace={contractId:'c1',milestones:[],deliverables:[{id:'d1',title:'Report',notes:'',status:'submitted',decisions:[],createdAt:'2026-10-02T00:00:00Z'}],messages:[],activity:[],updatedAt:'2026-10-02T00:00:00Z'};
 const noop=()=>undefined;
 return {useAgentExchange:()=>({
  addAgentReview:noop,addContractDeliverable:noop,addContractMilestone:noop,agentReviews:[],
  canDecideContract:()=>viewer.ownsOrganization,canResolveDispute:()=>false,contractDisputes:[],
  getContractWorkspace:()=>workspace,localContracts:[contract],openContractDispute:noop,sendContractMessage:noop,
  setDeliverableStatus:noop,toggleMilestoneComplete:noop,updateContractDispute:noop,updateMilestoneNotes:noop,
  loading:false,createdAgents:[],isSharedMode:true,isWorkerAgent:()=>false,ownsAgent:()=>viewer.ownsAgent,refresh:async()=>undefined,
 })};
});
import {ContractDetailPage} from '../src/routes/ContractDetailPage';
function page(){return renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:['/contracts/c1']},createElement(Routes,null,createElement(Route,{path:'/contracts/:id',element:createElement(ContractDetailPage)}))));}
const DECISION='aria-label="Approval or rejection note"';
it('offers Approve and Reject to an organization owner who does not own the agent',()=>{
 Object.assign(viewer,{ownsAgent:false,ownsOrganization:true});
 const html=page();
 expect(html).toContain(DECISION);
 expect(html).toContain('1 deliverable awaits your decision');
 expect(html).not.toContain('You own both');
});
it('shows a note instead of Approve and Reject to a viewer who owns the organization and the agent',()=>{
 Object.assign(viewer,{ownsAgent:true,ownsOrganization:true});
 const html=page();
 expect(html).not.toContain(DECISION);
 expect(html).not.toContain('awaits your decision');
 expect(html).toContain('You own both the organization and the agent on this contract');
});
it('leaves the agent side as it was',()=>{
 Object.assign(viewer,{ownsAgent:true,ownsOrganization:false});
 const html=page();
 expect(html).not.toContain(DECISION);
 expect(html).not.toContain('You own both');
 expect(html).toContain("Awaiting the organization&#x27;s decision.");
});
