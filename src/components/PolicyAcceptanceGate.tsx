import { useEffect, useState, type PropsWithChildren } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

type Policy = { required: boolean; version?: string; digest?: string; documents?: Record<string, { title: string; sections: readonly (readonly string[])[] }> };
const publicPaths = new Set(['/terms', '/privacy', '/refunds', '/acceptable-use', '/contact', '/account', '/auth/callback', '/sign-in', '/sign-up']);
export function PolicyAcceptanceGate({ children }: PropsWithChildren) {
  const { session, signOut } = useAuth();
  const { pathname } = useLocation();
  const token = session?.access_token;
  const [state, setState] = useState<{ token: string; policy: Policy } | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [adult, setAdult] = useState(false);
  const [authority, setAuthority] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    setState(null); setError(''); setAdult(false); setAuthority(false); setAgreed(false);
    if (!token) return;
    void fetch('/api/policy-acceptance', { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<Policy>; })
      .then(policy => { if (typeof policy.required !== "boolean" || (policy.required && (!policy.version || !policy.digest || !policy.documents))) throw new Error(); if (active) setState({ token, policy }); })
      .catch(() => { if (active) setError('Unable to check your policy acceptance. Please retry.'); });
    return () => { active = false; };
  }, [token, retry]);
  if (!token || publicPaths.has(pathname) || pathname === "/contracts" || pathname.startsWith("/contracts/")) return children;
  const policy = state?.token === token ? state.policy : null;
  if (policy && !policy.required) return children;
  async function accept() {
    if (!policy || !adult || !authority || !agreed || saving) return;
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/policy-acceptance', { method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: policy.version, digest: policy.digest, adult, authority, agreed }) });
      if (!response.ok) throw new Error();
      setRetry(value => value + 1);
    } catch { setError('Acceptance was not confirmed. Retry or reload to review the latest policies.'); }
    finally { setSaving(false); }
  }
  return <section className="mx-auto max-w-3xl space-y-5">
    <h1 className="text-3xl font-semibold">Review your account requirements</h1>
    {error && <p role="alert">{error}</p>}
    {!policy ? <><p role="status">Checking your account…</p><button onClick={() => setRetry(value => value + 1)}>Retry</button></> : <>
      <p>Policy version: {policy.version}. Review these documents before continuing.</p>
      {Object.entries(policy.documents ?? {}).map(([slug, document]) => <details key={slug} className="rounded-xl border border-white/20 p-4">
        <summary>{document.title}</summary>{document.sections.map(([title, body]) => <section key={title} className="my-4"><h2 className="font-semibold">{title}</h2><p>{body}</p></section>)}
      </details>)}
      <label className="block"><input type="checkbox" checked={adult} onChange={event => setAdult(event.target.checked)} /> I am at least 18 years old and legally able to enter into these agreements.</label>
      <label className="block"><input type="checkbox" checked={authority} onChange={event => setAuthority(event.target.checked)} /> I have authority to act for any organization or agent I operate.</label>
      <label className="block"><input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)} /> I agree to the Terms, Refunds &amp; Disputes and Acceptable Use policies, and acknowledge the Privacy Policy.</label>
      <button className="rounded-xl bg-ae-primary px-5 py-3 text-ae-background disabled:opacity-50" disabled={!adult || !authority || !agreed || saving} onClick={() => void accept()}>{saving ? 'Saving…' : 'Accept and continue'}</button>
    </>}
    <button className="block underline" onClick={() => void signOut()}>Sign out</button>
  </section>;
}
