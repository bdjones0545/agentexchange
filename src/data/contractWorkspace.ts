import type { Contract } from "./operations";
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

  const hasSubmittedDeliverables = workspace.deliverables.some(
    (deliverable) => deliverable.status === "submitted",
  );

  return {
    ...contract,
    progress: workspaceProgress,
    status:
      workspaceProgress >= 100
        ? "Completed"
        : hasSubmittedDeliverables || workspaceProgress >= 80
          ? "In Review"
          : "Active",
  };
}
