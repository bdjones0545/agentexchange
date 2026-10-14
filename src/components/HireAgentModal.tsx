import { useEffect, useId, useState, type FormEvent } from "react";

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
  const titleId = useId();
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
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-ae-background-deep/70 backdrop-blur-md"
      role="dialog"
    >
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <form
          className="ax-pop relative w-full max-w-xl space-y-6 rounded-3xl border border-white/10 bg-gradient-to-b from-ae-surface to-ae-background-deep p-6 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.05),0_40px_120px_-30px_rgb(0_0_0_/_0.9)] sm:p-8"
          onSubmit={handleSubmit}
        >
          <div className="flex items-start gap-4">
            <span
              aria-hidden
              className="grid size-12 shrink-0 place-items-center rounded-2xl border border-ae-primary/25 bg-gradient-to-br from-ae-primary/20 to-ae-cyan/10 font-ae-label text-sm font-semibold text-ae-primary"
            >
              {agent.avatarInitials}
            </span>
            <div className="min-w-0">
              <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
                Hire Agent
              </p>
              <h2 id={titleId} className="mt-1 break-words font-ae-display text-2xl font-semibold tracking-tight text-ae-text sm:text-3xl">
                {agent.name}
              </h2>
            </div>
          </div>
          <p className="text-sm leading-6 text-ae-text-muted">
            {isSharedMode
              ? allOpportunities.length > 0
                ? "Select one of your posted opportunities to hire this agent for. The agent's operator accepts or declines."
                : "Post an opportunity first. Hire requests are issued against an opportunity you posted."
              : "Select an existing opportunity or create a quick job title for this local hire request."}
          </p>

          <label className="block space-y-2">
            <span className="ax-label">Opportunity</span>
            <select
              className="ax-input"
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
            <span className="ax-label">Quick job title</span>
            <input
              className="ax-input"
              onChange={(event) => setQuickJobTitle(event.target.value)}
              placeholder="Example: Enterprise workflow audit"
              value={quickJobTitle}
            />
          </label>

          <label className="block space-y-2">
            <span className="ax-label">Offered price (USD)</span>
            <input
              className="ax-input tabular-nums"
              inputMode="decimal"
              onChange={(event) => setAmountInput(event.target.value)}
              placeholder="600"
              value={amountInput}
            />
            <span className={`block rounded-xl border px-3.5 py-2.5 text-xs leading-5 ${amountCents ? "border-ae-primary/15 bg-ae-primary/[0.05] text-ae-text-muted" : "border-white/[0.06] bg-white/[0.02] text-ae-text-muted"}`}>
              {amountCents
                ? `The agent's operator receives ${formatCents(feeBreakdown(amountCents, 1500).netCents)} after the 15% platform fee. Accepting the request is accepting this price; it cannot be changed afterwards.`
                : "A fixed price for the whole brief. No payment is taken yet."}
            </span>
          </label>

          <div className="flex flex-col-reverse gap-3 border-t border-white/[0.06] pt-5 sm:flex-row sm:justify-end">
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            <PrimaryButton disabled={!canSubmit} type="submit">
              Submit Hire Request
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}
