import { useMemo, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { ContractStatusBadge } from "../components/ContractStatusBadge";
import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { applyWorkspaceToContract } from "../data/contractWorkspace";
import { contracts } from "../data/operations";
import { useAgentExchange } from "../state/AgentExchangeContext";

function formatActivityDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
}

export function ContractDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const {
    addContractDeliverable,
    addContractMilestone,
    getContractWorkspace,
    localContracts,
    setDeliverableStatus,
    toggleMilestoneComplete,
    updateMilestoneNotes,
  } = useAgentExchange();
  const [deliverableNotes, setDeliverableNotes] = useState("");
  const [deliverableTitle, setDeliverableTitle] = useState("");
  const [milestoneNotes, setMilestoneNotes] = useState("");
  const [milestoneTitle, setMilestoneTitle] = useState("");

  const baseContract = [...localContracts, ...contracts].find(
    (contract) => contract.id === id,
  );
  const workspace = getContractWorkspace(id ?? "");
  const contract = useMemo(
    () =>
      baseContract ? applyWorkspaceToContract(baseContract, workspace) : undefined,
    [baseContract, workspace],
  );

  if (!id || !contract) {
    return <Navigate replace to="/contracts" />;
  }

  function handleAddMilestone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!milestoneTitle.trim()) {
      return;
    }

    addContractMilestone(contract.id, milestoneTitle.trim(), milestoneNotes.trim());
    setMilestoneNotes("");
    setMilestoneTitle("");
  }

  function handleAddDeliverable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!deliverableTitle.trim()) {
      return;
    }

    addContractDeliverable(
      contract.id,
      deliverableTitle.trim(),
      deliverableNotes.trim(),
    );
    setDeliverableNotes("");
    setDeliverableTitle("");
  }

  return (
    <section className="space-y-8">
      <button
        className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted transition hover:text-ae-primary"
        onClick={() => navigate("/contracts")}
        type="button"
      >
        Back to contracts
      </button>

      <GlassCard className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
              Contract Workspace
            </p>
            <h1 className="mt-2 font-ae-display text-3xl font-semibold tracking-[-0.02em] text-ae-text sm:text-5xl">
              {contract.title}
            </h1>
            <p className="mt-3 max-w-2xl text-ae-text-muted">
              Track milestones, deliverables, and local execution activity for
              this contract.
            </p>
          </div>
          <ContractStatusBadge status={contract.status} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Organization", contract.organization],
            ["Assigned Agent", contract.agent],
            ["Value", contract.value],
            ["Due Date", contract.dueDate],
          ].map(([label, value]) => (
            <div
              className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-4"
              key={label}
            >
              <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
                {label}
              </p>
              <p className="mt-2 font-semibold text-ae-text">{value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3 border-t border-white/[0.06] pt-4">
          <div className="flex items-center justify-between">
            <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
              Progress
            </p>
            <p className="font-ae-label text-sm font-semibold text-ae-primary">
              {contract.progress}%
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-ae-primary-action to-ae-primary"
              style={{ width: `${contract.progress}%` }}
            />
          </div>
        </div>
      </GlassCard>

      <section className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="space-y-5">
          <div>
            <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
              Milestones
            </p>
            <h2 className="mt-2 font-ae-display text-3xl font-semibold text-ae-text">
              Execution plan
            </h2>
          </div>

          <form className="space-y-3" onSubmit={handleAddMilestone}>
            <input
              className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
              onChange={(event) => setMilestoneTitle(event.target.value)}
              placeholder="Milestone title"
              value={milestoneTitle}
            />
            <textarea
              className="min-h-20 w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none placeholder:text-ae-text-muted/60 focus:border-ae-primary/60 focus:shadow-ae-glow"
              onChange={(event) => setMilestoneNotes(event.target.value)}
              placeholder="Notes or acceptance criteria"
              value={milestoneNotes}
            />
            <PrimaryButton disabled={!milestoneTitle.trim()} type="submit">
              Add Milestone
            </PrimaryButton>
          </form>

          <div className="space-y-3">
            {workspace.milestones.length > 0 ? (
              workspace.milestones.map((milestone) => (
                <article
                  className="space-y-3 rounded-ae-lg border border-white/[0.06] bg-white/[0.04] p-4"
                  key={milestone.id}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-ae-display text-xl font-semibold text-ae-text">
                        {milestone.title}
                      </h3>
                      <p className="mt-1 font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-text-muted">
                        {milestone.completed ? "Complete" : "Active"}
                      </p>
                    </div>
                    <SecondaryButton
                      onClick={() =>
                        toggleMilestoneComplete(contract.id, milestone.id)
                      }
                    >
                      {milestone.completed ? "Reopen" : "Mark Complete"}
                    </SecondaryButton>
                  </div>
                  <textarea
                    className="min-h-20 w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-sm text-ae-text outline-none placeholder:text-ae-text-muted/60 focus:border-ae-primary/60 focus:shadow-ae-glow"
                    defaultValue={milestone.notes}
                    onBlur={(event) =>
                      updateMilestoneNotes(
                        contract.id,
                        milestone.id,
                        event.target.value,
                      )
                    }
                  />
                </article>
              ))
            ) : (
              <p className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-4 text-ae-text-muted">
                No milestones yet. Add the first execution milestone above.
              </p>
            )}
          </div>
        </GlassCard>

        <GlassCard className="space-y-5">
          <div>
            <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
              Deliverables
            </p>
            <h2 className="mt-2 font-ae-display text-3xl font-semibold text-ae-text">
              Review queue
            </h2>
          </div>

          <form className="space-y-3" onSubmit={handleAddDeliverable}>
            <input
              className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
              onChange={(event) => setDeliverableTitle(event.target.value)}
              placeholder="Deliverable title"
              value={deliverableTitle}
            />
            <textarea
              className="min-h-20 w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none placeholder:text-ae-text-muted/60 focus:border-ae-primary/60 focus:shadow-ae-glow"
              onChange={(event) => setDeliverableNotes(event.target.value)}
              placeholder="Deliverable notes"
              value={deliverableNotes}
            />
            <PrimaryButton disabled={!deliverableTitle.trim()} type="submit">
              Add Deliverable
            </PrimaryButton>
          </form>

          <div className="space-y-3">
            {workspace.deliverables.length > 0 ? (
              workspace.deliverables.map((deliverable) => (
                <article
                  className="space-y-3 rounded-ae-lg border border-white/[0.06] bg-white/[0.04] p-4"
                  key={deliverable.id}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-ae-display text-xl font-semibold text-ae-text">
                        {deliverable.title}
                      </h3>
                      <p className="mt-1 font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-text-muted">
                        {deliverable.status}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      {deliverable.status === "draft" ? (
                        <SecondaryButton
                          onClick={() =>
                            setDeliverableStatus(
                              contract.id,
                              deliverable.id,
                              "submitted",
                            )
                          }
                        >
                          Mark Submitted
                        </SecondaryButton>
                      ) : null}
                      {deliverable.status !== "approved" ? (
                        <PrimaryButton
                          onClick={() =>
                            setDeliverableStatus(
                              contract.id,
                              deliverable.id,
                              "approved",
                            )
                          }
                        >
                          Mark Approved
                        </PrimaryButton>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-ae-text-muted">
                    {deliverable.notes || "No notes added."}
                  </p>
                </article>
              ))
            ) : (
              <p className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-4 text-ae-text-muted">
                No deliverables yet. Add a deliverable above to begin review.
              </p>
            )}
          </div>
        </GlassCard>
      </section>

      <GlassCard className="space-y-5">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            Activity Timeline
          </p>
          <h2 className="mt-2 font-ae-display text-3xl font-semibold text-ae-text">
            Workspace activity
          </h2>
        </div>
        <div className="space-y-3">
          {workspace.activity.map((activity) => (
            <article
              className="grid gap-2 rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-4 sm:grid-cols-[auto_1fr]"
              key={activity.id}
            >
              <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-primary">
                {formatActivityDate(activity.createdAt)}
              </p>
              <p className="text-sm text-ae-text-muted">{activity.message}</p>
            </article>
          ))}
        </div>
      </GlassCard>
    </section>
  );
}
