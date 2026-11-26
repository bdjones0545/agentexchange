import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";

import { supportEmail } from "../content/publicRoutes";
import { deleteAccount, downloadAccountData, endLocalSession, loadDeletionRequest, type DeletionRequest } from "../lib/accountApi";
import { hasPasswordSignIn, requestEmailChange, syncProfileEmail } from "../lib/auth";
import { useAuth } from "../state/AuthContext";
import { GlassCard } from "./GlassCard";
import { PrimaryButton } from "./PrimaryButton";
import { SecondaryButton } from "./SecondaryButton";

const linkClass = "font-semibold text-ae-text underline decoration-ae-primary/50 underline-offset-4 transition hover:text-ae-primary";

function Notice({ children, tone }: { children: ReactNode; tone: "error" | "warning" | "success" }) {
  const styles = { error: "border-ae-error/25 bg-ae-error/10 text-ae-error", warning: "border-ae-amber/25 bg-ae-amber/10 text-ae-amber", success: "border-ae-primary/25 bg-ae-primary/10 text-ae-primary" };
  return <p role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm leading-6 ${styles[tone]}`}>{children}</p>;
}

function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="space-y-1.5">
    <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">{eyebrow}</p>
    <h2 className="font-ae-display text-xl font-semibold tracking-tight">{title}</h2>
    {children ? <p className="max-w-2xl text-sm leading-6 text-ae-text-muted">{children}</p> : null}
  </div>;
}

/**
 * What an email-change confirmation link brought back, read once and then
 * removed from the address bar. Provider text is never shown as-is.
 */
export function readEmailChangeReturn(search: string, hash: string): "confirmed" | "failed" | null {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const has = (key: string) => query.has(key) || fragment.has(key);
  if (has("error") || has("error_code") || has("error_description")) return "failed";
  if (has("message")) return "confirmed";
  return null;
}

export function emailChangeProblem(next: string, current: string | null | undefined): string | null {
  const value = next.trim().toLowerCase();
  if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email address.";
  if (current && value === current.trim().toLowerCase()) return "That’s already your sign-in email.";
  return null;
}

/** Sign-in email and password. */
export function SignInSettings() {
  const { user } = useAuth();
  const [returned] = useState(() => (typeof window === "undefined" ? null : readEmailChangeReturn(window.location.search, window.location.hash)));
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordAccount = hasPasswordSignIn(user);
  const pending = user?.new_email ?? null;

  useEffect(() => {
    if (!returned) return;
    const url = new URL(window.location.href);
    for (const key of ["message", "error", "error_code", "error_description"]) url.searchParams.delete(key);
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
    document.getElementById("sign-in")?.scrollIntoView();
  }, [returned]);

  useEffect(() => {
    if (user?.id && user.email && !user.new_email) void syncProfileEmail(user.id, user.email).catch(() => undefined);
  }, [user?.id, user?.email, user?.new_email]);

  async function send(address: string) {
    setBusy(true);
    setError(null);
    try {
      // No fragment: Supabase appends its own query or fragment to this URL.
      await requestEmailChange(address, `${window.location.origin}/account`);
      setSent(address);
      setNewEmail("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start the email change.");
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = emailChangeProblem(newEmail, user?.email);
    if (problem) {
      setError(problem);
      return;
    }
    void send(newEmail.trim());
  }

  return <GlassCard className="space-y-6 p-6 sm:p-8">
    <SectionTitle eyebrow="Sign-in" title="Email & password">You sign in as <span className="break-all font-semibold text-ae-text">{user?.email ?? "this account"}</span>.</SectionTitle>
    {returned === "confirmed" ? <Notice tone="success">Confirmation received. If we also emailed a link to your other address, open that one too to finish the change.</Notice> : null}
    {returned === "failed" ? <Notice tone="error">That confirmation link has expired or was already used. Send a new one below.</Notice> : null}
    {passwordAccount ? <>
      {pending ? <Notice tone="warning">Waiting for you to confirm <span className="break-all font-semibold">{pending}</span>. Open the link we emailed there (and to {user?.email} if one arrived). Until then you keep signing in with your current email.</Notice> : null}
      {sent && sent !== pending ? <Notice tone="success">Confirmation link sent to <span className="break-all font-semibold">{sent}</span>.</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="ax-label">New email</span>
          <input autoComplete="email" className="ax-input" onChange={(event) => setNewEmail(event.target.value)} placeholder="you@company.com" type="email" value={newEmail} />
        </label>
        <PrimaryButton disabled={busy} type="submit">{busy ? "Sending…" : "Change email"}</PrimaryButton>
      </form>
      {pending ? <button className={`${linkClass} text-sm`} disabled={busy} onClick={() => void send(pending)} type="button">Resend the confirmation to {pending}</button> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
        <p className="text-sm leading-6 text-ae-text-muted">Change your password with a link sent to your email.</p>
        <Link className={`${linkClass} text-sm`} state={{ email: user?.email ?? "" }} to="/forgot-password">Reset password</Link>
      </div>
    </> : <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm leading-6 text-ae-text-muted">
      You sign in with Google, so your email comes from your Google account. To use a different address, email <a className={linkClass} href={`mailto:${supportEmail}`}>{supportEmail}</a>. You can also <Link className={linkClass} state={{ email: user?.email ?? "" }} to="/forgot-password">set a password</Link> for this email.
    </p>}
  </GlassCard>;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

const requestLabel: Record<string, string> = { requested: "Deletion requested", processing: "Deletion in progress", completed: "Deletion completed" };

function RequestStatus({ request }: { request: DeletionRequest }) {
  return <div className="space-y-2 rounded-xl border border-ae-amber/25 bg-ae-amber/10 px-4 py-3 text-sm leading-6 text-ae-amber" role="status">
    <p className="font-semibold">{requestLabel[request.status] ?? "Deletion requested"}{request.requested_at ? ` on ${formatDate(request.requested_at)}` : ""}</p>
    <p>{request.response}</p>
  </div>;
}

/** Download my data, and delete my account. */
export function YourData({ user }: { user: User }) {
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [request, setRequest] = useState<DeletionRequest | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const confirmWord = user.email ?? "DELETE";
  const matches = typed.trim().toLowerCase() === confirmWord.toLowerCase();

  useEffect(() => {
    let active = true;
    void loadDeletionRequest(user.id).then((existing) => {
      if (active) setRequest(existing);
    });
    return () => {
      active = false;
    };
  }, [user.id]);

  async function download() {
    setDownloading(true);
    setDownloadError(null);
    setDownloaded(null);
    try {
      setDownloaded(await downloadAccountData());
    } catch (caught) {
      setDownloadError(caught instanceof Error ? caught.message : "Could not prepare your data.");
    } finally {
      setDownloading(false);
    }
  }

  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!matches) {
      setDeleteError(user.email ? "Type your account email exactly to confirm." : "Type DELETE to confirm.");
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await deleteAccount(typed.trim());
      if (result.status === "deleted") {
        await endLocalSession();
        navigate("/account", { replace: true, state: { accountDeleted: true } });
        return;
      }
      setRequest(result.request);
      setConfirming(false);
      setTyped("");
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "Account deletion failed. Nothing was deleted.");
    } finally {
      setDeleting(false);
    }
  }

  const open = request && request.status !== "completed";

  return <GlassCard className="space-y-8 p-6 sm:p-8">
    <div className="space-y-4">
      <SectionTitle eyebrow="Your data" title="Download your data">A JSON file with your account, profile, listings, briefs, applications, contracts and their messages, payment records and agent key settings. Secrets such as card numbers and keys are never included.</SectionTitle>
      {downloadError ? <Notice tone="error">{downloadError}</Notice> : null}
      {downloaded ? <Notice tone="success">Downloaded {downloaded}.</Notice> : null}
      <SecondaryButton disabled={downloading} onClick={() => void download()}>{downloading ? "Preparing your file…" : "Download my data"}</SecondaryButton>
    </div>
    <div className="space-y-4 border-t border-white/[0.08] pt-8">
      <SectionTitle eyebrow="Danger zone" title="Delete your account" />
      <ul className="max-w-2xl list-disc space-y-1.5 pl-5 text-sm leading-6 text-ae-text-muted">
        <li>Your sign-in, profile, saved briefs and agent API keys are deleted. Agents using your keys stop working.</li>
        <li>If your account has marketplace activity (listings, organizations, briefs, applications, contracts or payments), a saved card or agent webhooks, those records must be kept or settled first, so we review the request and finish within 30 days.</li>
        <li>This can’t be undone. Download your data first if you want a copy.</li>
      </ul>
      {request ? <RequestStatus request={request} /> : null}
      {open ? <p className="text-sm leading-6 text-ae-text-muted">Questions about your request? Email <a className={linkClass} href={`mailto:${supportEmail}`}>{supportEmail}</a>.</p> : confirming ? (
        <form className="space-y-4 rounded-xl border border-ae-error/25 bg-ae-error/[0.06] p-4 sm:p-5" onSubmit={remove}>
          {deleteError ? <Notice tone="error">{deleteError}</Notice> : null}
          <label className="block space-y-2">
            <span className="ax-label">Type <span className="normal-case tracking-normal text-ae-text">{confirmWord}</span> to confirm</span>
            <input autoCapitalize="none" autoComplete="off" autoCorrect="off" className="ax-input" onChange={(event) => setTyped(event.target.value)} spellCheck={false} value={typed} />
          </label>
          <div className="flex flex-wrap gap-3">
            <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-ae-error/40 bg-ae-error/15 px-5 py-3 font-ae-label text-sm font-semibold text-ae-error transition hover:bg-ae-error/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ae-error disabled:cursor-not-allowed disabled:opacity-50" disabled={deleting || !matches} type="submit">{deleting ? "Deleting…" : "Delete my account"}</button>
            <SecondaryButton disabled={deleting} onClick={() => { setConfirming(false); setTyped(""); setDeleteError(null); }}>Cancel</SecondaryButton>
          </div>
        </form>
      ) : (
        <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-ae-error/40 bg-transparent px-5 py-3 font-ae-label text-sm font-semibold text-ae-error transition hover:bg-ae-error/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ae-error" onClick={() => setConfirming(true)} type="button">Delete account…</button>
      )}
    </div>
  </GlassCard>;
}
