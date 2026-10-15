import { Link } from "react-router-dom";

import { ContractCard } from "../components/ContractCard";
import { GlassCard } from "../components/GlassCard";
import { PageHeader } from "../components/PageHeader";
import { applyWorkspaceToContract } from "../data/contractWorkspace";
import type { ContractStatus } from "../data/operations";
import { useAgentExchange } from "../state/AgentExchangeContext";

const sections: { title: string; status: ContractStatus; description: string; anchor: string; dot: string }[] =
  [
    {
      title: "Active Contracts",
      status: "Active",
      description: "In-flight operational contracts with active milestones.",
      anchor: "contracts-active",
      dot: "bg-ae-emerald",
    },
    {
      title: "In Review",
      status: "In Review",
      description: "Contracts with submitted deliverables awaiting approval.",
      anchor: "contracts-in-review",
      dot: "bg-ae-cyan",
    },
    {
      title: "Pending Approval",
      status: "Pending Approval",
      description: "Waiting on a final decision.",
      anchor: "contracts-pending-approval",
      dot: "bg-ae-amber",
    },
    {
      title: "Completed Contracts",
      status: "Completed",
      description: "Approved and closed.",
      anchor: "contracts-completed",
      dot: "bg-ae-primary",
    },
  ];

export function ContractsPage() {
  const { getContractWorkspace, isSharedMode, loading, localContracts } = useAgentExchange();
  const allContracts = localContracts.map((contract) =>
    applyWorkspaceToContract(contract, getContractWorkspace(contract.id)),
  );
  const counts = sections.map(
    (section) => allContracts.filter((contract) => contract.status === section.status).length,
  );

  return (
    <section className="space-y-10">
      <PageHeader
        actions={
          <span className="inline-flex items-center gap-2 rounded-full border border-ae-primary/25 bg-ae-primary/10 px-4 py-2 font-ae-label text-xs font-semibold uppercase tracking-[0.1em] text-ae-primary">
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            {allContracts.length} {allContracts.length === 1 ? "contract" : "contracts"}
          </span>
        }
        description={
          isSharedMode
            ? "Every contract you are a party to, with its deliverables and thread."
            : "Contracts created when applications or hire requests are accepted in this browser."
        }
        eyebrow="Contracts"
        title="Every agreement, from price to approval."
      />

      {allContracts.length > 0 ? (
        <nav aria-label="Contract status" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {sections.map((section, index) => {
            const tile = (
              <>
                <span className="flex items-center justify-between gap-3">
                  <span className="truncate font-ae-label text-[11px] font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
                    {section.title}
                  </span>
                  <span aria-hidden className={`size-2 shrink-0 rounded-full ${section.dot}`} />
                </span>
                <span className="mt-2 block font-ae-display text-3xl font-semibold tabular-nums tracking-[-0.03em] text-ae-text">
                  {counts[index]}
                </span>
              </>
            );

            return counts[index] > 0 ? (
              <a
                className="block rounded-2xl border border-white/[0.08] bg-ae-surface/70 px-4 py-3.5 transition hover:-translate-y-0.5 hover:border-ae-primary/30 hover:bg-ae-surface"
                href={`#${section.anchor}`}
                key={section.status}
              >
                {tile}
              </a>
            ) : (
              <div
                className="rounded-2xl border border-white/[0.06] bg-ae-surface/40 px-4 py-3.5 opacity-70"
                key={section.status}
              >
                {tile}
              </div>
            );
          })}
        </nav>
      ) : null}

      {allContracts.length === 0 && !loading ? (
        <GlassCard className="mx-auto max-w-2xl space-y-4 px-6 py-10 text-center sm:px-10">
          <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-2xl border border-ae-primary/20 bg-ae-primary/10 text-ae-primary">
            <svg className="size-6" viewBox="0 0 24 24">
              <path d="M7 3.5h7l4 4v13H7zM14 3.5v4h4M10 12h5M10 16h5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
            </svg>
          </span>
          <h2 className="font-ae-display text-2xl font-semibold tracking-tight text-ae-text">No contracts yet</h2>
          <p className="mx-auto max-w-md text-sm leading-6 text-ae-text-muted">
            A contract is created when an application, negotiation or hire request is accepted. It will appear here with its agreed price, deliverables and thread.
          </p>
          <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
            <Link
              className="inline-flex items-center justify-center rounded-xl bg-ae-primary-action px-5 py-3 font-ae-label text-sm font-semibold text-ae-primary-ink transition hover:-translate-y-0.5"
              to="/marketplace"
            >
              Browse the marketplace
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.04] px-5 py-3 font-ae-label text-sm font-semibold text-ae-text transition hover:-translate-y-0.5 hover:border-ae-primary/40"
              to="/applications"
            >
              Open your action queue
            </Link>
          </div>
        </GlassCard>
      ) : null}

      {sections.map((section, index) => {
        const sectionContracts = allContracts.filter(
          (contract) => contract.status === section.status,
        );

        if (sectionContracts.length === 0) {
          return null;
        }

        return (
          <section className="scroll-mt-24 space-y-5" id={section.anchor} key={section.status}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-3 font-ae-display text-2xl font-semibold tracking-tight text-ae-text sm:text-3xl">
                  {section.title}
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 font-ae-label text-xs font-semibold tabular-nums text-ae-text-muted">
                    {counts[index]}
                  </span>
                </h2>
                <p className="mt-2 text-ae-text-muted">{section.description}</p>
              </div>
            </div>
            <div className="grid gap-4">
              {sectionContracts.map((contract) => (
                <ContractCard contract={contract} key={contract.id} />
              ))}
            </div>
          </section>
        );
      })}
    </section>
  );
}
