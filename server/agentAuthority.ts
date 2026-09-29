import type { SupabaseClient } from '@supabase/supabase-js';
export const WORKER_ACTIONS = ['publish_agent','apply_to_opportunity','negotiate_opportunity','respond_to_negotiation','respond_to_hire_request','post_message','submit_deliverable','update_progress'];
export const HIRING_ACTIONS = ['post_opportunity','accept_application','reject_application','counter_negotiation','accept_negotiation','send_hire_request'];
export const REVIEW_ACTIONS = ['review_deliverable'];
export const PAYMENT_ACTIONS = ['fund_contract','release_payment'];
export const ALL_ACTIONS = [...WORKER_ACTIONS,...HIRING_ACTIONS,...REVIEW_ACTIONS,...PAYMENT_ACTIONS];
export type Authority = { allowed_actions: string[]; organization_ids: string[]; paused_at: string|null; revoked_at: string|null; can_spend: boolean; profile_id: string };
export async function readAuthority(db: SupabaseClient, keyId: string, profileId: string): Promise<Authority> {
 const {data,error}=await db.from('agent_api_keys').select('profile_id,allowed_actions,organization_ids,paused_at,revoked_at,can_spend').eq('id',keyId).eq('profile_id',profileId).maybeSingle();
 if(error || !data || data.revoked_at || data.paused_at || !Array.isArray(data.allowed_actions) || !Array.isArray(data.organization_ids)) throw new Error('Agent access unavailable, paused or revoked; ask your owner');
 return data as Authority;
}
export async function authorizeAgentTool(db: SupabaseClient, keyId: string, profileId: string, name: string, input: Record<string,unknown>, readOnly: boolean) {
 const grant=await readAuthority(db,keyId,profileId);
 if(readOnly) return grant;
 if(!grant.allowed_actions.includes(name)) throw new Error('Owner permission required for this action');
 if(PAYMENT_ACTIONS.includes(name) && !grant.can_spend) throw new Error('Owner payment permission required');
 if(['post_message','submit_deliverable','update_progress'].includes(name)) {
  const {data:contract,error}=await db.from('contracts').select('agent_id,organization_id').eq('id',input.contractId).maybeSingle();
  if(error || !contract) throw new Error('Contract unavailable');
  const {data:agent,error:agentError}=await db.from('agents').select('owner_id').eq('id',contract.agent_id).maybeSingle();
  if(agentError || !agent) throw new Error('Worker unavailable');
  if(agent.owner_id!==profileId) {
   if(name!=='post_message' || !grant.organization_ids.includes(contract.organization_id)) throw new Error('Worker ownership or scoped buyer messaging permission required');
   const {data:org,error:orgError}=await db.from('organizations').select('owner_id').eq('id',contract.organization_id).maybeSingle();
   if(orgError || org?.owner_id!==profileId) throw new Error('Organization unavailable');
  }
 }
 if([...HIRING_ACTIONS,...REVIEW_ACTIONS,...PAYMENT_ACTIONS].includes(name)) {
  let organizationId: unknown=input.organizationId;
  let opportunityId: unknown=input.opportunityId;
  let contractId: unknown=input.contractId;
  async function row(table:string,id:unknown) {
   if(typeof id!=='string') throw new Error('An explicit workspace resource is required');
   const {data,error}=await db.from(table).select('*').eq('id',id).maybeSingle();
   if(error || !data) throw new Error('Workspace resource unavailable');
   return data;
  }
  if(input.applicationId) opportunityId=(await row('applications',input.applicationId)).opportunity_id;
  if(input.negotiationId) opportunityId=(await row('negotiations',input.negotiationId)).opportunity_id;
  if(input.deliverableId) contractId=(await row('contract_deliverables',input.deliverableId)).contract_id;
  if(contractId) organizationId=(await row('contracts',contractId)).organization_id;
  if(opportunityId) organizationId=(await row('opportunities',opportunityId)).organization_id;
  if(typeof organizationId!=='string' || !grant.organization_ids.includes(organizationId)) throw new Error('Organization is outside this key’s authority');
  if((await row('organizations',organizationId)).owner_id!==profileId) throw new Error('Organization is not owned by this operator');
 }
 return grant;
}
