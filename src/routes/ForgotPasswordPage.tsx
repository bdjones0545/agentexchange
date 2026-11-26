import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";

import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { requestPasswordReset } from "../lib/auth";
import { useAuth } from "../state/AuthContext";
import { AuthLayout, FormNotice } from "./SignInPage";

const linkClass = "font-semibold text-ae-text underline decoration-ae-primary/50 underline-offset-4 transition hover:text-ae-primary";

export function ForgotPasswordPage() {
  const location = useLocation();
  const { isSupabaseEnabled, user } = useAuth();
  // The sign-in form passes what was typed in router state, never in the URL.
  const typed: unknown = (location.state as { email?: unknown } | null)?.email;
  const [email, setEmail] = useState(typeof typed === "string" && typed ? typed : user?.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    if (!isSupabaseEnabled) {
      setError("Supabase is not configured. Local demo mode has no passwords to reset.");
      return;
    }
    if (!address.includes("@")) {
      setError("Enter the email you use to sign in.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(address, `${window.location.origin}/reset-password`);
      setSentTo(address);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the reset link. Try again in a minute.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Reset password"
      title="Forgot your password?"
      description="Enter the email you sign in with and we’ll send you a link to choose a new password."
    >
      <GlassCard className="p-6 sm:p-8">
        {sentTo ? (
          <div className="space-y-4" role="status">
            <h2 className="font-ae-display text-xl font-semibold tracking-tight">Check your email</h2>
            <p className="text-sm leading-6 text-ae-text-muted">
              If an AgentExchange account uses <span className="break-all font-semibold text-ae-text">{sentTo}</span>, a link to reset its password is on its way.
            </p>
            <p className="text-sm leading-6 text-ae-text-muted">Open the link in this browser. It works once and expires, so if it stops working, ask for a new one here. Not there after a few minutes? Check spam.</p>
            <button className={`${linkClass} text-sm`} onClick={() => setSentTo(null)} type="button">Use a different email</button>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            {!isSupabaseEnabled ? <FormNotice tone="warning">Supabase env vars are not configured. The app is running in Local Demo Mode.</FormNotice> : null}
            {error ? <FormNotice tone="error">{error}</FormNotice> : null}
            <label className="block space-y-2">
              <span className="ax-label">Email</span>
              <input autoComplete="email" className="ax-input" onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required type="email" value={email} />
            </label>
            <PrimaryButton className="w-full" disabled={submitting} type="submit">
              {submitting ? "Sending…" : "Send reset link"}
            </PrimaryButton>
            <p className="text-xs leading-5 text-ae-text-muted">Signed up with Google? You can keep using “Continue with Google”, or set a password with this link.</p>
          </form>
        )}
      </GlassCard>
      <p className="text-center text-sm text-ae-text-muted">
        Remembered it? <Link className={linkClass} to="/sign-in">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
