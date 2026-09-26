import { bearerToken, callerProfile } from '../server/caller.js';
import { readServerEnv } from '../server/config.js';
import { serviceClient } from '../server/service.js';
import { sellerGateway } from '../server/connect.js';
import { setupStatus } from '../server/agentSetup.js';
const headers={'cache-control':'no-store'};
export async function GET(request:Request) {
  const env=readServerEnv(); const token=bearerToken(request);
  const caller=env && token ? await callerProfile(env,token) : null;
  if(!caller || !env) return Response.json({error:'Sign in to finish setup'},{status:401,headers});
  const id=new URL(request.url).searchParams.get('id');
  if(!id || (id!=='worker' && !/^[0-9a-f-]{36}$/i.test(id))) return Response.json({error:'Invalid setup link'},{status:400,headers});
  try {
    const status=await setupStatus(serviceClient(),caller.profileId,id==='worker'?undefined:id,env.paymentsEnabled,
      account=>sellerGateway(process.env.STRIPE_SECRET_KEY!).readiness(account));
    return Response.json(status,{headers});
  } catch {return Response.json({error:'Setup request unavailable. Sign in as the owner who issued this agent’s key.'},{status:404,headers});}
}
