import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { budgetLabel } from "../lib/budgetLabel";
import type { Opportunity } from "../data/marketplace";
import { useAgentExchange } from "../state/AgentExchangeContext";
import { PrimaryButton } from "./PrimaryButton";
import { SecondaryButton } from "./SecondaryButton";

type NegotiationModalProps = {
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
        Negotiate opportunity
      </p>
      <h2 id={titleId} className="mt-2 break-words font-ae-display text-2xl font-semibold tracking-tight text-ae-text sm:text-3xl">
        {opportunity.title}
      </h2>
      <p className="mt-3 inline-flex rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-ae-text-muted">
        Posted budget · {budgetLabel(opportunity.budget, opportunity.cadence)}
      </p>
      <p className="mt-3 text-sm leading-6 text-ae-text-muted">{children}</p>
    </div>
  );
}

export function NegotiationModal({
  isOpen,
  onClose,
  opportunity,
}: NegotiationModalProps) {
  const navigate = useNavigate();
  const titleId = useId();
  const { createdAgents, isSharedMode, ownsAgent, submitNegotiation } =
    useAgentExchange();
  // Shared mode negotiates on behalf of one of your own agents. Demo mode
  // keeps the original simulated-agent behaviour.
  const ownedAgents = isSharedMode
    ? createdAgents.filter((agent) => ownsAgent(agent.id))
    : [];
  const [agentId, setAgentId] = useState(ownedAgents[0]?.id ?? "");
  const [milestoneNotes, setMilestoneNotes] = useState("");
  const [rate, setRate] = useState("");
  const [timeline, setTimeline] = useState("");

  if (!isOpen || !opportunity) {
    return null;
  }

  if (isSharedMode && ownedAgents.length === 0) {
    return (
      <ModalFrame titleId={titleId}>
        <div className={panelClass}>
          <ModalHeading opportunity={opportunity} titleId={titleId}>
            Negotiations are opened on behalf of an agent you operate.
            Publish an agent first, then come back to negotiate.
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
    ownedAgents.find((agent) => agent.id === agentId) ?? ownedAgents[0];

  const canSubmit =
    rate.trim().length > 0 &&
    timeline.trim().length > 0 &&
    milestoneNotes.trim().length >= 8;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit || !opportunity) {
      return;
    }

    submitNegotiation({
      agentId: selectedAgent?.id,
      agentName: selectedAgent?.name,
      milestoneNotes: milestoneNotes.trim(),
      opportunityId: opportunity.id,
      opportunityTitle: opportunity.title,
      rate: rate.trim(),
      timeline: timeline.trim(),
    });
    setMilestoneNotes("");
    setRate("");
    setTimeline("");
    onClose();
  }

  return (
    <ModalFrame titleId={titleId}>
      <form className={panelClass} onSubmit={handleSubmit}>
        <ModalHeading opportunity={opportunity} titleId={titleId}>
          Propose a rate, delivery timeline, and milestone notes.
        </ModalHeading>

        {isSharedMode ? (
          <label className="block space-y-2">
            <span className="ax-label">Negotiating agent</span>
            <select
              className="ax-input"
              onChange={(event) => setAgentId(event.target.value)}
              value={selectedAgent?.id ?? ""}
            >
              {ownedAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="ax-label">Rate</span>
            <input
              className="ax-input"
              onChange={(event) => setRate(event.target.value)}
              placeholder="$9k / project"
              value={rate}
            />
          </label>
          <label className="block space-y-2">
            <span className="ax-label">Timeline</span>
            <input
              className="ax-input"
              onChange={(event) => setTimeline(event.target.value)}
              placeholder="3 weeks"
              value={timeline}
            />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="ax-label">Milestone notes</span>
          <textarea
            className="ax-input min-h-28 resize-y leading-6"
            onChange={(event) => setMilestoneNotes(event.target.value)}
            placeholder="Describe proposed milestones and acceptance points..."
            required
            minLength={8}
            value={milestoneNotes}
          />
          <span className="block text-xs text-ae-text-muted">Required, at least 8 characters. Rate and timeline are required too.</span>
        </label>

        <div className="flex flex-col-reverse gap-3 border-t border-white/[0.06] pt-5 sm:flex-row sm:justify-end">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton disabled={!canSubmit} type="submit">
            Submit Negotiation
          </PrimaryButton>
        </div>
      </form>
    </ModalFrame>
  );
}
