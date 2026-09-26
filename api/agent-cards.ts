import {randomUUID} from 'node:crypto';
import {bearerToken,callerProfile} from '../server/caller.js';
import {readServerEnv} from '../server/config.js';
import {serviceClient} from '../server/service.js';
import {ownedKey} from '../server/agentCards.js';
import {createCardSetup} from '../server/funding.js';
import {supabaseLedger} from '../server/ledger.js';
import {operationStore} from '../server/moneyOperations.js';
import {realStripe} from '../server/stripe.js';
const headers={'cache-control':'no-store'};
export async function POST(request:Request) {
 const env=readServerEnv();const token=bearerToken(request);
 const caller=env && token ? await callerProfile(env,token):null;
 if(!caller || !env) return Response.json({error:'Unauthorized'},{status:401,headers});
 if(!env.paymentsEnabled) return Response.json({error:'Payments disabled'},{status:503,headers});
 const body=await request.json().catch(()=>null);
 if(!body || typeof body.keyId!=='string' || !/^[0-9a-f-]{36}$/i.test(body.keyId) || !['setup','shared'].includes(body.action)) return Response.json({error:'Invalid card request'},{status:400,headers});
 const client=serviceClient();
 try {await ownedKey(client,caller.profileId,body.keyId);} catch {return Response.json({error:'Active key not found for this owner'},{status:404,headers});}
 try {
  const setupToken=body.action==='setup'?randomUUID():null;
  const {error}=await client.from('agent_payment_cards').upsert({key_id:body.keyId,profile_id:caller.profileId,mode:body.action==='setup'?'dedicated':'shared',setup_token:setupToken,payment_method_id:null,card_brand:null,card_last4:null,updated_at:new Date().toISOString()},{onConflict:'key_id'});
  if(error) throw Error('Could not save card choice');
  if(body.action==='shared') return Response.json({ok:true},{headers});
  const result=await createCardSetup({ledger:supabaseLedger(client),operations:operationStore(client),stripe:realStripe(process.env.STRIPE_SECRET_KEY!),appUrl:env.appUrl},{profileId:caller.profileId,email:caller.email ?? undefined,agentKeyId:body.keyId,setupToken:setupToken!});
  return Response.json({ok:true,...result},{headers});
 } catch {return Response.json({error:'Card setup unavailable. Retry setup or explicitly select the shared owner card.'},{status:503,headers});}
}
