import type { Contract, ContractStatus } from "./operations";
import type {
  ContractDeliverable,
  ContractMilestone,
  ContractWorkspace,
} from "../state/marketplaceTypes";
import { isSupabaseConfigured } from "../lib/supabase";

export function deriveContractProgress(workspace: ContractWorkspace) {
  const totalItems = workspace.milestones.length + workspace.deliverables.length;

  if (totalItems === 0) {
    return 0;
  }

  const completedMilestones = workspace.milestones.filter(
    (milestone) => milestone.completed,
  ).length;
  const deliverableProgress = workspace.deliverables.reduce((total, deliverable) => {
    if (deliverable.status === "approved") {
      return total + 1;
    }

    if (deliverable.status === "submitted") {
      return total + 0.5;
    }

    return total;
  }, 0);

  return Math.round(((completedMilestones + deliverableProgress) / totalItems) * 100);
}

export function deriveWorkspaceStatus(workspace: ContractWorkspace): ContractStatus {
  const workspaceProgress = deriveContractProgress(workspace);
  const hasWorkspaceItems =
    workspace.milestones.length > 0 || workspace.deliverables.length > 0;

  if (!hasWorkspaceItems) {
    return "Active";
  }

  const hasSubmittedDeliverables = workspace.deliverables.some(
    (deliverable) => deliverable.status === "submitted",
  );

  if (workspaceProgress >= 100) {
    return "Completed";
  }

  if (hasSubmittedDeliverables || workspaceProgress >= 80) {
    return "In Review";
  }

  return "Active";
}

/**
 * In shared mode the contract row is the truth: status and progress are
 * written to it at every decision (see syncContractRow) and read back as
 * stored, so the screen, the database and the worker agree. Demo mode has no
 * row and derives them from the workspace on the fly.
 */
export function applyWorkspaceToContract(
  contract: Contract,
  workspace: ContractWorkspace,
  { sharedMode = isSupabaseConfigured }: { sharedMode?: boolean } = {},
): Contract {
  if (sharedMode) {
    return contract;
  }

  const workspaceProgress = deriveContractProgress(workspace);
  const hasWorkspaceItems =
    workspace.milestones.length > 0 || workspace.deliverables.length > 0;

  if (!hasWorkspaceItems) {
    return contract;
  }

  return {
    ...contract,
    progress: workspaceProgress,
    status: deriveWorkspaceStatus(workspace),
  };
}

/** The derived (status, progress) pair a decision should persist. */
export function deriveContractRow(workspace: ContractWorkspace): {
  progress: number;
  status: ContractStatus;
} {
  return {
    progress: deriveContractProgress(workspace),
    status: deriveWorkspaceStatus(workspace),
  };
}

type DecisionStatus = "submitted" | "approved" | "rejected";

/** The workspace after an organization's decision on one deliverable. */
export function withDeliverableDecision(
  workspace: ContractWorkspace,
  deliverableId: string,
  status: DecisionStatus,
): ContractWorkspace {
  const nextStatus: ContractDeliverable["status"] = status === "rejected" ? "draft" : status;
  return {
    ...workspace,
    deliverables: workspace.deliverables.map((deliverable) =>
      deliverable.id === deliverableId ? { ...deliverable, status: nextStatus } : deliverable,
    ),
  };
}

/** The workspace after a milestone is toggled. */
export function withMilestoneToggled(
  workspace: ContractWorkspace,
  milestoneId: string,
): ContractWorkspace {
  return {
    ...workspace,
    milestones: workspace.milestones.map((milestone: ContractMilestone) =>
      milestone.id === milestoneId ? { ...milestone, completed: !milestone.completed } : milestone,
    ),
  };
}
