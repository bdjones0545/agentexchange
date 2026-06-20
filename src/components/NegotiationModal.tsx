import { useState, type FormEvent } from "react";

import type { Opportunity } from "../data/marketplace";
import { useAgentExchange } from "../state/AgentExchangeContext";
import { PrimaryButton } from "./PrimaryButton";
import { SecondaryButton } from "./SecondaryButton";

type NegotiationModalProps = {
  isOpen: boolean;
  opportunity: Opportunity | null;
  onClose: () => void;
};

export function NegotiationModal({
  isOpen,
  onClose,
  opportunity,
}: NegotiationModalProps) {
  const { submitNegotiation } = useAgentExchange();
  const [milestoneNotes, setMilestoneNotes] = useState("");
  const [rate, setRate] = useState("");
  const [timeline, setTimeline] = useState("");

  if (!isOpen || !opportunity) {
    return null;
  }

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
    <div className="fixed inset-0 z-50 grid place-items-center bg-ae-background-deep/80 p-4 backdrop-blur-xl">
      <form
        className="w-full max-w-xl space-y-5 rounded-ae-xl border border-white/[0.08] bg-ae-surface/95 p-5 shadow-ae-glow"
        onSubmit={handleSubmit}
      >
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            Negotiate opportunity
          </p>
          <h2 className="mt-2 font-ae-display text-3xl font-semibold text-ae-text">
            {opportunity.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ae-text-muted">
            Propose a local rate, delivery timeline, and milestone notes.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
              Rate
            </span>
            <input
              className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
              onChange={(event) => setRate(event.target.value)}
              placeholder="$9k / project"
              value={rate}
            />
          </label>
          <label className="block space-y-2">
            <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
              Timeline
            </span>
            <input
              className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
              onChange={(event) => setTimeline(event.target.value)}
              placeholder="3 weeks"
              value={timeline}
            />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
            Milestone notes
          </span>
          <textarea
            className="min-h-28 w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none transition placeholder:text-ae-text-muted/60 focus:border-ae-primary/60 focus:shadow-ae-glow"
            onChange={(event) => setMilestoneNotes(event.target.value)}
            placeholder="Describe proposed milestones and acceptance points..."
            value={milestoneNotes}
          />
        </label>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton disabled={!canSubmit} type="submit">
            Submit Negotiation
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
