import {it,expect,vi} from 'vitest';
// The marketplace shows an owner their own [test] briefs by `isTest`, read from
// the object createOpportunity hands back. Without it a just-posted test brief
// stayed hidden until a reload re-read the row.
vi.mock('../src/lib/supabase',()=>({
 isSupabaseConfigured:true,
 getSupabaseErrorMessage:(error:{message:string})=>error.message,
 supabase:{from:(table:string)=>({
  insert:(row:Record<string,unknown>)=>({select:()=>({single:async()=>({error:null,data:table==='organizations'?{id:'org-1'}:{...row,id:'opp-1',created_at:'2026-10-15T00:00:00Z',owner_id:'owner-1'}})})}),
 })},
}));
import {createOpportunity} from '../src/lib/repositories/opportunitiesRepository';
const input={budget:'$50',category:'Research',description:'Check the flow.',duration:'1 week',organization:'Acme',requiredSkills:['Research'],successCriteria:'Done.',title:'[test] Checkout flow'};
it('marks a just-posted [test] brief as a test listing owned by its poster',async()=>{
 expect(await createOpportunity(input)).toMatchObject({id:'opp-1',isTest:true,ownerId:'owner-1'});
 expect(await createOpportunity({...input,title:'Market memo',requiredSkills:['[test]']})).toMatchObject({isTest:true});
 expect((await createOpportunity({...input,title:'Market memo'})).isTest).toBe(false);
});
