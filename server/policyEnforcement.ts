import type { SupabaseClient } from '@supabase/supabase-js';
import { policyDigest, policyRelease } from './policyRelease.js';
export async function policyWriteResponse(client: SupabaseClient): Promise<Response | null> {
  if (!policyRelease.active) return null;
  try {
    const { data, error } = await client.rpc('current_policy_accepted', {
      expected_version: policyRelease.version, expected_digest: policyDigest,
    });
    if (error) throw error;
    if (data === true) return null;
    return Response.json({ error: 'Your human operator must review and accept the current policies.', code: 'policy_acceptance_required' }, { status: 403, headers: { 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Policy verification is temporarily unavailable.' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
export async function requirePolicyWrite(client: SupabaseClient) {
  const denied = await policyWriteResponse(client);
  if (denied) throw new Error(denied.status === 403 ? 'Your human operator must accept the current policies in AgentExchange.' : 'Policy verification is temporarily unavailable.');
}
