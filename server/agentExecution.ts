import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
/** Internal context is scoped per tool, never attached to a shared cached client. */
export async function executionClient(admin:SupabaseClient,operator:SupabaseClient,profileId:string,keyId:string|undefined,action:string,readOnly:boolean,url:string,anonKey:string) {
 const nonce=randomBytes(32).toString('base64url');
 const executionId=randomUUID();
 const {data:session,error:sessionError}=await operator.auth.getSession();
 if(sessionError || !session.session?.access_token) throw new Error('Operator session unavailable');
 const {error}=await admin.from('agent_executions').insert({id:executionId,token_hash:createHash('sha256').update(nonce).digest('hex'),profile_id:profileId,key_id:keyId ?? null,action,read_only:readOnly,expires_at:new Date(Date.now()+300_000).toISOString()});
 if(error) throw new Error('Execution authority unavailable; no action attempted');
 const db=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:`Bearer ${session.session.access_token}`,'x-agent-execution':nonce}}});
 return {db,executionId};
}
