import type { Contract, ContractStatus } from "./operations";
import type { ContractWorkspace } from "../state/marketplaceTypes";

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

export function applyWorkspaceToContract(
  contract: Contract,
  workspace: ContractWorkspace,
): Contract {
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
