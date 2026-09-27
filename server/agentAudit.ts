import {randomUUID} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
/** No request bodies, credentials, card details or provider error text in this journal. */
export async function beginAgentAudit(db:SupabaseClient,profileId:string,keyId:string|undefined,action:string,input:Record<string,unknown>,authority:unknown,executionId=randomUUID()) {
 const resources=Object.fromEntries(Object.entries(input).filter(([key,value])=>['organizationId','opportunityId','applicationId','negotiationId','contractId','deliverableId','agentId','hireRequestId'].includes(key) && typeof value==='string'));
 const record={execution_id:executionId,actor_profile_id:profileId,actor_kind:'agent',resource_table:'mcp_execution',resource_id:executionId,organization_id:resources.organizationId ?? null,authority:{keyId:keyId ?? null,grant:authority,resources},action};
 const {error}=await db.from('economic_audit').insert({...record,next_state:{phase:'authorized'}});
 if(error) throw new Error('Audit unavailable; no action attempted');
 return async(outcome:'succeeded'|'failed'|'uncertain')=>{
  const {error}=await db.from('economic_audit').insert({...record,next_state:{phase:outcome}});
  if(error) throw new Error('Audit completion unavailable; inspect the resource before retrying');
 };
}
