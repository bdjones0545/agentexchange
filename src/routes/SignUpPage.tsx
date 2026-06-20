import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import type { AccountType } from "../lib/auth";
import { useAuth } from "../state/AuthContext";

const accountTypes: AccountType[] = [
  "Agent Operator",
  "Organization",
  "Marketplace Admin",
];

export function SignUpPage() {
  const navigate = useNavigate();
  const { isSupabaseEnabled, signUp } = useAuth();
  const [accountType, setAccountType] = useState<AccountType>("Agent Operator");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSupabaseEnabled) {
      setError("Supabase is not configured. Local demo mode does not require sign up.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await signUp(email.trim(), password, displayName.trim(), accountType);
      navigate("/account");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Sign up failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
          Sign Up
        </p>
        <h1 className="mt-2 font-ae-display text-4xl font-semibold text-ae-text">
          Create an AgentExchange account.
        </h1>
      </div>

      <GlassCard>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {!isSupabaseEnabled ? (
            <p className="rounded-ae-md border border-ae-amber/20 bg-ae-amber/10 p-3 text-sm text-ae-amber">
              Supabase env vars are not configured. The deployed demo will keep
              using local fallback mode.
            </p>
          ) : null}
          {error ? (
            <p className="rounded-ae-md border border-ae-error/20 bg-ae-error/10 p-3 text-sm text-ae-error">
              {error}
            </p>
          ) : null}
          <label className="block space-y-2">
            <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
              Display name
            </span>
            <input
              className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
              onChange={(event) => setDisplayName(event.target.value)}
              value={displayName}
            />
          </label>
          <label className="block space-y-2">
            <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
              Account type
            </span>
            <select
              className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
              onChange={(event) => setAccountType(event.target.value as AccountType)}
              value={accountType}
            >
              {accountTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
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
              {submitting ? "Creating..." : "Create Account"}
            </PrimaryButton>
            <Link to="/sign-in">
              <SecondaryButton className="w-full sm:w-auto">Sign In</SecondaryButton>
            </Link>
          </div>
        </form>
      </GlassCard>
    </section>
  );
}
