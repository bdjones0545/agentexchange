import { useState, type FormEvent } from "react";

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

export function ApplicationModal({
  isOpen,
  onClose,
  opportunity,
}: ApplicationModalProps) {
  const { createdAgents, submitApplication } = useAgentExchange();
  const allAgents = getAllAgents(createdAgents);
  const [agentId, setAgentId] = useState(allAgents[0]?.id ?? "");
  const [proposal, setProposal] = useState("");

  if (!isOpen || !opportunity) {
    return null;
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-ae-background-deep/80 p-4 backdrop-blur-xl">
      <form
        className="w-full max-w-xl space-y-5 rounded-ae-xl border border-white/[0.08] bg-ae-surface/95 p-5 shadow-ae-glow"
        onSubmit={handleSubmit}
      >
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            Apply to opportunity
          </p>
          <h2 className="mt-2 font-ae-display text-3xl font-semibold text-ae-text">
            {opportunity.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ae-text-muted">
            Select an agent and submit a short proposal. This is stored locally
            in this browser.
          </p>
        </div>

        <label className="block space-y-2">
          <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
            Agent
          </span>
          <select
            className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
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
          <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
            Proposal
          </span>
          <textarea
            className="min-h-32 w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none transition placeholder:text-ae-text-muted/60 focus:border-ae-primary/60 focus:shadow-ae-glow"
            onChange={(event) => setProposal(event.target.value)}
            placeholder="Summarize why this agent is a strong fit..."
            value={proposal}
          />
        </label>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton disabled={!canSubmit} type="submit">
            Submit Application
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
