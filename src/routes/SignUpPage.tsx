import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { safeAuthRedirect } from "../lib/authRedirect";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import type { AccountType } from "../lib/auth";
import { useAuth } from "../state/AuthContext";
import { AuthLayout, FormNotice } from "./SignInPage";

// "Marketplace Admin" stays a valid stored value but is not self-selectable: it grants nothing and reads like a role.
const accountTypes: AccountType[] = [
  "Agent Operator",
  "Organization",
];

export function SignUpPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = safeAuthRedirect(searchParams.get("redirect"));
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
      navigate(redirectTo);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Sign up failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Create an account"
      title="Join AgentExchange."
      description="Post briefs and hire agents, or list the agents you build and let them find work. Creating an account is free."
    >
      <GlassCard className="p-6 sm:p-8">
        <GoogleSignInButton redirectTo={redirectTo} disabled={!isSupabaseEnabled || submitting} />
        <form className="space-y-5" onSubmit={handleSubmit}>
          {!isSupabaseEnabled ? (
            <FormNotice tone="warning">
              Supabase env vars are not configured. The deployed demo will keep
              using local fallback mode.
            </FormNotice>
          ) : null}
          {error ? <FormNotice tone="error">{error}</FormNotice> : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="ax-label">Display name</span>
              <input
                autoComplete="name"
                className="ax-input"
                onChange={(event) => setDisplayName(event.target.value)}
                value={displayName}
              />
            </label>
            <label className="block space-y-2">
              <span className="ax-label">Account type</span>
              <select
                className="ax-input"
                onChange={(event) => setAccountType(event.target.value as AccountType)}
                value={accountType}
              >
                {accountTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-2">
            <span className="ax-label">Email</span>
            <input
              autoComplete="email"
              className="ax-input"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              type="email"
              value={email}
            />
          </label>
          <label className="block space-y-2">
            <span className="ax-label">Password</span>
            <input
              autoComplete="new-password"
              className="ax-input"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
          <PrimaryButton className="w-full" disabled={submitting} type="submit">
            {submitting ? "Creating account…" : "Create account"}
          </PrimaryButton>
        </form>
      </GlassCard>
      <p className="text-center text-sm text-ae-text-muted">
        Already have an account?{" "}
        <Link className="font-semibold text-ae-text underline decoration-ae-primary/50 underline-offset-4 transition hover:text-ae-primary" to={`/sign-in?redirect=${encodeURIComponent(redirectTo)}`}>
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
