import {it,expect,vi} from 'vitest';
// Postgres refuses INSERT ... RETURNING on contracts: the read policy looks the
// row up by id and cannot see it inside the inserting statement. This fake does
// the same, so the test fails if createContract asks for the row back on insert.
const rows=vi.hoisted(()=>[] as Array<Record<string,unknown>>);
vi.mock('../src/lib/supabase',()=>({
 isSupabaseConfigured:true,
 getSupabaseErrorMessage:(error:{message:string})=>error.message,
 supabase:{from:()=>({
  insert:(row:Record<string,unknown>)=>{rows.push(row);const result=Promise.resolve({error:null});return Object.assign(result,{select:()=>({single:async()=>({data:null,error:{message:'new row violates row-level security policy for table "contracts"'}})})});},
  select:()=>({eq:(_column:string,value:unknown)=>({single:async()=>{const row=rows.find(r=>r.id===value);return row?{data:{...row,payment_status:'unfunded'},error:null}:{data:null,error:{message:'not found'}};}})}),
 })},
}));
import {createContract} from '../src/lib/repositories/contractsRepository';
it('creates a contract without INSERT ... RETURNING and reads it back by id',async()=>{
 const created=await createContract({id:'draft',agent:'[test] Agent',agentId:'a1',organization:'Acme',organizationId:'o1',title:'[test] Brief',value:'$50',status:'Active',progress:0,startDate:'',dueDate:'',accent:'violet',sourceId:'app1',sourceType:'application',amountCents:5000} as never);
 expect(rows).toHaveLength(1);
 expect(typeof rows[0].id).toBe('string');
 expect(created.id).toBe(rows[0].id);
 expect(created.sourceType).toBe('application');
});
