import { useAgentExchange } from "../state/AgentExchangeContext";

type SavedOpportunityButtonProps = {
  opportunityId: string;
};

export function SavedOpportunityButton({
  opportunityId,
}: SavedOpportunityButtonProps) {
  const { isOpportunitySaved, toggleSavedOpportunity } = useAgentExchange();
  const isSaved = isOpportunitySaved(opportunityId);

  return (
    <button
      aria-pressed={isSaved}
      className={[
        "inline-flex items-center justify-center rounded-full border px-3 py-1",
        "font-ae-label text-xs font-semibold uppercase tracking-[0.08em] transition",
        isSaved
          ? "border-ae-primary/30 bg-ae-primary/15 text-ae-primary shadow-ae-glow"
          : "border-white/10 bg-white/[0.04] text-ae-text-muted hover:border-ae-primary/30 hover:text-ae-text",
      ].join(" ")}
      onClick={() => toggleSavedOpportunity(opportunityId)}
      type="button"
    >
      {isSaved ? "Saved" : "Save"}
    </button>
  );
}
