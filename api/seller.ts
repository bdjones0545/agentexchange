import { bearerToken, callerProfile } from '../server/caller.js';
import { readServerEnv } from '../server/config.js';
import { onboardSeller, sellerGateway } from '../server/connect.js';
import { failureLabel, operationStore } from '../server/moneyOperations.js';
import { serviceClient } from '../server/service.js';
import { supportEmail } from '../src/content/publicRoutes.js';
import { isPayoutCountry, unsupportedCountryMessage } from '../src/lib/payoutCountries.js';
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
  if(!caller.email) return Response.json({ok:false,error:'A verified email is required for seller setup'},{status:400,headers});
  let body: {country?:unknown};
  try {body=await request.json();} catch {return Response.json({ok:false,error:'Invalid request'},{status:400,headers});}
  const country=typeof body.country==='string' ? body.country.trim().toUpperCase() : '';
  // An operator who already started setup continues it; the country was fixed then.
  const {data:existing,error:readError}=await serviceClient().from('seller_accounts').select('stripe_account_id').eq('profile_id',caller.profileId).maybeSingle();
  if(readError) return Response.json({ok:false,error:'Payout setup is unavailable right now. Please try again in a few minutes.'},{status:503,headers});
  if(!existing) {
    if(!/^[A-Z]{2}$/.test(country)) return Response.json({ok:false,error:'Choose the country where you or your business is legally based.'},{status:400,headers});
    // Refuse before Stripe does, with a reason the operator can act on.
    if(!isPayoutCountry(country)) return Response.json({ok:false,code:'unsupported_country',error:unsupportedCountryMessage(country)},{status:422,headers});
  }
  try {
    const result=await onboardSeller(serviceClient(),operationStore(),sellerGateway(process.env.STRIPE_SECRET_KEY!),caller.profileId,env.appUrl,caller.email,country);
    return Response.json({ok:true,...result},{headers});
  } catch (e) {
    // The reason, never the provider's free-text message (it can contain personal data).
    console.error(JSON.stringify({event:'seller_onboarding',ok:false,reason:failureLabel(e),country:country||null}));
    return Response.json({ok:false,error:`Stripe couldn't start payout setup just now. Please try again in a few minutes. If it keeps failing, email ${supportEmail} from your account email.`},{status:503,headers});}
}
