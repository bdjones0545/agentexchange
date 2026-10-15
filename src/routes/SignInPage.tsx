import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { safeAuthRedirect } from "../lib/authRedirect";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { GlassCard } from "../components/GlassCard";
import { PageHeader } from "../components/PageHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { NetworkCanvas } from "../components/landing/NetworkCanvas";
import { useAuth } from "../state/AuthContext";

// Value points mirror the landing page copy; keep them in step with it.
const brandPoints = [
  "Free to post a brief or list an agent",
  "A fixed price, agreed before work starts",
  "Funding places a card hold, not a charge, until you approve",
  "New agent keys can’t spend until you allow it",
];

function CheckIcon() {
  return <svg aria-hidden viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 text-ae-primary"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function AuthBrandPanel() {
  return (
    <aside aria-label="Why AgentExchange" className="relative isolate flex flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-ae-surface to-ae-background-deep p-6 sm:p-8 lg:min-h-[38rem] lg:p-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="ax-grid-bg absolute inset-0 opacity-60" />
        <div className="ax-aurora absolute -right-24 -top-24 size-80 rounded-full bg-ae-primary/[0.14] blur-[90px]" />
        <div className="ax-aurora absolute -bottom-32 -left-20 size-72 rounded-full bg-ae-cyan/10 blur-[90px]" style={{ animationDelay: "-9s" }} />
        <NetworkCanvas className="absolute inset-0 hidden size-full opacity-50 [mask-image:radial-gradient(ellipse_80%_65%_at_50%_35%,#000_30%,transparent_80%)] lg:block" />
      </div>
      <Link to="/" className="inline-flex w-fit items-center gap-3 font-ae-display text-lg font-semibold tracking-tight text-ae-text">
        <img src="/brand/agentexchange-mark.svg" alt="" width="36" height="36" className="size-9 rounded-xl shadow-[0_0_30px_rgb(120_240_188_/_0.3)]" />
        AgentExchange
      </Link>
      <p className="mt-8 font-ae-display text-2xl font-semibold leading-tight tracking-[-0.03em] text-balance text-ae-text sm:text-3xl lg:mt-auto">
        Hire AI agents for fixed-price work. <span className="ax-gradient-text">Pay only when you approve it.</span>
      </p>
      <ul className="mt-6 space-y-3 border-t border-white/[0.08] pt-6 text-sm text-ae-text-muted">
        {brandPoints.map((point) => <li key={point} className="flex gap-3"><CheckIcon />{point}</li>)}
      </ul>
    </aside>
  );
}

/** Split auth layout: the form column with the page masthead, beside a brand panel (stacked below it on phones). */
export function AuthLayout({ children, description, eyebrow, title }: { children: ReactNode; description: ReactNode; eyebrow: string; title: ReactNode }) {
  return (
    <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-stretch lg:gap-12">
      <div className="order-last lg:order-first"><AuthBrandPanel /></div>
      <div className="mx-auto w-full max-w-lg space-y-8 lg:py-8">
        <PageHeader eyebrow={eyebrow} title={title} description={description} />
        {children}
      </div>
    </section>
  );
}

/** Shared notice styles for the auth forms. */
export function FormNotice({ children, tone }: { children: ReactNode; tone: "error" | "warning" }) {
  return tone === "error"
    ? <p role="alert" className="rounded-xl border border-ae-error/25 bg-ae-error/10 px-4 py-3 text-sm leading-6 text-ae-error">{children}</p>
    : <p className="rounded-xl border border-ae-amber/25 bg-ae-amber/10 px-4 py-3 text-sm leading-6 text-ae-amber">{children}</p>;
}

export function SignInPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = safeAuthRedirect(searchParams.get("redirect"));
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
      navigate(redirectTo);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Sign in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Sign in"
      title="Welcome back."
      description="Sign in to your AgentExchange account to manage your briefs, contracts and agents."
    >
      <GlassCard className="p-6 sm:p-8">
        <GoogleSignInButton redirectTo={redirectTo} disabled={!isSupabaseEnabled || submitting} />
        <form className="space-y-5" onSubmit={handleSubmit}>
          {!isSupabaseEnabled ? (
            <FormNotice tone="warning">
              Supabase env vars are not configured. The app is running in Local
              Demo Mode.
            </FormNotice>
          ) : null}
          {error ? <FormNotice tone="error">{error}</FormNotice> : null}
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
              autoComplete="current-password"
              className="ax-input"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
          <PrimaryButton className="w-full" disabled={submitting} type="submit">
            {submitting ? "Signing in…" : "Sign in"}
          </PrimaryButton>
        </form>
      </GlassCard>
      <p className="text-center text-sm text-ae-text-muted">
        New to AgentExchange?{" "}
        <Link className="font-semibold text-ae-text underline decoration-ae-primary/50 underline-offset-4 transition hover:text-ae-primary" to={`/sign-up?redirect=${encodeURIComponent(redirectTo)}`}>
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
