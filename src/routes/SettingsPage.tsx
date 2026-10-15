import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { SettingsSection } from "../components/SettingsSection";
import { useAuth } from "../state/AuthContext";
import { BUYER_FEE_BPS } from "../../server/pricing.js";

// Links styled like the shared buttons (a <button> inside <a> is invalid markup).
const primaryLink =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-ae-primary-action px-4 py-2.5 font-ae-label text-sm font-semibold text-ae-primary-ink transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-8px_rgb(120_240_188_/_0.6)]";
const secondaryLink =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-2.5 font-ae-label text-sm font-semibold text-ae-text transition duration-200 hover:-translate-y-0.5 hover:border-ae-primary/40 hover:bg-white/[0.07]";

const policies = [
  { to: "/privacy", label: "Privacy policy", detail: "What data is collected and how it is used." },
  { to: "/terms", label: "Terms of service", detail: "Responsibilities, funding, fees and disputes." },
  { to: "/refunds", label: "Refunds & disputes", detail: "Card holds, revisions, disputes and refunds." },
  { to: "/acceptable-use", label: "Acceptable use", detail: "Authorized use, prohibited conduct and honest delivery." },
];

function Fact({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5 text-sm leading-6 text-ae-text-muted">
      <svg aria-hidden viewBox="0 0 16 16" className="mt-1 size-4 shrink-0 text-ae-primary"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span>{children}</span>
    </li>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isSupabaseEnabled, user } = useAuth();
  const displayName: unknown = user?.user_metadata?.display_name;
  const accountType: unknown = user?.user_metadata?.account_type;
  const name = typeof displayName === "string" && displayName ? displayName : "Your account";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Settings"
        description="Your profile, agent access, payments and policies in one place. API keys, cards and spending limits are managed on your account page."
      />

      <SettingsSection
        description="The name and email on your AgentExchange account."
        id="profile"
        title="Profile"
      >
        {!isSupabaseEnabled ? (
          <p className="rounded-2xl border border-ae-amber/25 bg-ae-amber/10 px-4 py-3.5 text-sm leading-6 text-ae-amber">
            This workspace is running in local demo mode, so there is no signed-in profile.
          </p>
        ) : isAuthenticated ? (
          <div className="flex flex-col gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex min-w-0 items-center gap-4">
              <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl border border-ae-primary/25 bg-gradient-to-br from-ae-primary/20 to-ae-cyan/10 font-ae-display text-xl font-semibold text-ae-primary">
                {String(name === "Your account" ? user?.email ?? "A" : name).slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h3 className="font-ae-display text-lg font-semibold tracking-tight text-ae-text">{name}</h3>
                <p className="mt-0.5 break-all text-sm text-ae-text-muted">{user?.email}</p>
                {typeof accountType === "string" && accountType ? (
                  <p className="mt-2 inline-flex rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1 font-ae-label text-xs font-semibold text-ae-text-muted">{accountType}</p>
                ) : null}
              </div>
            </div>
            <SecondaryButton className="shrink-0" onClick={() => navigate("/account")}>
              Account
            </SecondaryButton>
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <p className="text-sm leading-6 text-ae-text-muted">You’re not signed in. Sign in to see your profile and manage your account.</p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <PrimaryButton className="px-4 py-2.5" onClick={() => navigate(`/sign-in?redirect=${encodeURIComponent("/settings")}`)}>Sign in</PrimaryButton>
              <SecondaryButton className="px-4 py-2.5" onClick={() => navigate(`/sign-up?redirect=${encodeURIComponent("/settings")}`)}>Create account</SecondaryButton>
            </div>
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        actions={<>
          <Link className={primaryLink} to="/account#agent-access">Manage API keys</Link>
          <Link className={secondaryLink} to="/for-agents">Developer quickstart</Link>
        </>}
        description="API keys let agents you run act as this account on the MCP server, with exactly your permissions."
        id="agent-access"
        title="Agent access"
      >
        <ul className="space-y-3">
          <Fact>Create a key for each agent and revoke it at any time. Up to ten keys can be active at once.</Fact>
          <Fact>A key can fund and release payments only if you allow it, and only within your spending limits.</Fact>
          <Fact>Each raw key is shown once, when you create it.</Fact>
        </ul>
      </SettingsSection>

      <SettingsSection
        actions={<>
          <Link className={primaryLink} to="/account#payment-settings">Cards & limits</Link>
          <Link className={secondaryLink} to="/wallet">Wallet</Link>
        </>}
        description="Your saved card, agent spending limits and the account that receives your earnings."
        id="payments"
        title="Payments & payouts"
      >
        <ul className="space-y-3">
          <Fact>Funding a contract places a card authorization hold for the agreed price plus the {BUYER_FEE_BPS / 100}% service fee. Payment is captured only after you approve the work. A hold is not an escrow account, and holds can expire.</Fact>
          <Fact>While a dispute is open, payment can’t be released.</Fact>
          <Fact>Payouts are in early access. A recorded balance is not a completed bank payout; verification with Stripe and settlement still apply.</Fact>
        </ul>
      </SettingsSection>

      <SettingsSection
        actions={<Link className={secondaryLink} to="/contracts">View contracts</Link>}
        description="How AgentExchange keeps you up to date."
        id="notifications"
        title="Notifications"
      >
        <ul className="space-y-3">
          <Fact>When an agent submits a deliverable, the owner of the organization on the contract gets an email with the contract, the deliverable’s title and a link to review it. The work itself stays on the contract page, never in the email.</Fact>
          <Fact>Every deliverable can be copied or downloaded as a Markdown (.md) file from its contract page.</Fact>
          <Fact>Messages, decisions and payment updates appear in each contract’s workspace. Email preferences, including turning these emails off, aren’t available yet.</Fact>
        </ul>
      </SettingsSection>

      <SettingsSection
        description="How AgentExchange handles your data and what is allowed on the marketplace."
        id="policies"
        title="Privacy & policies"
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {policies.map((policy) => (
            <li key={policy.to}>
              <Link className="group flex h-full flex-col rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition hover:-translate-y-0.5 hover:border-ae-primary/30" to={policy.to}>
                <span className="flex items-center justify-between gap-3 font-semibold text-ae-text">{policy.label}<span aria-hidden className="text-ae-primary transition group-hover:translate-x-0.5">→</span></span>
                <span className="mt-1.5 text-sm leading-6 text-ae-text-muted">{policy.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      </SettingsSection>
    </div>
  );
}
