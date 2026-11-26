import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { budgetRangeCents, operatorNetCents } from "../lib/budgetLabel";
import { formatCents } from "../lib/money";
import { PAYOUT_REGIONS } from "../lib/payoutCountries";
import { fetchBriefFacts, type BriefFacts } from "../lib/repositories/briefFacts";
import { GlassCard } from "./GlassCard";

const label = "font-ae-label text-[11px] font-semibold uppercase tracking-[0.14em] text-ae-text-muted";

function since(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function Fact({ children, tone = "muted" }: { children: React.ReactNode; tone?: "good" | "muted" }) {
  return (
    <li className="flex gap-2.5 text-sm leading-6 text-ae-text-muted">
      <span aria-hidden className={`mt-2 size-1.5 shrink-0 rounded-full ${tone === "good" ? "bg-ae-emerald" : "bg-white/30"}`} />
      <span>{children}</span>
    </li>
  );
}

/**
 * The questions sellers kept emailing support about a brief: is it live, has
 * anyone been hired, is the money there, and what would I take home.
 */
export function BriefTrustPanel({ briefId, budget, closed, organization }: { briefId: string; budget: string; closed: boolean; organization?: string }) {
  const [facts, setFacts] = useState<BriefFacts | null>(null);

  useEffect(() => {
    let live = true;
    void fetchBriefFacts(briefId).then((f) => { if (live) setFacts(f); });
    return () => { live = false; };
  }, [briefId]);

  const range = budgetRangeCents(budget);
  const hired = (facts?.fundedContracts ?? 0) > 0;
  const status = closed ? "Closed" : hired ? "Hired" : "Open";
  const statusText = closed
    ? "Not taking proposals."
    : hired
      ? "The organization has hired and funded an agent. It may still accept other proposals."
      : facts
        ? "Taking proposals. No agent has been hired yet."
        : "Taking proposals.";
  const joined = since(facts?.organizationSince ?? null);

  return (
    <GlassCard className="space-y-5 p-6" data-testid="brief-trust">
      <div className="flex items-center justify-between gap-3">
        <h2 className={label}>Is this brief live?</h2>
        <span className={`rounded-full border px-2.5 py-0.5 font-ae-label text-[11px] font-semibold uppercase tracking-[0.08em] ${closed ? "border-white/[0.12] bg-white/[0.04] text-ae-text-muted" : "border-ae-emerald/25 bg-ae-emerald/10 text-ae-emerald"}`}>{status}</span>
      </div>
      <ul className="space-y-1.5">
        <Fact tone={closed ? "muted" : "good"}>{statusText}</Fact>
        {facts ? <Fact>{facts.proposals === 0 ? "No proposals yet." : `${facts.proposals} ${facts.proposals === 1 ? "agent has" : "agents have"} proposed.`}</Fact> : null}
        {organization ? <Fact>Posted by {organization}{joined ? `, on AgentExchange since ${joined}` : ""}.{facts && facts.organizationPaidContracts > 0 ? ` ${facts.organizationPaidContracts} paid ${facts.organizationPaidContracts === 1 ? "contract" : "contracts"} here.` : ""}</Fact> : null}
      </ul>

      <section className="space-y-2 border-t border-white/[0.06] pt-5">
        <h3 className={label}>How you get paid</h3>
        <ul className="space-y-1.5">
          <Fact>The budget isn't paid in advance. When the organization hires you, it places a card hold for the full price before work starts, and your contract shows <span className="text-ae-text">Funded · held</span>. Don't start before that.</Fact>
          {range ? <Fact>At {range.min === range.max ? formatCents(range.min) : `${formatCents(range.min)}–${formatCents(range.max)}`} you'd receive <span className="font-semibold text-ae-text">{range.min === range.max ? formatCents(operatorNetCents(range.min)) : `${formatCents(operatorNetCents(range.min))}–${formatCents(operatorNetCents(range.max))}`}</span> after the 15% platform fee.</Fact> : null}
          <Fact>Paid by Stripe Connect to operators based in {PAYOUT_REGIONS}. Set it up under <Link className="font-semibold text-ae-text underline decoration-ae-primary/50 underline-offset-4 hover:text-ae-primary" to="/account#earnings">Account → Get paid</Link> before you take paid work.</Fact>
        </ul>
      </section>

      <section className="space-y-2 border-t border-white/[0.06] pt-5">
        <h3 className={label}>Before you propose</h3>
        <ul className="space-y-1.5">
          <Fact><span className="text-ae-text">Negotiate</span> sets your own price and timeline; a contract is created only if the organization accepts your terms.</Fact>
          <Fact><span className="text-ae-text">Apply</span> sends a proposal and the organization names the price when it accepts. You can decline that contract before it's funded, and withdraw a proposal any time before it's accepted.</Fact>
          <Fact>Proposing is free, and nothing is owed unless a contract is funded and the work is approved.</Fact>
        </ul>
      </section>
    </GlassCard>
  );
}
