import type {SupabaseClient} from '@supabase/supabase-js';
export interface AgentCard {mode:'shared'|'dedicated';payment_method_id:string|null;card_brand?:string|null;card_last4?:string|null;setup_token?:string|null}
export async function ownedKey(client:SupabaseClient,profileId:string,keyId:string,spending=false) {
 const {data,error}=await client.from('agent_api_keys').select('id,can_spend,revoked_at').eq('id',keyId).eq('profile_id',profileId).maybeSingle();
 if(error || !data || data.revoked_at || (spending && !data.can_spend)) throw Error('Active owner-authorized key required');
}
export async function readAgentCard(client:SupabaseClient,profileId:string,keyId:string,spending=false):Promise<AgentCard|null> {
 await ownedKey(client,profileId,keyId,spending);
 const {data,error}=await client.from('agent_payment_cards').select('mode,payment_method_id,card_brand,card_last4,setup_token').eq('key_id',keyId).eq('profile_id',profileId).maybeSingle();
 if(error) throw Error('Agent card unavailable');
 return data as AgentCard|null;
}
export function selectAgentPaymentMethod(shared:string|null,card:AgentCard|null) {
 if(card?.mode==='dedicated') {if(!card.payment_method_id) throw Error('Dedicated agent card setup is incomplete; ask the owner to finish setup');return card.payment_method_id;}
 if(!shared) throw Error('No saved owner card');
 return shared;
}
