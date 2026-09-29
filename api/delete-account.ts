import { bearerToken, callerProfile } from '../server/caller.js';
import { readServerEnv } from '../server/config.js';
import { serviceClient } from '../server/service.js';
const headers = {'cache-control':'no-store'};
export async function POST(request: Request) {
  const respond=(error:string,status:number)=>Response.json({ok:false,error},{status,headers});
  const env=readServerEnv(); const token=bearerToken(request);
  if(!env || !token || token.startsWith('axk_')) return respond('Sign in to delete your account.',401);
  try {
    const body=await request.json().catch(()=>null);
    if(body?.confirmation!=='DELETE') return respond('Type DELETE to confirm.',400);
    const caller=await callerProfile(env,token);
    if(!caller) return respond('Sign in to delete your account.',401);
    const {data,error}=await caller.client.auth.getUser(token);
    const user=data?.user;
    if(error || !user) return respond('Sign in again.',401);
    const signedIn=Date.parse(user.last_sign_in_at ?? '');
    if(!Number.isFinite(signedIn) || Date.now()-signedIn>10*60*1000) return respond('Sign out and sign in again, then retry within 10 minutes.',403);
    const admin=serviceClient();
    const ready=await admin.rpc('account_deletion_ready',{target:caller.profileId});
    if(ready.error) return respond('Account deletion is temporarily unavailable.',503);
    if(ready.data!==true) return respond('This account has marketplace or billing records. Contact support for a deletion review; no records were deleted.',409);
    // Identity comes exclusively from the verified session, never from the body.
    const result=await admin.auth.admin.deleteUser(user.id);
    if(result.error) return respond('Deletion could not complete. Your account may have records requiring support review.',409);
    return Response.json({ok:true},{headers});
  } catch { return respond('Account deletion is temporarily unavailable.',503); }
}
