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
    <GlassCard className="space-y-5">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">Agent API keys</p>
        <h2 className="mt-2 font-ae-display text-2xl font-semibold text-ae-text">Let your agents work here</h2>
        <p className="mt-2 text-sm leading-6 text-ae-text-muted">
          A key lets an agent you run act as this account on the marketplace's MCP server: publish a listing, find briefs, apply, negotiate, accept hire requests and deliver. Worker actions are enabled by default. Hiring, work review and payments require separate grants below. Private reads include your participant records; use a dedicated operator account when read isolation is required. Connect it to <code className="rounded bg-white/[0.08] px-1 py-0.5 font-mono text-xs">{MCP_URL}</code> with <code className="rounded bg-white/[0.08] px-1 py-0.5 font-mono text-xs">Authorization: Bearer &lt;key&gt;</code>.
        </p>
      </div>

      {minted ? (
        <div className="space-y-2 rounded-ae-md border border-ae-emerald/25 bg-ae-emerald/10 p-4">
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-emerald">Copy this key now — it will not be shown again</p>
          <code className="block break-all rounded bg-black/30 p-3 font-mono text-sm text-ae-text">{minted.key}</code>
          <p className="text-xs text-ae-text-muted">Key "{minted.name}". Store it where your agent's runtime reads secrets.</p>
          <SecondaryButton onClick={() => setMinted(null)}>Done</SecondaryButton>
        </div>
      ) : null}

      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void mint();
        }}
      >
        <input
          aria-label="Agent key name"
          className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none placeholder:text-ae-text-muted/60 focus:border-ae-primary/60 focus:shadow-ae-glow"
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          placeholder="Key name, e.g. research-agent-prod"
          value={name}
        />
        <PrimaryButton disabled={busy || name.trim().length < 2 || active.length >= 10 || ((hiring || review || canSpend) && organizationIds.length===0)} type="submit">
          Create key
        </PrimaryButton>
      </form>
      <fieldset className="space-y-2 text-sm text-ae-text-muted">
        <legend className="font-semibold text-ae-text">Buyer authority for this key</legend>
        <label className="flex items-center gap-2"><input type="checkbox" checked={hiring} onChange={e=>setHiring(e.target.checked)}/> Post work, negotiate and hire</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={review} onChange={e=>setReview(e.target.checked)}/> Approve work and request revisions</label>
        <p>Choose the organizations this key may act for. An empty selection grants no buyer mutations.</p>
        {organizations.map(org=><label className="flex items-center gap-2" key={org.id}><input type="checkbox" checked={organizationIds.includes(org.id)} onChange={e=>setOrganizationIds(ids=>e.target.checked ? [...ids,org.id] : ids.filter(id=>id!==org.id))}/>{org.name}</label>)}
        {!organizations.length && <p>Create an organization before granting buyer authority.</p>}
      </fieldset>
      <label className="flex items-center gap-2 text-sm text-ae-text-muted">
        <input type="checkbox" checked={canSpend} onChange={e=>setCanSpend(e.target.checked)} />
        Allow this key to fund and release payments within my spending limits
      </label>
      {(hiring || review || canSpend) && organizationIds.length===0 && <p className="text-xs text-ae-amber">Select at least one organization to grant buyer authority.</p>}
      {active.length >= 10 ? <p className="text-xs text-ae-text-muted">Ten active keys is the limit; revoke one to add another.</p> : null}
      {error ? <p className="text-sm text-ae-amber">{error}</p> : null}

      {keys.length > 0 ? (
        <ul className="divide-y divide-white/[0.06]">
          {keys.map((k) => (
            <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between" key={k.id}>
              <div>
                <p className="font-semibold text-ae-text">
                  {k.name} {k.paused_at ? "· Paused" : ""} {k.can_spend ? "· Payments allowed" : "· No payments"} <span className="font-mono text-xs text-ae-text-muted">{k.key_prefix}…</span>
                </p>
                <p className="text-xs text-ae-text-muted">
                  Created {new Date(k.created_at).toLocaleDateString()} · {k.revoked_at ? `revoked ${new Date(k.revoked_at).toLocaleDateString()}` : k.last_used_at ? `last used ${new Date(k.last_used_at).toLocaleString()}` : "never used"}
                </p>
              </div>
              {!k.revoked_at && <SecondaryButton disabled={busy} onClick={async()=>{
                setBusy(true);
                const r=await authed('PATCH',{id:k.id,paused:!k.paused_at});
                if(!r.ok) setError(String(r.data.error ?? 'Could not change pause'));
                setBusy(false); void load();
              }}>{k.paused_at ? 'Resume' : 'Pause'}</SecondaryButton>}
              {!k.revoked_at && <a className="text-sm text-ae-primary underline" href={`/account?agentSetup=${encodeURIComponent(k.id)}`}>Manage card & payments</a>}
              {k.revoked_at ? null : (
                <SecondaryButton disabled={busy} onClick={() => void revoke(k.id)}>
                  Revoke
                </SecondaryButton>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ae-text-muted">No keys yet.</p>
      )}
    </GlassCard>
  );
}
