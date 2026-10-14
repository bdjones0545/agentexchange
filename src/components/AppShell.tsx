import { PageHead } from "./PageHead";
import { pageMetadata } from "../content/metadata";
import { getAllAgents, getAllOpportunities } from "../data/localSelectors";
import { SiteFooter } from "./SiteFooter";
import { Suspense, useEffect, useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { useAgentExchange } from "../state/AgentExchangeContext";
import { useAuth } from "../state/AuthContext";
import { buildAgentExchangeTools, useWebMcpTools, webMcpConfig } from "../webmcp";
import { BottomNavigation } from "./BottomNavigation";
import { LocalActionToast } from "./LocalActionToast";
import { TopNavigation } from "./TopNavigation";

export function AppShell() {
  const exchange = useAgentExchange();
  const {pathname, hash}=useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  const { error, loading, saving } = exchange;
  const { isAuthenticated } = useAuth();

  // Publish this app's read-only tools to any AI agent driving the page.
  // No-op unless VITE_WEBMCP_ENABLED is set; see src/webmcp/README.md.
  useWebMcpTools(
    buildAgentExchangeTools,
    useMemo(
      () => ({
        isAuthenticated,
        workerProfileIds: exchange.workers.map((worker) => worker.profileId).filter((id): id is string => Boolean(id)),
        state: {
          agentActivities: exchange.agentActivities,
          agentReviews: exchange.agentReviews,
          applications: exchange.applications,
          contractWorkspaces: exchange.contractWorkspaces,
          contractDisputes: exchange.contractDisputes,
          createdAgents: exchange.createdAgents,
          createdOpportunities: exchange.createdOpportunities,
          hireRequests: exchange.hireRequests,
          localContracts: exchange.localContracts,
          negotiations: exchange.negotiations,
          savedOpportunities: exchange.savedOpportunities,
        },
      }),
      [exchange, isAuthenticated],
    ),
    webMcpConfig(),
  );

  return (
    <div className="relative min-h-screen overflow-x-clip text-ae-text">
      <PageHead meta={pageMetadata(pathname,{agents:getAllAgents(exchange.createdAgents),briefs:getAllOpportunities(exchange.createdOpportunities)})} />
      <TopNavigation />

      <main id="main-content" tabIndex={-1} className="relative mx-auto min-h-[calc(100vh-4.5rem)] max-w-7xl px-4 py-8 pb-32 sm:px-6 lg:px-10 lg:pb-12">
        {(loading || saving || error) && (
          <div role="status" className="mb-6 flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-ae-surface/70 px-4 py-3 font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-text-muted backdrop-blur-xl"><span aria-hidden className={`size-1.5 rounded-full ${error ? "bg-ae-amber" : "bg-ae-primary motion-safe:animate-pulse"}`} />
            {error ?? (loading ? "Loading workspace data" : "Saving workspace data")}
          </div>
        )}
        <Suspense fallback={<div role="status" className="rounded-2xl border border-white/10 bg-ae-surface/60 p-8 text-ae-text-muted motion-safe:animate-pulse">Loading…</div>}><div key={pathname} className="ax-page"><Outlet /></div></Suspense>
      </main>

      <SiteFooter />
      <BottomNavigation />
      <LocalActionToast />
    </div>
  );
}
