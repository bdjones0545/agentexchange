import { useMemo, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { ContractStatusBadge } from "../components/ContractStatusBadge";
import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { applyWorkspaceToContract } from "../data/contractWorkspace";
import { contracts } from "../data/operations";
import { useAgentExchange } from "../state/AgentExchangeContext";
import type { ContractMessageSender } from "../state/marketplaceTypes";

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
    addAgentReview,
    addContractDeliverable,
    addContractMilestone,
    agentReviews,
    contractDisputes,
    getContractWorkspace,
    localContracts,
    openContractDispute,
    sendContractMessage,
    setDeliverableStatus,
    toggleMilestoneComplete,
    updateContractDispute,
    updateMilestoneNotes,
  } = useAgentExchange();
  const [deliverableNotes, setDeliverableNotes] = useState("");
  const [deliverableTitle, setDeliverableTitle] = useState("");
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [disputeReason, setDisputeReason] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messageSender, setMessageSender] =
    useState<ContractMessageSender>("Organization");
  const [milestoneNotes, setMilestoneNotes] = useState("");
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");

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

  const activeContract = contract;

  function handleAddMilestone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!milestoneTitle.trim()) {
      return;
    }

    addContractMilestone(
      activeContract.id,
      milestoneTitle.trim(),
      milestoneNotes.trim(),
    );
    setMilestoneNotes("");
    setMilestoneTitle("");
  }

  function handleAddDeliverable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!deliverableTitle.trim()) {
      return;
    }

    addContractDeliverable(
      activeContract.id,
      deliverableTitle.trim(),
      deliverableNotes.trim(),
    );
    setDeliverableNotes("");
    setDeliverableTitle("");
  }

  function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!messageBody.trim()) {
      return;
    }

    sendContractMessage(
      activeContract.id,
      messageSender,
      messageSender === "Organization"
        ? activeContract.organization
        : activeContract.agent,
      messageBody.trim(),
    );
    setMessageBody("");
  }

  function handleOpenDispute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!disputeReason.trim()) {
      return;
    }

    openContractDispute(activeContract.id, disputeReason.trim());
    setDisputeReason("");
  }

  function handleAddReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!reviewText.trim()) {
      return;
    }

    addAgentReview(
      activeContract.id,
      activeContract.agent,
      activeContract.title,
      activeContract.organization,
      reviewRating,
      reviewText.trim(),
    );
    setReviewRating(5);
    setReviewText("");
  }

  const activeDisputes = contractDisputes.filter(
    (dispute) => dispute.contractId === activeContract.id,
  );
  const hasReview = agentReviews.some(
    (review) => review.contractId === activeContract.id,
  );

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
              Overview
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
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-ae-text-muted">
                    {deliverable.notes || "No notes added."}
                  </p>
                  {deliverable.status !== "approved" ? (
                    <div className="space-y-3 border-t border-white/[0.06] pt-3">
                      <textarea
                        className="min-h-20 w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-sm text-ae-text outline-none placeholder:text-ae-text-muted/60 focus:border-ae-primary/60 focus:shadow-ae-glow"
                        onChange={(event) =>
                          setDecisionNotes((current) => ({
                            ...current,
                            [deliverable.id]: event.target.value,
                          }))
                        }
                        placeholder="Approval or rejection note"
                        value={decisionNotes[deliverable.id] ?? ""}
                      />
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <PrimaryButton
                          onClick={() => {
                            setDeliverableStatus(
                              contract.id,
                              deliverable.id,
                              "approved",
                              decisionNotes[deliverable.id]?.trim() ?? "",
                            );
                            setDecisionNotes((current) => ({
                              ...current,
                              [deliverable.id]: "",
                            }));
                          }}
                        >
                          Approve
                        </PrimaryButton>
                        <SecondaryButton
                          onClick={() => {
                            setDeliverableStatus(
                              contract.id,
                              deliverable.id,
                              "rejected",
                              decisionNotes[deliverable.id]?.trim() ?? "",
                            );
                            setDecisionNotes((current) => ({
                              ...current,
                              [deliverable.id]: "",
                            }));
                          }}
                        >
                          Reject
                        </SecondaryButton>
                      </div>
                    </div>
                  ) : null}
                  {(deliverable.decisions ?? []).length > 0 ? (
                    <div className="space-y-2 border-t border-white/[0.06] pt-3">
                      <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
                        Decision History
                      </p>
                      {(deliverable.decisions ?? []).map((decision) => (
                        <div
                          className="rounded-ae-md border border-white/[0.06] bg-ae-background-deep/70 p-3 text-sm text-ae-text-muted"
                          key={decision.id}
                        >
                          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-primary">
                            {decision.status} -{" "}
                            {formatActivityDate(decision.decidedAt)}
                          </p>
                          <p className="mt-2">
                            {decision.note || "No note provided."}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
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
            Messages
          </p>
          <h2 className="mt-2 font-ae-display text-3xl font-semibold text-ae-text">
            Organization and agent communication
          </h2>
        </div>
        <form className="space-y-3" onSubmit={handleSendMessage}>
          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <select
              className="rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
              onChange={(event) =>
                setMessageSender(event.target.value as ContractMessageSender)
              }
              value={messageSender}
            >
              <option>Organization</option>
              <option>Agent</option>
            </select>
            <input
              className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
              onChange={(event) => setMessageBody(event.target.value)}
              placeholder="Write a contract update..."
              value={messageBody}
            />
          </div>
          <PrimaryButton disabled={!messageBody.trim()} type="submit">
            Send Message
          </PrimaryButton>
        </form>
        <div className="space-y-3">
          {workspace.messages.length > 0 ? (
            workspace.messages.map((message) => (
              <article
                className="rounded-ae-lg border border-white/[0.06] bg-white/[0.04] p-4"
                key={message.id}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-ae-display text-lg font-semibold text-ae-text">
                      {message.author}
                    </span>
                    <span className="rounded-full border border-ae-primary/20 bg-ae-primary/10 px-3 py-1 font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-primary">
                      {message.senderType}
                    </span>
                  </div>
                  <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-text-muted">
                    {formatActivityDate(message.createdAt)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-ae-text-muted">
                  {message.body}
                </p>
              </article>
            ))
          ) : (
            <p className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-4 text-ae-text-muted">
              No messages yet. Send the first organization or agent update.
            </p>
          )}
        </div>
      </GlassCard>

      <GlassCard className="space-y-5">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            Trust & Disputes
          </p>
          <h2 className="mt-2 font-ae-display text-3xl font-semibold text-ae-text">
            Review and resolution workflow
          </h2>
        </div>

        {contract.status === "Completed" && !hasReview ? (
          <form className="space-y-3" onSubmit={handleAddReview}>
            <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
              <select
                className="rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
                onChange={(event) => setReviewRating(Number(event.target.value))}
                value={reviewRating}
              >
                {[5, 4, 3, 2, 1].map((rating) => (
                  <option key={rating} value={rating}>
                    {rating} / 5
                  </option>
                ))}
              </select>
              <input
                className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
                onChange={(event) => setReviewText(event.target.value)}
                placeholder="Leave an organization review for this agent..."
                value={reviewText}
              />
            </div>
            <PrimaryButton disabled={!reviewText.trim()} type="submit">
              Save Review
            </PrimaryButton>
          </form>
        ) : contract.status === "Completed" ? (
          <p className="rounded-ae-md border border-ae-emerald/20 bg-ae-emerald/10 p-4 text-ae-emerald">
            Review submitted for this completed contract.
          </p>
        ) : (
          <p className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-4 text-ae-text-muted">
            Reviews unlock when this contract is completed.
          </p>
        )}

        <form className="space-y-3 border-t border-white/[0.06] pt-4" onSubmit={handleOpenDispute}>
          <textarea
            className="min-h-20 w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none placeholder:text-ae-text-muted/60 focus:border-ae-primary/60 focus:shadow-ae-glow"
            onChange={(event) => setDisputeReason(event.target.value)}
            placeholder="Open a dispute with a short reason..."
            value={disputeReason}
          />
          <SecondaryButton disabled={!disputeReason.trim()} type="submit">
            Open Dispute
          </SecondaryButton>
        </form>

        <div className="space-y-3">
          {activeDisputes.length > 0 ? (
            activeDisputes.map((dispute) => (
              <article
                className="space-y-3 rounded-ae-lg border border-white/[0.06] bg-white/[0.04] p-4"
                key={dispute.id}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-ae-display text-xl font-semibold text-ae-text">
                      {dispute.status}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-ae-text-muted">
                      {dispute.reason}
                    </p>
                    {dispute.resolutionNotes ? (
                      <p className="mt-2 text-sm text-ae-primary">
                        Resolution: {dispute.resolutionNotes}
                      </p>
                    ) : null}
                  </div>
                  <span className="rounded-full border border-ae-amber/20 bg-ae-amber/10 px-3 py-1 font-ae-label text-xs font-semibold text-ae-amber">
                    Dispute
                  </span>
                </div>
                {dispute.status !== "Resolved" ? (
                  <div className="space-y-3">
                    <input
                      className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none focus:border-ae-primary/60 focus:shadow-ae-glow"
                      onChange={(event) =>
                        setResolutionNotes((current) => ({
                          ...current,
                          [dispute.id]: event.target.value,
                        }))
                      }
                      placeholder="Resolution notes"
                      value={resolutionNotes[dispute.id] ?? ""}
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <SecondaryButton
                        onClick={() =>
                          updateContractDispute(
                            activeContract.id,
                            dispute.id,
                            "Under Review",
                            resolutionNotes[dispute.id],
                          )
                        }
                      >
                        Mark Under Review
                      </SecondaryButton>
                      <PrimaryButton
                        onClick={() =>
                          updateContractDispute(
                            activeContract.id,
                            dispute.id,
                            "Resolved",
                            resolutionNotes[dispute.id],
                          )
                        }
                      >
                        Resolve
                      </PrimaryButton>
                    </div>
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <p className="text-sm text-ae-text-muted">
              No disputes opened for this contract.
            </p>
          )}
        </div>
      </GlassCard>

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
