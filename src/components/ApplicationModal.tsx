import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { budgetLabel } from "../lib/budgetLabel";
import { getAllAgents } from "../data/localSelectors";
import type { Opportunity } from "../data/marketplace";
import { useAgentExchange } from "../state/AgentExchangeContext";
import { PrimaryButton } from "./PrimaryButton";
import { SecondaryButton } from "./SecondaryButton";

type ApplicationModalProps = {
  isOpen: boolean;
  opportunity: Opportunity | null;
  onClose: () => void;
};

const panelClass =
  "ax-pop relative w-full max-w-xl space-y-6 rounded-3xl border border-white/10 bg-gradient-to-b from-ae-surface to-ae-background-deep p-6 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.05),0_40px_120px_-30px_rgb(0_0_0_/_0.9)] sm:p-8";

function ModalFrame({ children, titleId }: { children: ReactNode; titleId: string }) {
  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-ae-background-deep/70 backdrop-blur-md"
      role="dialog"
    >
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">{children}</div>
    </div>
  );
}

function ModalHeading({ opportunity, titleId, children }: { opportunity: Opportunity; titleId: string; children: ReactNode }) {
  return (
    <div>
      <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
        Apply to opportunity
      </p>
      <h2 id={titleId} className="mt-2 break-words font-ae-display text-2xl font-semibold tracking-tight text-ae-text sm:text-3xl">
        {opportunity.title}
      </h2>
      <p className="mt-3 inline-flex rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-ae-text-muted">
        {budgetLabel(opportunity.budget, opportunity.cadence)}
      </p>
      <p className="mt-3 text-sm leading-6 text-ae-text-muted">{children}</p>
    </div>
  );
}

export function ApplicationModal({
  isOpen,
  onClose,
  opportunity,
}: ApplicationModalProps) {
  const navigate = useNavigate();
  const titleId = useId();
  const { createdAgents, isSharedMode, ownsAgent, submitApplication } =
    useAgentExchange();
  // In shared mode you apply as an agent you operate; demo mode lets you
  // apply as any agent listed in this browser.
  const allAgents = isSharedMode
    ? createdAgents.filter((agent) => ownsAgent(agent.id))
    : getAllAgents(createdAgents);
  const [agentId, setAgentId] = useState(allAgents[0]?.id ?? "");
  const [proposal, setProposal] = useState("");

  if (!isOpen || !opportunity) {
    return null;
  }

  if (allAgents.length === 0) {
    return (
      <ModalFrame titleId={titleId}>
        <div className={panelClass}>
          <ModalHeading opportunity={opportunity} titleId={titleId}>
            Applications are submitted on behalf of an agent you operate.
            Publish an agent first, then come back to apply.
          </ModalHeading>
          <div className="flex flex-col gap-3 sm:flex-row">
            <PrimaryButton onClick={() => navigate("/create-agent")} type="button">
              Create an agent
            </PrimaryButton>
            <SecondaryButton onClick={onClose} type="button">
              Close
            </SecondaryButton>
          </div>
        </div>
      </ModalFrame>
    );
  }

  const selectedAgent =
    allAgents.find((agent) => agent.id === agentId) ?? allAgents[0];
  const canSubmit = Boolean(selectedAgent && proposal.trim().length >= 12);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedAgent || !canSubmit || !opportunity) {
      return;
    }

    submitApplication({
      agentId: selectedAgent.id,
      agentName: selectedAgent.name,
      opportunityId: opportunity.id,
      opportunityTitle: opportunity.title,
      proposal: proposal.trim(),
    });
    setProposal("");
    onClose();
  }

  return (
    <ModalFrame titleId={titleId}>
      <form className={panelClass} onSubmit={handleSubmit}>
        <ModalHeading opportunity={opportunity} titleId={titleId}>
          {isSharedMode
            ? "Select an agent you operate and submit a short proposal to the organization."
            : "Select an agent and submit a short proposal. This is stored locally in this browser."}
        </ModalHeading>

        <label className="block space-y-2">
          <span className="ax-label">Agent</span>
          <select
            className="ax-input"
            onChange={(event) => setAgentId(event.target.value)}
            value={agentId}
          >
            {allAgents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} - {agent.specialty}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="ax-label">Proposal</span>
          <textarea
            className="ax-input min-h-32 resize-y leading-6"
            onChange={(event) => setProposal(event.target.value)}
            placeholder="Summarize why this agent is a strong fit..."
            value={proposal}
          />
        </label>

        <div className="flex flex-col-reverse gap-3 border-t border-white/[0.06] pt-5 sm:flex-row sm:justify-end">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton disabled={!canSubmit} type="submit">
            Submit Application
          </PrimaryButton>
        </div>
      </form>
    </ModalFrame>
  );
}
