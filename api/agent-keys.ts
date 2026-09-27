// Agent API keys for the signed-in operator.
//   GET    /api/agent-keys            list (prefix, name, dates; never the key)
//   POST   /api/agent-keys {name}     mint one; the raw key is returned ONCE
//   DELETE /api/agent-keys {id}       revoke (irreversible)
// Everything runs under the caller's own session; RLS owns the rows.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ALL_ACTIONS, WORKER_ACTIONS, PAYMENT_ACTIONS } from "../server/agentAuthority.js";
import { mintKey } from "../server/agentKeys.js";
import { bearerToken } from "../server/caller.js";
import { readServerEnv } from "../server/config.js";

const NO_STORE = { "cache-control": "no-store" };

function unauthorized() {
  return Response.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: { ...NO_STORE, "www-authenticate": "Bearer" } });
}

function userClient(request: Request) {
  const env = readServerEnv();
  if (!env) return null;
  const token = bearerToken(request);
  if (!token) return null;
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export async function GET(request: Request): Promise<Response> {
  const client = userClient(request);
  if (!client) return unauthorized();
  const { data, error } = await client
    .from("agent_api_keys")
    .select("id,name,key_prefix,created_at,last_used_at,revoked_at,can_spend,paused_at,allowed_actions,organization_ids")
    .order("created_at", { ascending: false });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 400, headers: NO_STORE });
  return Response.json({ ok: true, keys: data ?? [] }, { headers: NO_STORE });
}

export async function POST(request: Request): Promise<Response> {
  const client = userClient(request);
  if (!client) return unauthorized();
  let body: GrantBody;
  try {
    body = (await request.json()) as GrantBody;
  } catch {
    return Response.json({ ok: false, error: "invalid JSON" }, { status: 400, headers: NO_STORE });
  }
  if(!body || typeof body!=="object" || Array.isArray(body)) return Response.json({error:"Invalid request"},{status:400,headers:NO_STORE});
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!name) return Response.json({ ok: false, error: "name required" }, { status: 400, headers: NO_STORE });
  let grant;
  try { grant = await validatedGrant(client, body); } catch { return Response.json({error:"Invalid authority or organization scope"},{status:400,headers:NO_STORE}); }
  const key = mintKey();
  const { data, error } = await client
    .from("agent_api_keys")
    .insert({ name, ...grant, key_hash: key.hash, key_prefix: key.prefix })
    .select("id,name,key_prefix,created_at")
    .single();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 400, headers: NO_STORE });
  return Response.json({ ok: true, key: key.raw, record: data }, { headers: NO_STORE });
}

export async function DELETE(request: Request): Promise<Response> {
  const client = userClient(request);
  if (!client) return unauthorized();
  let body: { id?: unknown };
  try {
    body = (await request.json()) as { id?: unknown };
  } catch {
    return Response.json({ ok: false, error: "invalid JSON" }, { status: 400, headers: NO_STORE });
  }
  if (!body || typeof body.id !== "string") return Response.json({ ok: false, error: "id required" }, { status: 400, headers: NO_STORE });
  const { data, error } = await client
    .from("agent_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", body.id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 400, headers: NO_STORE });
  if (!data) return Response.json({ ok: false, error: "key not found or already revoked" }, { status: 404, headers: NO_STORE });
  return Response.json({ ok: true }, { headers: NO_STORE });
}

type GrantBody = {id?: unknown; name?: unknown; canSpend?: unknown; allowedActions?: unknown; organizationIds?: unknown; paused?: unknown};
async function validatedGrant(client: SupabaseClient, body: GrantBody) {
  const actions = body.allowedActions ?? WORKER_ACTIONS;
  const orgs = body.organizationIds ?? [];
  if (!Array.isArray(actions) || actions.length>ALL_ACTIONS.length || actions.some(a => typeof a !== 'string' || !ALL_ACTIONS.includes(a)) || !Array.isArray(orgs) || orgs.length>100 || orgs.some(id => typeof id !== 'string')) throw new Error('Invalid grant');
  if (body.canSpend !== undefined && typeof body.canSpend !== 'boolean') throw new Error('Invalid payment grant');
  const {data: auth,error: authError} = await client.auth.getUser();
  if (authError || !auth.user) throw new Error('Unauthorized');
  const {data: profile,error} = await client.from('profiles').select('id').eq('user_id',auth.user.id).single();
  if(error || !profile) throw new Error('Profile required');
  if(orgs.length) {
    const {data,error: orgError}=await client.from('organizations').select('id').eq('owner_id',profile.id).in('id',orgs);
    if(orgError || new Set(data?.map(o=>o.id)).size!==new Set(orgs).size) throw new Error('Invalid organization');
  }
  return {allowed_actions:[...new Set(actions)],organization_ids:[...new Set(orgs)],can_spend:body.canSpend===true};
}

/** Owner session only; agent credentials cannot use this endpoint. */
export async function PATCH(request: Request): Promise<Response> {
  const client=userClient(request);
  if(!client) return unauthorized();
  let body: GrantBody;
  try {body=await request.json();} catch {return Response.json({error:'Invalid request'},{status:400,headers:NO_STORE});}
  if(!body || typeof body.id!=='string') return Response.json({error:'Key required'},{status:400,headers:NO_STORE});
  const {data:existing,error:readError}=await client.from('agent_api_keys').select('allowed_actions,organization_ids,can_spend').eq('id',body.id).is('revoked_at',null).maybeSingle();
  if(readError || !existing) return Response.json({error:'Active key not found'},{status:404,headers:NO_STORE});
  let patch: Record<string,unknown>;
  try {
    // The existing card-management switch explicitly grants payment actions only.
    let actions=body.allowedActions ?? existing.allowed_actions;
    if(body.canSpend!==undefined && body.allowedActions===undefined) actions=body.canSpend ? [...new Set([...actions,...PAYMENT_ACTIONS])] : actions.filter((a:string)=>!PAYMENT_ACTIONS.includes(a));
    patch=await validatedGrant(client,{...body,allowedActions:actions,organizationIds:body.organizationIds ?? existing.organization_ids,canSpend:body.canSpend ?? existing.can_spend});
    if(body.paused!==undefined) {
      if(typeof body.paused!=='boolean') throw new Error('Invalid pause');
      patch.paused_at=body.paused ? new Date().toISOString() : null;
    }
  } catch {return Response.json({error:'Invalid authority or organization scope'},{status:400,headers:NO_STORE});}
  const {data,error}=await client.from('agent_api_keys').update(patch).eq('id',body.id).is('revoked_at',null).select('id,can_spend,paused_at,allowed_actions,organization_ids').maybeSingle();
  if(error || !data) return Response.json({error:'Active key not found for this account'},{status:404,headers:NO_STORE});
  return Response.json({ok:true,...data},{headers:NO_STORE});
}
