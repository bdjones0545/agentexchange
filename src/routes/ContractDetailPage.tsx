import { contractPriceLabel } from "../lib/money";
import { useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { initialsFor } from "../lib/initials";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { ContractStatusBadge } from "../components/ContractStatusBadge";
import { GlassCard } from "../components/GlassCard";
import { PageHeader } from "../components/PageHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { Markdown } from "../components/Markdown";
import { WorkerBadge } from "../components/WorkerBadge";
import { FundingPanel, PaymentStatusBadge } from "../components/FundingPanel";
import { ManagedServicePanel } from "../components/ManagedServicePanel";
import { JobGuideCard } from "../components/JobGuideCard";
import { applyWorkspaceToContract } from "../data/contractWorkspace";
import type { ContractStatus } from "../data/operations";
import { useAgentExchange } from "../state/AgentExchangeContext";
import type {
  ContractDeliverable,
  ContractDeliverableStatus,
  ContractPaymentStatus,
} from "../state/marketplaceTypes";
import type { ContractMessageSender, LocalContract } from "../state/marketplaceTypes";

function formatActivityDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
}

/** One line the organization can read: did the worker's submission clear the quality gate, and what was flagged. */
function gateLabel(gate: NonNullable<ContractDeliverable["gate"]>): string {
  const q = gate.answers ? ` · quality ${gate.answers.quality.toFixed(1)}/3` : "";
  switch (gate.verdict) {
    case "passed":
      return `Quality gate: passed${q}${gate.flags.length ? ` · note: ${gate.flags.join("; ")}` : ""}`;
    case "accepted_with_flags":
      return `Quality gate: accepted after ${gate.attempt - 1} returns — review carefully. ${gate.flags.join("; ")}`;
    case "unavailable":
      return "Quality gate: not evaluated (gate unavailable at submission)";
    default:
      return `Quality gate: ${gate.verdict}`;
  }
}

type LifecycleStep = { label: string; state: "done" | "current" | "upcoming"; warn?: boolean };

/**
 * The contract's lifecycle as a step track, read only from stored state: the
 * contract status and, for rows that carry one, the payment status. Payment
 * steps appear only when the contract has a payment status at all.
 */
function lifecycleSteps(status: ContractStatus, paymentStatus?: ContractPaymentStatus): LifecycleStep[] {
  const raw: Array<{ label: string; done: boolean; warn?: boolean }> = [{ label: "Agreed", done: true }];

  if (paymentStatus) {
    raw.push(
      paymentStatus === "refunded"
        ? { label: "Refunded", done: false, warn: true }
        : { label: "Funded", done: paymentStatus !== "unfunded" },
    );
  }

  raw.push({ label: "In progress", done: status !== "Active" });
  raw.push({ label: "Review", done: status === "Completed" });
  raw.push({ label: "Completed", done: status === "Completed" });

  if (paymentStatus) {
    raw.push({ label: "Released", done: paymentStatus === "captured" || paymentStatus === "paid_out" });
  }

  const firstOpen = raw.findIndex((step) => !step.done);

  return raw.map((step, index) => ({
    label: step.label,
    state: step.done ? "done" : index === firstOpen ? "current" : "upcoming",
    warn: step.warn,
  }));
}

const DELIVERABLE_TONE: Record<ContractDeliverableStatus, string> = {
  approved: "border-ae-emerald/25 bg-ae-emerald/10 text-ae-emerald",
  draft: "border-white/[0.1] bg-white/[0.04] text-ae-text-muted",
  submitted: "border-ae-amber/25 bg-ae-amber/10 text-ae-amber",
};

const chipBase =
  "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 font-ae-label text-xs font-semibold";

const initials = (name: string) => initialsFor(name);

function CheckIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg aria-hidden className={`shrink-0 ${className}`} viewBox="0 0 16 16">
      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function SectionHeader({
  action,
  eyebrow,
  meta,
  title,
}: {
  action?: ReactNode;
  eyebrow: string;
  meta?: ReactNode;
  title: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
          {eyebrow}
        </p>
        <h2 className="mt-1.5 flex flex-wrap items-center gap-2.5 font-ae-display text-xl font-semibold tracking-tight text-ae-text sm:text-2xl">
          {title}
          {meta !== undefined ? (
            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 font-ae-label text-xs font-semibold tabular-nums text-ae-text-muted">
              {meta}
            </span>
          ) : null}
        </h2>
      </div>
      {action}
    </div>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-white/[0.1] px-4 py-5 text-center text-sm leading-6 text-ae-text-muted">
      {children}
    </p>
  );
}

export function ContractDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const {
    addAgentReview,
    addContractDeliverable,
    addContractMilestone,
    agentReviews,
    canDecideContract,
    canResolveDispute,
    contractDisputes,
    getContractWorkspace,
    localContracts,
    openContractDispute,
    sendContractMessage,
    setDeliverableStatus,
    toggleMilestoneComplete,
    updateContractDispute,
    updateMilestoneNotes,
    loading,
    createdAgents,
    isSharedMode,
    isWorkerAgent,
    ownsAgent,
    refresh,
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
  // Creation forms stay folded until asked for: on a phone an organization
  // reviewing work should reach the deliverable and the thread first.
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [showDeliverableForm, setShowDeliverableForm] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");

  const baseContract = localContracts.find(
    (contract) => contract.id === id,
  );
  const workspace = getContractWorkspace(id ?? "");
  const contract = useMemo(
    () =>
      baseContract ? applyWorkspaceToContract(baseContract, workspace) : undefined,
    [baseContract, workspace],
  );

  // A cold load of a deep link lands here before the shared state has been
  // read; redirecting then would bounce every shared link back to the list.
  if (id && !contract && loading) {
    return (
      <p className="w-fit rounded-xl border border-white/[0.08] bg-ae-surface/70 px-4 py-3 font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-text-muted motion-safe:animate-pulse">
        Loading
      </p>
    );
  }

  if (!id || !contract) {
    return <Navigate replace to="/contracts" />;
  }

  const activeContract = contract;
  // Seed contracts have no agentId; match created agents by id, then by name.
  const contractAgentId = "agentId" in activeContract ? (activeContract as { agentId?: string }).agentId : undefined;
  const contractAgent = createdAgents.find(
    (agent) => agent.id === contractAgentId || agent.name === activeContract.agent,
  );
  const workerBacked = contractAgent ? isWorkerAgent(contractAgent) : false;

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
    setShowMilestoneForm(false);
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
    setShowDeliverableForm(false);
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
  const isOrganizationSide = canDecideContract(activeContract);
  // The database lets only an organization owner who does not also own the
  // agent decide work, so a viewer on both sides is not offered the decision.
  const ownsBothSides = isSharedMode && isOrganizationSide && ownsAgent(contractAgentId);
  const canDecideWork = isOrganizationSide && !ownsBothSides;

  // Display-only reads of stored state.
  const paymentStatus = (activeContract as { paymentStatus?: ContractPaymentStatus }).paymentStatus;
  const agreedAmountCents = (activeContract as { amountCents?: number }).amountCents;
  const steps = lifecycleSteps(contract.status, paymentStatus);
  const currentStepIndex = steps.findIndex((step) => step.state === "current");
  const openDisputeCount = activeDisputes.filter((dispute) => dispute.status !== "Resolved").length;
  const completedMilestones = workspace.milestones.filter((milestone) => milestone.completed).length;
  const approvedDeliverables = workspace.deliverables.filter((deliverable) => deliverable.status === "approved").length;
  const awaitingDecision = workspace.deliverables.filter((deliverable) => deliverable.status === "submitted").length;
  const progressWidth = Math.max(0, Math.min(100, contract.progress));
  const showFunding = isSharedMode && "amountCents" in activeContract;
  // Mirrors the lock_delivery_contract trigger: the database refuses deliverable
  // changes while a dispute is unresolved or a priced contract is unfunded.
  const deliveryLock = !isSharedMode
    ? null
    : openDisputeCount > 0 || ["Paused", "Disputed", "Cancelled"].includes(String(contract.status))
      ? "Deliverables can't change while a dispute or hold is open on this contract."
      : (agreedAmountCents ?? 0) > 0 && !["authorized", "captured", "paid_out"].includes(String(paymentStatus ?? "unfunded"))
        ? "Work starts once the contract is funded. Deliverables can be added and reviewed after the card hold is placed."
        : null;

  return (
    <section className="space-y-8">
      <button
        className="inline-flex items-center gap-2 font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted transition hover:text-ae-primary"
        onClick={() => navigate("/contracts")}
        type="button"
      >
        <svg aria-hidden className="size-3.5" viewBox="0 0 16 16">
          <path d="M13 8H3M7 4L3 8l4 4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
        </svg>
        Back to contracts
      </button>

      <PageHeader
        actions={
          <div className="w-full rounded-2xl border border-white/[0.08] bg-ae-surface/80 px-5 py-4 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04),0_24px_48px_-28px_rgb(0_0_0_/_0.7)] backdrop-blur-xl sm:w-auto sm:min-w-[15rem]">
            <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.14em] text-ae-text-muted">
              Agreed price
            </p>
            <p className="mt-1 break-words font-ae-display text-3xl font-semibold tabular-nums tracking-[-0.03em] text-ae-text">
              {contractPriceLabel(contract)}
            </p>
            {paymentStatus && paymentStatus !== "unfunded" ? (
              <div className="mt-2.5">
                <PaymentStatusBadge status={paymentStatus} />
              </div>
            ) : agreedAmountCents ? (
              <p className="mt-1 text-xs text-ae-text-muted">Fixed when the contract was created</p>
            ) : null}
          </div>
        }
        description="Milestones, deliverables and the thread for this contract."
        eyebrow="Contract workspace"
        title={<span className="break-words">{contract.title}</span>}
      >
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <ContractStatusBadge status={contract.status} />
          {openDisputeCount > 0 ? (
            <span className={`${chipBase} border-ae-amber/25 bg-ae-amber/10 text-ae-amber`}>
              <span aria-hidden className="size-1.5 rounded-full bg-current" />
              {openDisputeCount === 1 ? "1 open dispute" : `${openDisputeCount} open disputes`}
            </span>
          ) : null}
          {canDecideWork && awaitingDecision > 0 ? (
            <span className={`${chipBase} border-ae-cyan/25 bg-ae-cyan/10 text-ae-cyan`}>
              <span aria-hidden className="size-1.5 rounded-full bg-current" />
              {awaitingDecision === 1 ? "1 deliverable awaits your decision" : `${awaitingDecision} deliverables await your decision`}
            </span>
          ) : null}
        </div>
      </PageHeader>

      <GlassCard className="sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-text-muted">
            Lifecycle
          </p>
          <p aria-hidden className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.12em] text-ae-primary sm:hidden">
            {currentStepIndex >= 0
              ? `Step ${currentStepIndex + 1} of ${steps.length} · ${steps[currentStepIndex].label}`
              : "Every step complete"}
          </p>
        </div>
        <ol
          aria-label="Contract lifecycle"
          className="mt-4 grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
        >
          {steps.map((step) => (
            <li aria-current={step.state === "current" ? "step" : undefined} className="min-w-0" key={step.label}>
              <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-white/10">
                {step.state === "done" ? <span className="block h-full w-full rounded-full bg-ae-primary/80" /> : null}
                {step.state === "current" ? (
                  <span
                    className={`ax-fill block h-full w-1/2 rounded-full ${step.warn ? "bg-ae-amber" : "bg-ae-primary"}`}
                    style={{ "--ax-duration": "1.2s" } as CSSProperties}
                  />
                ) : null}
              </span>
              <span
                className={[
                  "mt-2 flex min-w-0 items-center gap-1 font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em]",
                  step.state === "done" ? "text-ae-text" : step.state === "current" ? (step.warn ? "text-ae-amber" : "text-ae-primary") : "text-ae-text-muted/70",
                ].join(" ")}
              >
                {step.state === "done" ? <CheckIcon className="hidden size-3 text-ae-primary sm:block" /> : null}
                <span aria-hidden className="hidden min-w-0 truncate sm:block">{step.label}</span>
                <span className="sr-only">
                  {step.label}
                  {step.state === "done" ? " (done)" : ""}
                </span>
              </span>
            </li>
          ))}
        </ol>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-white/[0.06] pt-5 lg:grid-cols-4">
          {[
            ["Organization", contract.organization],
            ["Assigned Agent", contract.agent],
            ["Start Date", contract.startDate || "—"],
            ["Due Date", contract.dueDate || "—"],
          ].map(([label, value]) => (
            <div className="flex min-w-0 items-start gap-3" key={label}>
              {label === "Organization" || label === "Assigned Agent" ? (
                <span
                  aria-hidden
                  className={`hidden size-9 shrink-0 place-items-center rounded-xl border font-ae-label text-xs font-bold sm:grid ${label === "Organization" ? "border-ae-primary/20 bg-ae-primary/10 text-ae-primary" : "border-ae-cyan/20 bg-ae-cyan/10 text-ae-cyan"}`}
                >
                  {initials(value)}
                </span>
              ) : null}
              <div className="min-w-0">
                <dt className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
                  {label}
                </dt>
                <dd className="mt-1 break-words font-semibold text-ae-text">{value}</dd>
              </div>
            </div>
          ))}
        </dl>

        <div className="mt-6 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
              Progress
            </p>
            <p className="font-ae-label text-sm font-semibold tabular-nums text-ae-primary">
              {contract.progress}%
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-ae-primary to-ae-cyan transition-[width] duration-500"
              style={{ width: `${progressWidth}%` }}
            />
          </div>
          <p className="text-xs leading-5 text-ae-text-muted">
            {completedMilestones} of {workspace.milestones.length} milestones complete · {approvedDeliverables} of {workspace.deliverables.length} deliverables approved
          </p>
        </div>
      </GlassCard>

      {workerBacked ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200">
              Worked by a Hermes worker
            </p>
            <p className="mt-1 text-sm leading-6 text-ae-text-muted">
              {contract.agent} does this work itself. Expect an acknowledgment and a
              deliverable within minutes of hiring; reply in the thread to steer it, and
              approve or reject deliverables here.
            </p>
          </div>
          <WorkerBadge />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)] lg:grid-rows-[auto_1fr] lg:gap-x-6 lg:gap-y-0">
        {showFunding ? (
          <div className="min-w-0 empty:hidden lg:col-start-2 lg:row-start-1 lg:mb-6">
            <FundingPanel
              allDeliverablesApproved={workspace.deliverables.length > 0 && workspace.deliverables.every((deliverable) => deliverable.status === "approved")}
              contract={activeContract as LocalContract}
              isOrganizationSide={isOrganizationSide}
              openDisputes={activeDisputes.filter((dispute) => dispute.status !== "Resolved").length}
              onChanged={() => void refresh()}
            />
          </div>
        ) : null}

        <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          {(activeContract as LocalContract).serviceTerms ? (
            <ManagedServicePanel contract={activeContract as LocalContract} isOrganizationSide={isOrganizationSide} />
          ) : (activeContract as LocalContract).jobKind ? (
            <JobGuideCard jobKindId={(activeContract as LocalContract).jobKind!} isOrganizationSide={isOrganizationSide} />
          ) : null}
          <GlassCard className="space-y-5 sm:p-6">
            <SectionHeader
              action={
                showDeliverableForm ? null : (
                  <SecondaryButton disabled={Boolean(deliveryLock)} onClick={() => setShowDeliverableForm(true)}>
                    Add a deliverable
                  </SecondaryButton>
                )
              }
              eyebrow="Deliverables"
              meta={workspace.deliverables.length}
              title="Review queue"
            />
            {deliveryLock ? (
              <p role="note" className="flex items-start gap-2.5 rounded-xl border border-ae-amber/25 bg-ae-amber/[0.07] px-4 py-3 text-sm leading-6 text-ae-amber">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-ae-amber" />
                {deliveryLock}
              </p>
            ) : null}

            {showDeliverableForm ? (
              <form className="space-y-3 rounded-2xl border border-white/[0.08] bg-ae-background-deep/50 p-4" onSubmit={handleAddDeliverable}>
                <input
                  aria-label="Deliverable title"
                  className="ax-input"
                  onChange={(event) => setDeliverableTitle(event.target.value)}
                  placeholder="Deliverable title"
                  value={deliverableTitle}
                />
                <textarea
                  aria-label="Deliverable notes"
                  className="ax-input min-h-24"
                  onChange={(event) => setDeliverableNotes(event.target.value)}
                  placeholder="Deliverable notes"
                  value={deliverableNotes}
                />
                <div className="flex flex-wrap gap-3">
                  <PrimaryButton disabled={!deliverableTitle.trim()} type="submit">
                    Add Deliverable
                  </PrimaryButton>
                  <SecondaryButton onClick={() => setShowDeliverableForm(false)}>
                    Cancel
                  </SecondaryButton>
                </div>
              </form>
            ) : null}

            <div className="space-y-4">
              {workspace.deliverables.length > 0 ? (
                workspace.deliverables.map((deliverable) => (
                  <article
                    className="overflow-hidden rounded-2xl border border-white/[0.08] bg-ae-background-deep/50"
                    key={deliverable.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3.5 sm:px-5">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span aria-hidden className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-ae-text-muted">
                          <svg className="size-4" viewBox="0 0 24 24">
                            <path d="M7 3.5h7l4 4v13H7zM14 3.5v4h4M10 12h5M10 16h5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
                          </svg>
                        </span>
                        <div className="min-w-0">
                          <h3 className="break-words font-ae-display text-base font-semibold leading-snug text-ae-text sm:text-lg">
                            {deliverable.title}
                          </h3>
                          {deliverable.gate ? (
                            <p
                              className={`mt-1 text-xs leading-5 ${deliverable.gate.verdict === "accepted_with_flags" ? "text-ae-amber" : "text-ae-text-muted"}`}
                              data-testid="deliverable-gate"
                            >
                              {gateLabel(deliverable.gate)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <span className={`${chipBase} capitalize ${DELIVERABLE_TONE[deliverable.status] ?? DELIVERABLE_TONE.draft}`}>
                        {deliverable.status === "approved" ? <CheckIcon className="size-3" /> : <span aria-hidden className="size-1.5 rounded-full bg-current" />}
                        {deliverable.status}
                      </span>
                    </div>

                    <div className="px-4 py-4 sm:px-5 sm:py-5">
                      {deliverable.notes ? (
                        <Markdown collapseAfter={1200} source={deliverable.notes} />
                      ) : (
                        <p className="text-sm leading-6 text-ae-text-muted">No notes added.</p>
                      )}
                    </div>

                    {deliverable.status === "draft" || (deliverable.status !== "approved" && !isOrganizationSide) ? (
                      <div className="flex flex-col gap-3 border-t border-white/[0.06] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                        {/* The outer condition already excludes approved deliverables. */}
                        {!isOrganizationSide ? (
                          <p className="text-xs leading-5 text-ae-text-muted">
                            {deliverable.status === "submitted"
                              ? "Awaiting the organization's decision."
                              : "Submit this deliverable for the organization to review."}
                          </p>
                        ) : (
                          <span />
                        )}
                        {deliverable.status === "draft" ? (
                          <SecondaryButton
                            className="shrink-0"
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
                    ) : null}

                    {deliverable.status !== "approved" && ownsBothSides ? (
                      <p className="border-t border-white/[0.06] bg-white/[0.02] px-4 py-3.5 text-xs leading-5 text-ae-text-muted sm:px-5" role="note">
                        You own both the organization and the agent on this contract, so you can't approve or reject its work. An independent organization has to decide.
                      </p>
                    ) : null}

                    {deliverable.status !== "approved" && canDecideWork ? (
                      <div className="space-y-3 border-t border-white/[0.06] bg-white/[0.02] px-4 py-4 sm:px-5">
                        <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
                          Your decision
                        </p>
                        <textarea
                          aria-label="Approval or rejection note"
                          className="ax-input min-h-20 text-sm"
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
                            disabled={Boolean(deliveryLock)}
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
                            <CheckIcon className="size-4" />
                            Approve
                          </PrimaryButton>
                          <SecondaryButton
                            disabled={Boolean(deliveryLock)}
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
                      <div className="space-y-2.5 border-t border-white/[0.06] px-4 py-4 sm:px-5">
                        <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
                          Decision History
                        </p>
                        <ol className="space-y-2">
                          {(deliverable.decisions ?? []).map((decision) => (
                            <li
                              className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-sm text-ae-text-muted"
                              key={decision.id}
                            >
                              <p className={`font-ae-label text-xs font-semibold uppercase tracking-[0.08em] ${decision.status === "approved" ? "text-ae-emerald" : "text-ae-amber"}`}>
                                {decision.status} -{" "}
                                {formatActivityDate(decision.decidedAt)}
                              </p>
                              <p className="mt-1.5 break-words leading-6">
                                {decision.note || "No note provided."}
                              </p>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <EmptyNote>No deliverables yet. Add a deliverable above to begin review.</EmptyNote>
              )}
            </div>
          </GlassCard>

          <GlassCard className="space-y-5 sm:p-6">
            <SectionHeader
              eyebrow="Messages"
              meta={workspace.messages.length}
              title="Organization and agent communication"
            />
            {workspace.messages.length > 0 ? (
              <ol className="space-y-4">
                {workspace.messages.map((message) => (
                  <li className="flex gap-3" key={message.id}>
                    <span
                      aria-hidden
                      className={`mt-1 grid size-9 shrink-0 place-items-center rounded-xl border font-ae-label text-xs font-bold ${message.senderType === "Organization" ? "border-ae-primary/20 bg-ae-primary/10 text-ae-primary" : "border-ae-cyan/20 bg-ae-cyan/10 text-ae-cyan"}`}
                    >
                      {initials(message.author) || "?"}
                    </span>
                    <article className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span className="min-w-0 break-words font-semibold text-ae-text">
                          {message.author}
                        </span>
                        <span className={`inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 font-ae-label text-[11px] font-semibold ${message.senderType === "Organization" ? "border-ae-primary/20 bg-ae-primary/10 text-ae-primary" : "border-ae-cyan/20 bg-ae-cyan/10 text-ae-cyan"}`}>
                          {message.senderType}
                        </span>
                        <span className="font-ae-label text-xs text-ae-text-muted sm:ml-auto">
                          {formatActivityDate(message.createdAt)}
                        </span>
                      </div>
                      <Markdown className="mt-2" source={message.body} />
                    </article>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyNote>No messages yet. Send the first organization or agent update.</EmptyNote>
            )}
            <form className="space-y-3 rounded-2xl border border-white/[0.08] bg-ae-background-deep/50 p-3 sm:p-4" onSubmit={handleSendMessage}>
              <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
                <select
                  aria-label="Send as"
                  className="ax-input"
                  onChange={(event) =>
                    setMessageSender(event.target.value as ContractMessageSender)
                  }
                  value={messageSender}
                >
                  <option>Organization</option>
                  <option>Agent</option>
                </select>
                <input
                  aria-label="Message"
                  className="ax-input"
                  onChange={(event) => setMessageBody(event.target.value)}
                  placeholder="Write a contract update..."
                  value={messageBody}
                />
              </div>
              <div className="flex justify-end">
                <PrimaryButton className="w-full sm:w-auto" disabled={!messageBody.trim()} type="submit">
                  Send Message
                </PrimaryButton>
              </div>
            </form>
          </GlassCard>

          <GlassCard className="space-y-5 sm:p-6">
            <SectionHeader
              action={
                showMilestoneForm ? null : (
                  <SecondaryButton onClick={() => setShowMilestoneForm(true)}>
                    Add a milestone
                  </SecondaryButton>
                )
              }
              eyebrow="Milestones"
              meta={`${completedMilestones}/${workspace.milestones.length}`}
              title="Execution plan"
            />

            {showMilestoneForm ? (
              <form className="space-y-3 rounded-2xl border border-white/[0.08] bg-ae-background-deep/50 p-4" onSubmit={handleAddMilestone}>
                <input
                  aria-label="Milestone title"
                  className="ax-input"
                  onChange={(event) => setMilestoneTitle(event.target.value)}
                  placeholder="Milestone title"
                  value={milestoneTitle}
                />
                <textarea
                  aria-label="Milestone notes"
                  className="ax-input min-h-20"
                  onChange={(event) => setMilestoneNotes(event.target.value)}
                  placeholder="Notes or acceptance criteria"
                  value={milestoneNotes}
                />
                <div className="flex flex-wrap gap-3">
                  <PrimaryButton disabled={!milestoneTitle.trim()} type="submit">
                    Add Milestone
                  </PrimaryButton>
                  <SecondaryButton onClick={() => setShowMilestoneForm(false)}>
                    Cancel
                  </SecondaryButton>
                </div>
              </form>
            ) : null}

            {workspace.milestones.length > 0 ? (
              <ol className="space-y-3">
                {workspace.milestones.map((milestone) => (
                  <li
                    className={`space-y-3 rounded-2xl border p-4 ${milestone.completed ? "border-ae-primary/15 bg-ae-primary/[0.03]" : "border-white/[0.08] bg-white/[0.03]"}`}
                    key={milestone.id}
                  >
                    <div className="flex flex-wrap items-start gap-3">
                      <span
                        aria-hidden
                        className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border ${milestone.completed ? "border-ae-primary bg-ae-primary text-ae-primary-ink" : "border-white/20 text-transparent"}`}
                      >
                        <CheckIcon />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className={`break-words font-semibold ${milestone.completed ? "text-ae-text-muted" : "text-ae-text"}`}>
                          {milestone.title}
                        </h3>
                        <p className="mt-0.5 font-ae-label text-[11px] font-semibold uppercase tracking-[0.1em] text-ae-text-muted">
                          {milestone.completed ? "Complete" : "Active"}
                        </p>
                      </div>
                      {isOrganizationSide || milestone.completed ? (
                        <SecondaryButton
                          className="w-full sm:w-auto"
                          onClick={() =>
                            toggleMilestoneComplete(contract.id, milestone.id)
                          }
                        >
                          {milestone.completed ? "Reopen" : "Mark Complete"}
                        </SecondaryButton>
                      ) : (
                        <p className="w-full text-xs text-ae-text-muted sm:w-auto sm:max-w-[14rem] sm:text-right">
                          The organization confirms completion.
                        </p>
                      )}
                    </div>
                    <textarea
                      aria-label={`Notes for ${milestone.title}`}
                      className="ax-input min-h-20 text-sm"
                      defaultValue={milestone.notes}
                      onBlur={(event) =>
                        updateMilestoneNotes(
                          contract.id,
                          milestone.id,
                          event.target.value,
                        )
                      }
                    />
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyNote>No milestones yet. Add the first execution milestone above.</EmptyNote>
            )}
          </GlassCard>
        </div>

        <div className="min-w-0 space-y-6 lg:col-start-2 lg:row-start-2">
          <GlassCard className="@container space-y-5 sm:p-6">
            <SectionHeader eyebrow="Trust & Disputes" title="Review and resolution" />

            {contract.status === "Completed" && !hasReview && !isOrganizationSide ? (
              <EmptyNote>The organization can leave a review for this completed contract.</EmptyNote>
            ) : null}
            {contract.status === "Completed" && !hasReview && isOrganizationSide ? (
              <form className="space-y-3" onSubmit={handleAddReview}>
                <div className="grid gap-3 @sm:grid-cols-[auto_minmax(0,1fr)]">
                  <select
                    aria-label="Rating"
                    className="ax-input"
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
                    aria-label="Review"
                    className="ax-input"
                    onChange={(event) => setReviewText(event.target.value)}
                    placeholder="Leave an organization review for this agent..."
                    value={reviewText}
                  />
                </div>
                <PrimaryButton className="w-full @sm:w-auto" disabled={!reviewText.trim()} type="submit">
                  Save Review
                </PrimaryButton>
              </form>
            ) : contract.status === "Completed" ? (
              <p className="flex items-center gap-2 rounded-xl border border-ae-emerald/20 bg-ae-emerald/10 px-4 py-3 text-sm text-ae-emerald">
                <CheckIcon className="size-4" />
                Review submitted for this completed contract.
              </p>
            ) : (
              <EmptyNote>Reviews unlock when this contract is completed.</EmptyNote>
            )}

            <form className="space-y-3 border-t border-white/[0.06] pt-5" onSubmit={handleOpenDispute}>
              <textarea
                aria-label="Dispute reason"
                className="ax-input min-h-20 text-sm"
                onChange={(event) => setDisputeReason(event.target.value)}
                placeholder="Open a dispute with a short reason..."
                value={disputeReason}
              />
              <SecondaryButton className="w-full @sm:w-auto" disabled={!disputeReason.trim()} type="submit">
                Open Dispute
              </SecondaryButton>
            </form>

            <div className="space-y-3">
              {activeDisputes.length > 0 ? (
                activeDisputes.map((dispute) => (
                  <article
                    className={`space-y-3 rounded-2xl border p-4 ${dispute.status === "Resolved" ? "border-white/[0.08] bg-white/[0.03]" : "border-ae-amber/20 bg-ae-amber/[0.04]"}`}
                    key={dispute.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-ae-display text-base font-semibold text-ae-text">
                          {dispute.status}
                        </p>
                        <p className="mt-1 break-words text-sm leading-6 text-ae-text-muted">
                          {dispute.reason}
                        </p>
                        {dispute.resolutionNotes ? (
                          <p className="mt-2 break-words text-sm text-ae-primary">
                            Resolution: {dispute.resolutionNotes}
                          </p>
                        ) : null}
                      </div>
                      <span className={`${chipBase} ${dispute.status === "Resolved" ? "border-ae-emerald/25 bg-ae-emerald/10 text-ae-emerald" : "border-ae-amber/25 bg-ae-amber/10 text-ae-amber"}`}>
                        Dispute
                      </span>
                    </div>
                    {dispute.status !== "Resolved" ? (
                      <div className="space-y-3">
                        <input
                          aria-label="Resolution notes"
                          className="ax-input"
                          onChange={(event) =>
                            setResolutionNotes((current) => ({
                              ...current,
                              [dispute.id]: event.target.value,
                            }))
                          }
                          placeholder="Resolution notes"
                          value={resolutionNotes[dispute.id] ?? ""}
                        />
                        <div className="flex flex-col gap-2 @sm:flex-row @sm:flex-wrap @sm:items-center">
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
                          {canResolveDispute(dispute) ? (
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
                          ) : (
                            <p className="text-xs text-ae-text-muted">
                              Only the party that opened this dispute can resolve it.
                            </p>
                          )}
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

          <GlassCard className="space-y-5 sm:p-6">
            <SectionHeader eyebrow="Activity Timeline" title="Workspace activity" />
            {workspace.activity.length > 0 ? (
              <ol className="space-y-4 border-l border-white/[0.08] pl-5">
                {workspace.activity.map((activity) => (
                  <li className="relative" key={activity.id}>
                    <span aria-hidden className="absolute -left-[25.5px] top-1 size-2.5 rounded-full border-2 border-ae-surface bg-ae-primary" />
                    <p className="font-ae-label text-[11px] font-semibold uppercase tracking-[0.08em] text-ae-primary">
                      {formatActivityDate(activity.createdAt)}
                    </p>
                    <p className="mt-1 break-words text-sm leading-6 text-ae-text-muted">{activity.message}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyNote>No workspace activity yet.</EmptyNote>
            )}
          </GlassCard>
        </div>
      </div>
    </section>
  );
}
