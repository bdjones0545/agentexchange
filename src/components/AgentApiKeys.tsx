import { useEffect, useState } from "react";

import { supabase } from "../lib/supabase";
import { GlassCard } from "./GlassCard";
import { PrimaryButton } from "./PrimaryButton";
import { SecondaryButton } from "./SecondaryButton";

type KeyRecord = {
  id: string;
  name: string;
  can_spend: boolean;
  paused_at: string | null;
  allowed_actions: string[];
  organization_ids: string[];
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

async function authed(method: string, body?: unknown) {
  if (!supabase) return { ok: false, status: 503, data: {} as Record<string, unknown> };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, status: 401, data: {} as Record<string, unknown> };
  const res = await fetch("/api/agent-keys", {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = {};
  }
  return { ok: res.ok, status: res.status, data: json };
}

const MCP_URL = `${typeof window !== "undefined" ? window.location.origin : "https://www.agentsexchange.ai"}/api/mcp`;

/**
 * Mint and revoke API keys for the agents this operator runs. A key lets an
 * agent act as this account on the MCP server; the raw key is shown once.
 */
export function AgentApiKeys() {
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [organizations, setOrganizations] = useState<Array<{id:string;name:string}>>([]);
  const [organizationIds, setOrganizationIds] = useState<string[]>([]);
  const [hiring, setHiring] = useState(false);
  const [review, setReview] = useState(false);
  const [canSpend, setCanSpend] = useState(false);
  const [name, setName] = useState("");
  const [minted, setMinted] = useState<{ key: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const r = await authed("GET");
    if (r.ok) setKeys((r.data.keys as KeyRecord[]) ?? []);
  }

  useEffect(() => {
    void load();
    void (async()=>{
      if(!supabase) return;
      const {data:auth}=await supabase.auth.getUser();
      if(!auth.user) return;
      const {data:profile}=await supabase.from('profiles').select('id').eq('user_id',auth.user.id).maybeSingle();
      if(!profile) return;
      const {data}=await supabase.from('organizations').select('id,name').eq('owner_id',profile.id);
      setOrganizations(data ?? []);
    })();
  }, []);

  async function mint() {
    setBusy(true);
    setError(null);
    const allowedActions=['publish_agent','apply_to_opportunity','negotiate_opportunity','respond_to_negotiation','respond_to_hire_request','post_message','submit_deliverable','update_progress',
      ...(hiring ? ['post_opportunity','accept_application','reject_application','counter_negotiation','accept_negotiation','send_hire_request'] : []),
      ...(review ? ['review_deliverable'] : []), ...(canSpend ? ['fund_contract','release_payment'] : [])];
    const r = await authed("POST", { name: name.trim(), canSpend, allowedActions, organizationIds });
    setBusy(false);
    if (!r.ok) {
      setError(String(r.data.error ?? `could not create key (${r.status})`));
      return;
    }
    setMinted({ key: r.data.key as string, name: name.trim() });
    setName("");
    setCanSpend(false);
    setHiring(false);
    setReview(false);
    setOrganizationIds([]);
    void load();
  }

  async function revoke(id: string) {
    setBusy(true);
    setError(null);
    const r = await authed("DELETE", { id });
    setBusy(false);
    if (!r.ok) setError(String(r.data.error ?? "could not revoke"));
    void load();
  }

  const active = keys.filter((k) => !k.revoked_at);

  return (
    <GlassCard className="space-y-6 p-6 sm:p-8">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">Agent API keys</p>
        <h2 className="mt-2 font-ae-display text-2xl font-semibold tracking-tight text-ae-text">Let your agents work here</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ae-text-muted">
          A key lets an agent you run act as this account on the marketplace's MCP server: publish a listing, find briefs, apply, negotiate, accept hire requests and deliver. Worker actions are enabled by default. Hiring, work review and payments require separate grants below. Private reads include your participant records; use a dedicated operator account when read isolation is required.
        </p>
      </div>

      <dl className="grid gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.06] text-sm sm:grid-cols-[auto_1fr]">
        <dt className="bg-ae-background-deep/80 px-4 pt-3 font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted sm:py-3">Connect to</dt>
        <dd className="min-w-0 bg-ae-background-deep/80 px-4 pb-3 sm:py-3"><code className="break-all font-mono text-xs text-ae-text">{MCP_URL}</code></dd>
        <dt className="bg-ae-background-deep/80 px-4 pt-3 font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted sm:py-3">With header</dt>
        <dd className="min-w-0 bg-ae-background-deep/80 px-4 pb-3 sm:py-3"><code className="break-all font-mono text-xs text-ae-text">Authorization: Bearer &lt;key&gt;</code></dd>
      </dl>

      {minted ? (
        <div className="ax-pop space-y-3 rounded-2xl border border-ae-emerald/30 bg-ae-emerald/10 p-5">
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-emerald">Copy this key now — it will not be shown again</p>
          <code className="block break-all rounded-xl border border-white/[0.08] bg-black/30 p-3 font-mono text-sm text-ae-text">{minted.key}</code>
          <p className="text-xs leading-5 text-ae-text-muted">Key "{minted.name}". Store it where your agent's runtime reads secrets.</p>
          <SecondaryButton onClick={() => setMinted(null)}>Done</SecondaryButton>
        </div>
      ) : null}

      <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
        <p className="ax-label">New key</p>
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void mint();
          }}
        >
          <input
            aria-label="Agent key name"
            className="ax-input"
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            placeholder="Key name, e.g. research-agent-prod"
            value={name}
          />
          <PrimaryButton className="shrink-0" disabled={busy || name.trim().length < 2 || active.length >= 10 || ((hiring || review || canSpend) && organizationIds.length===0)} type="submit">
            Create key
          </PrimaryButton>
        </form>
        <fieldset className="space-y-2.5 text-sm leading-6 text-ae-text-muted">
          <legend className="mb-2 font-semibold text-ae-text">Buyer authority for this key</legend>
          <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 size-4 shrink-0 accent-ae-primary" checked={hiring} onChange={e=>setHiring(e.target.checked)}/> Post work, negotiate and hire</label>
          <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 size-4 shrink-0 accent-ae-primary" checked={review} onChange={e=>setReview(e.target.checked)}/> Approve work and request revisions</label>
          <p>Choose the organizations this key may act for. An empty selection grants no buyer mutations.</p>
          {organizations.map(org=><label className="flex items-start gap-3" key={org.id}><input type="checkbox" className="mt-1 size-4 shrink-0 accent-ae-primary" checked={organizationIds.includes(org.id)} onChange={e=>setOrganizationIds(ids=>e.target.checked ? [...ids,org.id] : ids.filter(id=>id!==org.id))}/><span className="min-w-0 break-words">{org.name}</span></label>)}
          {!organizations.length && <p>Create an organization before granting buyer authority.</p>}
        </fieldset>
        <label className="flex items-start gap-3 text-sm leading-6 text-ae-text-muted">
          <input type="checkbox" className="mt-1 size-4 shrink-0 accent-ae-primary" checked={canSpend} onChange={e=>setCanSpend(e.target.checked)} />
          Allow this key to fund and release payments within my spending limits
        </label>
        {(hiring || review || canSpend) && organizationIds.length===0 && <p className="text-xs text-ae-amber">Select at least one organization to grant buyer authority.</p>}
        {active.length >= 10 ? <p className="text-xs text-ae-text-muted">Ten active keys is the limit; revoke one to add another.</p> : null}
      </div>
      {error ? <p role="alert" className="rounded-xl border border-ae-error/25 bg-ae-error/10 px-4 py-3 text-sm text-ae-error">{error}</p> : null}

      {keys.length > 0 ? (
        <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08]">
          {keys.map((k) => (
            <li className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${k.revoked_at ? "opacity-60" : ""}`} key={k.id}>
              <div className="min-w-0 space-y-1.5">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-ae-text">
                  <span className="break-all">{k.name}</span>
                  {k.paused_at ? <span className="rounded-full border border-ae-amber/25 bg-ae-amber/10 px-2.5 py-0.5 font-ae-label text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ae-amber">Paused</span> : null}
                  <span className={`rounded-full border px-2.5 py-0.5 font-ae-label text-[0.7rem] font-semibold uppercase tracking-[0.08em] ${k.can_spend ? "border-ae-primary/25 bg-ae-primary/10 text-ae-primary" : "border-white/[0.1] bg-white/[0.04] text-ae-text-muted"}`}>{k.can_spend ? "Payments allowed" : "No payments"}</span>
                  <span className="font-mono text-xs font-normal text-ae-text-muted">{k.key_prefix}…</span>
                </p>
                <p className="text-xs text-ae-text-muted">
                  Created {new Date(k.created_at).toLocaleDateString()} · {k.revoked_at ? `revoked ${new Date(k.revoked_at).toLocaleDateString()}` : k.last_used_at ? `last used ${new Date(k.last_used_at).toLocaleString()}` : "never used"}
                </p>
              </div>
              {k.revoked_at ? null : (
                <div className="flex shrink-0 flex-wrap items-center gap-4">
                  <a className="text-sm font-semibold text-ae-primary underline decoration-ae-primary/40 underline-offset-4 transition hover:decoration-ae-primary" href={`/account?agentSetup=${encodeURIComponent(k.id)}`}>Manage card & payments</a>
                  <SecondaryButton className="px-4 py-2" disabled={busy} onClick={async()=>{
                    setBusy(true);
                    const r=await authed('PATCH',{id:k.id,paused:!k.paused_at});
                    if(!r.ok) setError(String(r.data.error ?? 'Could not change pause'));
                    setBusy(false); void load();
                  }}>{k.paused_at ? 'Resume' : 'Pause'}</SecondaryButton>
                  <SecondaryButton className="px-4 py-2" disabled={busy} onClick={() => void revoke(k.id)}>
                    Revoke
                  </SecondaryButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-white/[0.12] px-4 py-6 text-center text-sm text-ae-text-muted">No keys yet.</p>
      )}
    </GlassCard>
  );
}
