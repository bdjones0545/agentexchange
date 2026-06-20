import { useState, type FormEvent } from "react";

import type { Agent } from "../data/agents";
import { getAllOpportunities } from "../data/localSelectors";
import { useAgentExchange } from "../state/AgentExchangeContext";
import { PrimaryButton } from "./PrimaryButton";
import { SecondaryButton } from "./SecondaryButton";

type HireAgentModalProps = {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
};

export function HireAgentModal({ agent, isOpen, onClose }: HireAgentModalProps) {
  const { createdOpportunities, submitHireRequest } = useAgentExchange();
  const allOpportunities = getAllOpportunities(createdOpportunities);
  const [opportunityId, setOpportunityId] = useState("");
  const [quickJobTitle, setQuickJobTitle] = useState("");

  if (!isOpen || !agent) {
    return null;
  }

  const selectedOpportunity = allOpportunities.find(
    (opportunity) => opportunity.id === opportunityId,
  );
  const canSubmit = Boolean(selectedOpportunity || quickJobTitle.trim().length > 3);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!agent || !canSubmit) {
      return;
    }

    submitHireRequest({
      agentId: agent.id,
      agentName: agent.name,
      opportunityId: selectedOpportunity?.id,
      opportunityTitle:
        selectedOpportunity?.title || quickJobTitle.trim() || "Quick hire request",
      quickJobTitle: quickJobTitle.trim() || undefined,
    });
    setOpportunityId("");
    setQuickJobTitle("");
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
            Hire Agent
          </p>
          <h2 className="mt-2 font-ae-display text-3xl font-semibold text-ae-text">
            {agent.name}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ae-text-muted">
            Select an existing opportunity or create a quick job title for this
            local hire request.
          </p>
        </div>

        <label className="block space-y-2">
          <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
            Opportunity
          </span>
          <select
            className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
            onChange={(event) => setOpportunityId(event.target.value)}
            value={opportunityId}
          >
            <option value="">Create quick job title instead</option>
            {allOpportunities.map((opportunity) => (
              <option key={opportunity.id} value={opportunity.id}>
                {opportunity.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
            Quick job title
          </span>
          <input
            className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none transition placeholder:text-ae-text-muted/60 focus:border-ae-primary/60 focus:shadow-ae-glow"
            onChange={(event) => setQuickJobTitle(event.target.value)}
            placeholder="Example: Enterprise workflow audit"
            value={quickJobTitle}
          />
        </label>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton disabled={!canSubmit} type="submit">
            Submit Hire Request
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
