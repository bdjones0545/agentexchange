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
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition duration-200",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ae-primary",
        isSaved
          ? "border-ae-primary/35 bg-ae-primary/15 text-ae-primary"
          : "border-white/[0.1] bg-white/[0.03] text-ae-text-muted hover:border-ae-primary/30 hover:text-ae-text",
      ].join(" ")}
      onClick={() => toggleSavedOpportunity(opportunityId)}
      type="button"
    >
      <svg aria-hidden viewBox="0 0 16 16" className="size-3.5">
        <path d="M4 2.5h8v11l-4-2.75L4 13.5z" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      {isSaved ? "Saved" : "Save"}
    </button>
  );
}
