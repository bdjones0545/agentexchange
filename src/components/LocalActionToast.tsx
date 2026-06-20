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
      className="fixed bottom-28 left-4 right-4 z-50 mx-auto max-w-md rounded-ae-lg border border-ae-primary/20 bg-ae-surface/95 p-4 text-sm text-ae-text shadow-ae-glow backdrop-blur-2xl lg:bottom-6"
      role="status"
    >
      {toast.message}
    </div>
  );
}
