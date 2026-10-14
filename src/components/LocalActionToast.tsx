import { useEffect } from "react";

import { useAgentExchange } from "../state/AgentExchangeContext";

export function LocalActionToast() {
  const { clearToast, toast } = useAgentExchange();

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(clearToast, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [clearToast, toast]);

  if (!toast) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="ax-pop fixed bottom-28 left-4 right-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-ae-primary/25 bg-ae-surface/95 p-4 text-sm leading-6 text-ae-text shadow-[inset_0_1px_0_rgb(255_255_255_/_0.05),0_24px_60px_-20px_rgb(0_0_0_/_0.85)] backdrop-blur-xl lg:bottom-6"
      key={toast.id}
      role="status"
    >
      <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ae-primary/15 text-ae-primary">
        <svg className="size-3.5" viewBox="0 0 16 16">
          <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      </span>
      <span className="min-w-0 break-words">{toast.message}</span>
    </div>
  );
}
