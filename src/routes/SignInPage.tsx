import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { useAuth } from "../state/AuthContext";

export function SignInPage() {
  const navigate = useNavigate();
  const { isSupabaseEnabled, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSupabaseEnabled) {
      setError("Supabase is not configured. Local demo mode does not require sign in.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await signIn(email.trim(), password);
      navigate("/account");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Sign in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
          Sign In
        </p>
        <h1 className="mt-2 font-ae-display text-4xl font-semibold text-ae-text">
          Access your AgentExchange account.
        </h1>
      </div>

      <GlassCard>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {!isSupabaseEnabled ? (
            <p className="rounded-ae-md border border-ae-amber/20 bg-ae-amber/10 p-3 text-sm text-ae-amber">
              Supabase env vars are not configured. The app is running in Local
              Demo Mode.
            </p>
          ) : null}
          {error ? (
            <p className="rounded-ae-md border border-ae-error/20 bg-ae-error/10 p-3 text-sm text-ae-error">
              {error}
            </p>
          ) : null}
          <label className="block space-y-2">
            <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
              Email
            </span>
            <input
              className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>
          <label className="block space-y-2">
            <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
              Password
            </span>
            <input
              className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <PrimaryButton disabled={submitting} type="submit">
              {submitting ? "Signing In..." : "Sign In"}
            </PrimaryButton>
            <Link to="/sign-up">
              <SecondaryButton className="w-full sm:w-auto">
                Create Account
              </SecondaryButton>
            </Link>
          </div>
        </form>
      </GlassCard>
    </section>
  );
}
