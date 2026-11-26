import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { updatePassword } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { AuthLayout, FormNotice } from "./SignInPage";

export const MIN_PASSWORD_LENGTH = 8;

type Stage = "checking" | "ready" | "failed" | "done";

/**
 * What the reset email linked to. Supabase returns either a PKCE `code` (the
 * default template), a `token_hash` (a template that links straight to this
 * page), or error parameters when the link was expired or already used.
 */
export function readRecoveryLink(search: string, hash: string) {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const failed = ["error", "error_code", "error_description"].some((key) => query.has(key) || fragment.has(key));
  const tokenHash = query.get("type") === "recovery" ? query.get("token_hash") : null;
  return { failed, hasCode: query.has("code"), tokenHash: tokenHash || null };
}

/** A token hash works once; React's development double effect must not spend it twice. */
const verifications = new Map<string, Promise<{ error: Error | null }>>();
function verifyRecovery(tokenHash: string) {
  if (!supabase) return Promise.resolve({ error: new Error("Unavailable") });
  let pending = verifications.get(tokenHash);
  if (!pending) {
    pending = supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" }).then(({ error }) => ({ error }));
    verifications.set(tokenHash, pending);
  }
  return pending;
}

export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password !== confirm) return "The two passwords don’t match.";
  return null;
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [link] = useState(() => (typeof window === "undefined" ? { failed: true, hasCode: false, tokenHash: null } : readRecoveryLink(window.location.search, window.location.hash)));
  const [stage, setStage] = useState<Stage>("checking");
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [othersSignedOut, setOthersSignedOut] = useState(false);

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        if (!supabase || link.failed) throw new Error("Link unavailable");
        if (link.tokenHash) {
          const { error: verifyError } = await verifyRecovery(link.tokenHash);
          if (verifyError) throw verifyError;
        } else {
          // initialize() is shared by the SDK; it exchanges the code once.
          const { error: initError } = await supabase.auth.initialize();
          if (initError) throw initError;
          // The SDK removes a code it exchanged. One still here was not: the link
          // was opened in a different browser from the one that asked for it.
          if (link.hasCode && new URLSearchParams(window.location.search).has("code")) throw new Error("Different browser");
        }
        const { data } = await supabase.auth.getSession();
        if (!data.session) throw new Error("No session");
        if (active) {
          setEmail(data.session.user.email ?? null);
          setStage("ready");
        }
      } catch {
        if (active) setStage("failed");
      } finally {
        // Keep one-use tokens and provider error text out of history.
        if (active && window.location.pathname === "/reset-password") window.history.replaceState(window.history.state, "", "/reset-password");
      }
    }
    void check();
    return () => {
      active = false;
    };
  }, [link]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = passwordProblem(password, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await updatePassword(password);
      // Whoever might have had the old password is signed out everywhere else.
      const signedOut = await supabase?.auth.signOut({ scope: "others" }).catch(() => null);
      setOthersSignedOut(Boolean(signedOut && !signedOut.error));
      setStage("done");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update your password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Reset password"
      title={stage === "done" ? "Password updated." : stage === "failed" ? "This link didn’t work." : "Choose a new password."}
      description={stage === "failed" ? "Reset links work once, expire, and only open in the browser that asked for them." : "Pick a password you don’t use anywhere else."}
    >
      <GlassCard className="p-6 sm:p-8">
        {stage === "checking" ? (
          <p role="status" className="flex items-center gap-3 font-ae-label text-xs font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
            <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-ae-primary/25 border-t-ae-primary" />Checking your link
          </p>
        ) : stage === "failed" ? (
          <div className="space-y-5">
            <p role="alert" className="text-sm leading-6 text-ae-text-muted">The link has expired, was already used, or was opened on a different device or browser. Ask for a new one and open it here.</p>
            <PrimaryButton className="w-full" onClick={() => navigate("/forgot-password")}>Send a new link</PrimaryButton>
          </div>
        ) : stage === "done" ? (
          <div className="space-y-5" role="status">
            <p className="text-sm leading-6 text-ae-text-muted">You’re signed in with your new password.{othersSignedOut ? " Your other devices were signed out." : ""}</p>
            <PrimaryButton className="w-full" onClick={() => navigate("/account", { replace: true })}>Continue to your account</PrimaryButton>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            {email ? <p className="text-sm leading-6 text-ae-text-muted">For <span className="break-all font-semibold text-ae-text">{email}</span></p> : null}
            {error ? <FormNotice tone="error">{error}</FormNotice> : null}
            <label className="block space-y-2">
              <span className="ax-label">New password</span>
              <input autoComplete="new-password" className="ax-input" minLength={MIN_PASSWORD_LENGTH} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
            </label>
            <label className="block space-y-2">
              <span className="ax-label">Confirm new password</span>
              <input autoComplete="new-password" className="ax-input" minLength={MIN_PASSWORD_LENGTH} onChange={(event) => setConfirm(event.target.value)} required type="password" value={confirm} />
            </label>
            <p className="text-xs leading-5 text-ae-text-muted">At least {MIN_PASSWORD_LENGTH} characters.</p>
            <PrimaryButton className="w-full" disabled={submitting} type="submit">
              {submitting ? "Saving…" : "Save new password"}
            </PrimaryButton>
          </form>
        )}
      </GlassCard>
      <p className="text-center text-sm text-ae-text-muted">
        <Link className="font-semibold text-ae-text underline decoration-ae-primary/50 underline-offset-4 transition hover:text-ae-primary" to="/sign-in">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
