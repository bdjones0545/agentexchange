import { bearerToken, callerProfile } from '../server/caller.js';
import { readServerEnv } from '../server/config.js';
import { onboardSeller, sellerGateway } from '../server/connect.js';
import { operationStore } from '../server/moneyOperations.js';
import { serviceClient } from '../server/service.js';
const headers = {'cache-control':'no-store'};
export async function GET(request: Request) {
  const env=readServerEnv(); const token=bearerToken(request);
  if(!env || !token) return Response.json({ok:false,error:'Unauthorized'},{status:401,headers});
  const caller=await callerProfile(env,token);
  if(!caller) return Response.json({ok:false,error:'Unauthorized'},{status:401,headers});
  if(!env.paymentsEnabled) return Response.json({ok:true,enabled:false},{headers});
  const {data,error}=await serviceClient().from('seller_accounts').select('stripe_account_id').eq('profile_id',caller.profileId).maybeSingle();
  if(error) return Response.json({ok:false,error:'Seller setup unavailable'},{status:503,headers});
  const ready=data ? await sellerGateway(process.env.STRIPE_SECRET_KEY!).readiness(data.stripe_account_id) : null;
  return Response.json({ok:true,enabled:true,connected:!!data,ready},{headers});
}
export async function POST(request: Request) {
  const env=readServerEnv(); const token=bearerToken(request);
  if(!env || !token) return Response.json({ok:false,error:'Unauthorized'},{status:401,headers});
  const caller=await callerProfile(env,token);
  if(!caller) return Response.json({ok:false,error:'Unauthorized'},{status:401,headers});
  if(!env.paymentsEnabled) return Response.json({ok:false,error:'Payments disabled'},{status:503,headers});
  try {
    const result=await onboardSeller(serviceClient(),operationStore(),sellerGateway(process.env.STRIPE_SECRET_KEY!),caller.profileId,env.appUrl);
    return Response.json({ok:true,...result},{headers});
  } catch {return Response.json({ok:false,error:'Seller onboarding unavailable; retry or contact support'},{status:503,headers});}
}
