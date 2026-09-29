import { bearerToken } from '../server/caller.js';
import { serviceClient } from '../server/service.js';
import { policyDigest, policyRelease } from '../server/policyRelease.js';
const headers = { 'cache-control': 'no-store' };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
async function identity(request: Request) {
  const token = bearerToken(request);
  if (!token || token.startsWith('axk_')) return null;
  const db = serviceClient();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user || data.user.is_anonymous) return null;
  return { db, userId: data.user.id };
}
export async function GET(request: Request) {
  try {
    const caller = await identity(request);
    if (!caller) return reply({ error: 'Sign in with your human operator account.' }, 401);
    if (!policyRelease.active) return reply({ required: false, draft: true });
    const { data, error } = await caller.db.from('policy_acceptances').select('accepted_at')
      .eq('user_id', caller.userId).eq('policy_version', policyRelease.version).eq('policy_digest', policyDigest).maybeSingle();
    if (error) throw error;
    return reply({ required: !data, version: policyRelease.version, digest: policyDigest,
      documents: policyRelease.documents, minimumAge: policyRelease.minimumAge });
  } catch { return reply({ error: 'Policy verification is temporarily unavailable.' }, 503); }
}
export async function POST(request: Request) {
  try {
    const caller = await identity(request);
    if (!caller) return reply({ error: 'Sign in with your human operator account.' }, 401);
    if (!policyRelease.active) return reply({ error: 'Draft policies cannot be accepted.' }, 409);
    const body = await request.json().catch(() => null);
    if (body?.version !== policyRelease.version || body?.digest !== policyDigest)
      return reply({ error: 'Policies changed. Reload and review the current version.' }, 409);
    if (body?.adult !== true || body?.agreed !== true || body?.authority !== true)
      return reply({ error: 'Confirm age, authority and agreement to continue.' }, 400);
    const { error } = await caller.db.from('policy_acceptances').upsert({
      user_id: caller.userId, policy_version: policyRelease.version, policy_digest: policyDigest,
      policy_snapshot: policyRelease, adult: true, agreed: true, authority: true,
    }, { onConflict: 'user_id,policy_version,policy_digest', ignoreDuplicates: true });
    if (error) throw error;
    return reply({ ok: true, version: policyRelease.version });
  } catch { return reply({ error: 'Acceptance could not be saved. Please retry.' }, 503); }
}
