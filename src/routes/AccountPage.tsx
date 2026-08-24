import { useNavigate } from "react-router-dom";

import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { useAuth } from "../state/AuthContext";

export function AccountPage() {
  const navigate = useNavigate();
  const { error, isAuthenticated, isSupabaseEnabled, signOut, user } = useAuth();
  const accountType = user?.user_metadata?.account_type ?? "Demo User";
  const displayName = user?.user_metadata?.display_name ?? "Local Demo";
  const persistenceMode = error
    ? "Supabase Error"
    : !isSupabaseEnabled
      ? "Local Demo Mode"
      : isAuthenticated
        ? "Supabase Authenticated"
        : "Supabase Connected";

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
          Account
        </p>
        <h1 className="mt-2 font-ae-display text-4xl font-semibold text-ae-text">
          {isAuthenticated ? displayName : "Local demo mode"}
        </h1>
      </div>

      <GlassCard className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-ae-primary/20 bg-ae-primary/10 px-3 py-1 font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-primary">
            {persistenceMode}
          </span>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-text-muted">
            {accountType}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-4">
            <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
              Supabase configured
            </p>
            <p className="mt-2 text-ae-text">{isSupabaseEnabled ? "Yes" : "No"}</p>
          </div>
          <div className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-4">
            <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
              Auth status
            </p>
            <p className="mt-2 text-ae-text">
              {isAuthenticated ? "Signed in" : "Not signed in"}
            </p>
          </div>
          <div className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-4">
            <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
              Email
            </p>
            <p className="mt-2 text-ae-text">{user?.email ?? "Not signed in"}</p>
          </div>
          <div className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-4">
            <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
              User ID
            </p>
            <p className="mt-2 break-all text-sm text-ae-text-muted">
              {user?.id ?? "Local fallback session"}
            </p>
          </div>
          <div className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-4">
            <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
              Profile status
            </p>
            <p className="mt-2 text-ae-text">
              {user ? "Profile expected from sign-up" : "No Supabase profile"}
            </p>
          </div>
        </div>
        {error ? (
          <p className="rounded-ae-md border border-ae-error/20 bg-ae-error/10 p-3 text-sm text-ae-error">
            {error}
          </p>
        ) : null}
        {isAuthenticated ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <PrimaryButton onClick={() => void signOut()}>Sign Out</PrimaryButton>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row">
            <PrimaryButton onClick={() => navigate("/sign-in")}>Sign In</PrimaryButton>
            <SecondaryButton onClick={() => navigate("/sign-up")}>
              Create Account
            </SecondaryButton>
          </div>
        )}
      </GlassCard>
    </section>
  );
}
