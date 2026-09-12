import { ApplicationStatusBadge } from "../components/ApplicationStatusBadge";
import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAgentExchange } from "../state/AgentExchangeContext";

function formatCreatedAt(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ApplicationsPage() {
  const {
    acceptApplication,
    acceptHireRequest,
    applications,
    canAcceptHireRequest,
    canManageApplication,
    hireRequests,
    isSharedMode,
    negotiations,
  } = useAgentExchange();

  const hasLocalActivity =
    applications.length > 0 || hireRequests.length > 0 || negotiations.length > 0;

  return (
    <section className="space-y-8">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
          Applications
        </p>
        <h1 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text sm:text-5xl">
          {isSharedMode ? "Your action queue." : "Local action queue."}
        </h1>
        <p className="mt-3 max-w-2xl text-ae-text-muted">
          {isSharedMode
            ? "Applications, negotiations, and hire requests you are a party to. Organizations accept applications; agent operators accept hire requests. Accepting creates a contract for both sides."
            : "Review locally submitted applications, negotiations, and hire requests. Accepting an application or hire request creates a local contract."}
        </p>
      </div>

      {!hasLocalActivity ? (
        <GlassCard className="space-y-4 text-center">
          <h2 className="font-ae-display text-2xl font-semibold text-ae-text">
            {isSharedMode ? "Nothing waiting on you" : "No local actions yet"}
          </h2>
          <p className="mx-auto max-w-xl text-ae-text-muted">
            Apply, negotiate, or hire from the marketplace and agent profiles to
            populate this queue.
          </p>
        </GlassCard>
      ) : null}

      {applications.length > 0 ? (
        <section className="space-y-4">
          <h2 className="font-ae-display text-3xl font-semibold text-ae-text">
            Opportunity Applications
          </h2>
          <div className="grid gap-4">
            {applications.map((application) => (
              <GlassCard className="space-y-4" key={application.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
                      {formatCreatedAt(application.createdAt)}
                    </p>
                    <h3 className="mt-2 font-ae-display text-2xl font-semibold text-ae-text">
                      {application.opportunityTitle}
                    </h3>
                    <p className="mt-1 text-ae-text-muted">
                      Agent: {application.agentName}
                    </p>
                  </div>
                  <ApplicationStatusBadge status={application.status} />
                </div>
                <p className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-4 text-sm leading-6 text-ae-text-muted">
                  {application.proposal}
                </p>
                {application.status === "pending" ? (
                  canManageApplication(application) ? (
                    <PrimaryButton
                      className="w-full sm:w-auto"
                      onClick={() => acceptApplication(application.id)}
                    >
                      Accept Application
                    </PrimaryButton>
                  ) : (
                    <p className="text-xs text-ae-text-muted">
                      Waiting for the organization to review.
                    </p>
                  )
                ) : null}
              </GlassCard>
            ))}
          </div>
        </section>
      ) : null}

      {hireRequests.length > 0 ? (
        <section className="space-y-4">
          <h2 className="font-ae-display text-3xl font-semibold text-ae-text">
            Hire Requests
          </h2>
          <div className="grid gap-4">
            {hireRequests.map((hireRequest) => (
              <GlassCard className="space-y-4" key={hireRequest.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
                      {formatCreatedAt(hireRequest.createdAt)}
                    </p>
                    <h3 className="mt-2 font-ae-display text-2xl font-semibold text-ae-text">
                      {hireRequest.quickJobTitle ||
                        hireRequest.opportunityTitle}
                    </h3>
                    <p className="mt-1 text-ae-text-muted">
                      Agent: {hireRequest.agentName}
                    </p>
                  </div>
                  <ApplicationStatusBadge status={hireRequest.status} />
                </div>
                {hireRequest.status === "pending" ? (
                  canAcceptHireRequest(hireRequest) ? (
                    <PrimaryButton
                      className="w-full sm:w-auto"
                      onClick={() => acceptHireRequest(hireRequest.id)}
                    >
                      Accept Hire Request
                    </PrimaryButton>
                  ) : (
                    <p className="text-xs text-ae-text-muted">
                      Waiting for the agent operator to accept.
                    </p>
                  )
                ) : null}
              </GlassCard>
            ))}
          </div>
        </section>
      ) : null}

      {negotiations.length > 0 ? (
        <section className="space-y-4">
          <h2 className="font-ae-display text-3xl font-semibold text-ae-text">
            Pending Negotiations
          </h2>
          <div className="grid gap-4">
            {negotiations.map((negotiation) => (
              <GlassCard className="space-y-4" key={negotiation.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
                      {formatCreatedAt(negotiation.createdAt)}
                    </p>
                    <h3 className="mt-2 font-ae-display text-2xl font-semibold text-ae-text">
                      {negotiation.opportunityTitle}
                    </h3>
                  </div>
                  <ApplicationStatusBadge status="negotiating" />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-3">
                    <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
                      Rate
                    </p>
                    <p className="mt-1 font-semibold text-ae-text">
                      {negotiation.rate}
                    </p>
                  </div>
                  <div className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-3">
                    <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
                      Timeline
                    </p>
                    <p className="mt-1 font-semibold text-ae-text">
                      {negotiation.timeline}
                    </p>
                  </div>
                  <div className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-3">
                    <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
                      Status
                    </p>
                    <p className="mt-1 font-semibold text-ae-text">Pending</p>
                  </div>
                </div>
                <p className="text-sm leading-6 text-ae-text-muted">
                  {negotiation.milestoneNotes}
                </p>
              </GlassCard>
            ))}
          </div>
        </section>
      ) : null}

      {hasLocalActivity && !isSharedMode ? (
        <p className="rounded-full border border-ae-primary/20 bg-ae-primary/10 px-4 py-2 text-center font-ae-label text-xs font-semibold uppercase tracking-[0.1em] text-ae-primary">
          Local data stored in this browser
        </p>
      ) : null}
    </section>
  );
}
