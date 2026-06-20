import { Outlet } from "react-router-dom";

import { useAgentExchange } from "../state/AgentExchangeContext";
import { BottomNavigation } from "./BottomNavigation";
import { LocalActionToast } from "./LocalActionToast";
import { TopNavigation } from "./TopNavigation";

export function AppShell() {
  const { error, loading, saving } = useAgentExchange();

  return (
    <div className="relative min-h-screen overflow-hidden text-ae-text">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-[8%] top-32 size-1 rounded-full bg-ae-primary" />
        <div className="absolute right-[18%] top-48 size-1.5 rounded-full bg-ae-secondary" />
        <div className="absolute left-[42%] top-72 size-1 rounded-full bg-ae-text-muted" />
        <div className="absolute bottom-48 right-[34%] size-1 rounded-full bg-ae-primary" />
      </div>

      <TopNavigation />

      <main className="relative mx-auto min-h-[calc(100vh-4.5rem)] max-w-6xl px-4 py-8 pb-32 sm:px-6 lg:px-12 lg:pb-12">
        {(loading || saving || error) && (
          <div className="mb-4 rounded-ae-md border border-white/[0.08] bg-white/[0.04] px-4 py-3 font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-text-muted backdrop-blur-2xl">
            {error ?? (loading ? "Loading workspace data" : "Saving workspace data")}
          </div>
        )}
        <Outlet />
      </main>

      <BottomNavigation />
      <LocalActionToast />
    </div>
  );
}
