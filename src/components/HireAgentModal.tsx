import { useEffect, useState, type FormEvent } from "react";

import { centsToDollarsInput, dollarsInputToCents, feeBreakdown, formatCents, parseMoneyToCents } from "../lib/money";

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
  const { createdOpportunities, isSharedMode, ownsOpportunity, submitHireRequest } =
    useAgentExchange();
  // A shared-mode hire request is issued against one of YOUR posted
  // opportunities: the resulting contract's organization is derived from it.
  const allOpportunities = isSharedMode
    ? createdOpportunities.filter((opportunity) => ownsOpportunity(opportunity.id))
    : getAllOpportunities(createdOpportunities);
  const [opportunityId, setOpportunityId] = useState("");
  const [quickJobTitle, setQuickJobTitle] = useState("");
  const [amountInput, setAmountInput] = useState("");

  const selectedOpportunity = allOpportunities.find(
    (opportunity) => opportunity.id === opportunityId,
  );
  // Prefill the offer from the brief's budget; the organization edits it.
  useEffect(() => {
    const suggested = parseMoneyToCents(selectedOpportunity?.budget);
    setAmountInput(suggested ? centsToDollarsInput(suggested) : "");
  }, [selectedOpportunity?.id, selectedOpportunity?.budget]);

  if (!isOpen || !agent) {
    return null;
  }

  const amountCents = dollarsInputToCents(amountInput);
  const canSubmit = isSharedMode
    ? Boolean(selectedOpportunity) && amountCents !== null
    : Boolean(selectedOpportunity || quickJobTitle.trim().length > 3);

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
      amountCents: amountCents ?? undefined,
    });
    setOpportunityId("");
    setQuickJobTitle("");
    setAmountInput("");
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
            {isSharedMode
              ? allOpportunities.length > 0
                ? "Select one of your posted opportunities to hire this agent for. The agent's operator accepts or declines."
                : "Post an opportunity first. Hire requests are issued against an opportunity you posted."
              : "Select an existing opportunity or create a quick job title for this local hire request."}
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
            <option value="">
              {isSharedMode ? "Choose an opportunity" : "Create quick job title instead"}
            </option>
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

        <label className="block space-y-2">
          <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
            Offered price (USD)
          </span>
          <input
            className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none transition placeholder:text-ae-text-muted/60 focus:border-ae-primary/60 focus:shadow-ae-glow"
            inputMode="decimal"
            onChange={(event) => setAmountInput(event.target.value)}
            placeholder="600"
            value={amountInput}
          />
          <span className="block text-xs leading-5 text-ae-text-muted">
            {amountCents
              ? `The agent's operator receives ${formatCents(feeBreakdown(amountCents, 1500).netCents)} after the 15% platform fee. Accepting the request is accepting this price; it cannot be changed afterwards.`
              : "A fixed price for the whole brief. No payment is taken yet."}
          </span>
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
