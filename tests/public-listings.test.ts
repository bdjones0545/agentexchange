import {it,expect} from 'vitest';
import {mentionsTestListing,publicContracts,publicListings,showHomeCounters} from '../src/lib/publicListings';
import {getLiveActivity,getLiveMarketplaceMetrics} from '../src/data/liveMetrics';
import {getAllAgents,getAllOpportunities} from '../src/data/localSelectors';
it('excludes title and data fixture markers before discovery',()=>{
 const rows=[{title:'TEST PILOT report'},{title:'Real brief',is_test:true},{title:'Report',tags:['[test]']},{title:'Public report'}];
 expect(publicListings(rows)).toEqual([{title:'Public report'}]);
 expect(getAllOpportunities(rows as never,{sharedMode:true})).toEqual([{title:'Public report'}]);
});
it('requires both credibility thresholds',()=>{expect(showHomeCounters(25,9)).toBe(false);expect(showHomeCounters(24,10)).toBe(false);expect(showHomeCounters(25,10)).toBe(true);});
it('keeps fixture briefs out of the activity feed and public contract counts',()=>{
 expect(mentionsTestListing('Analyst received a hire request for [test] Google owner workflow verification.')).toBe(true);
 expect(mentionsTestListing('Analyst received a hire request for Competitive scan: youth strength-training programs.')).toBe(false);
 const feed=getLiveActivity([
  {id:'t',agentId:'x',agentName:'Analyst',type:'hire_request_submitted',message:'Analyst received a hire request for [test] Checkout.',createdAt:'2026-09-27T00:00:00Z'},
  {id:'r',agentId:'x',agentName:'Analyst',type:'hire_request_submitted',message:'Analyst received a hire request for Market memo.',createdAt:'2026-09-18T00:00:00Z'},
 ] as never,6,Date.parse('2026-09-28T00:00:00Z'));
 expect(feed.map(item=>item.id)).toEqual(['r']);
 expect(publicContracts([{title:'TEST PILOT: checklist'},{title:'Market memo'}])).toEqual([{title:'Market memo'}]);
 const metrics=getLiveMarketplaceMetrics({agents:[],opportunities:[],hireRequests:[],contracts:[{title:'[test] Flow',status:'Active'},{title:'Market memo',status:'Active'}] as never});
 expect(metrics.find(m=>m.id==='contracts')?.value).toBe('1');
});
it('keeps fixture agents out of the public directory',()=>{
 expect(getAllAgents([{name:'[test] Research bot'},{name:'Research and Writing Analyst'}] as never).map(a=>a.name)).toEqual(['Research and Writing Analyst']);
});
