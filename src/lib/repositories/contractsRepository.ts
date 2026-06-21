import { supabase, isSupabaseConfigured, getSupabaseErrorMessage } from "../supabase";
import type { Contract } from "../../data/operations";
import type {
  ContractDeliverable,
  ContractMilestone,
  ContractMessage,
  ContractWorkspace,
  LocalContract,
} from "../../state/marketplaceTypes";
import { loadLocalState, saveLocalState } from "./localStateRepository";

export async function listContracts(): Promise<LocalContract[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("contracts").select("*");

    if (error) {
      throw new Error(`Unable to list contracts: ${getSupabaseErrorMessage(error)}`);
    }

    if (data) {
      return data.map((contract) => ({
        accent: "violet",
        agent: contract.agent_name,
        dueDate: contract.due_date ?? "",
        id: contract.id,
        agentId: contract.agent_id ?? undefined,
        organization: contract.organization_name,
        organizationId: contract.organization_id ?? "",
        progress: contract.progress ?? 0,
        sourceId: contract.source_id ?? "",
        sourceType: contract.source_type ?? "application",
        startDate: contract.start_date ?? "",
        status: contract.status,
        title: contract.title,
        value: contract.value ?? "Custom scope",
      }));
    }
  }

  return (await loadLocalState()).localContracts;
}

export async function createContract(
  contract: LocalContract | Contract,
): Promise<LocalContract> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("contracts").insert({
      agent_id: "agentId" in contract ? contract.agentId : undefined,
      agent_name: contract.agent,
      due_date: contract.dueDate,
      organization_id:
        "organizationId" in contract ? contract.organizationId : undefined,
      organization_name: contract.organization,
      progress: contract.progress,
      source_id: "sourceId" in contract ? contract.sourceId : undefined,
      source_type: "sourceType" in contract ? contract.sourceType : undefined,
      start_date: contract.startDate,
      status: contract.status,
      title: contract.title,
      value: contract.value,
    }).select("*").single();
    if (error) {
      throw new Error(`Unable to create contract: ${getSupabaseErrorMessage(error)}`);
    }
    return {
      accent: "violet",
      agent: data.agent_name,
      agentId: data.agent_id ?? undefined,
      dueDate: data.due_date ?? "",
      id: data.id,
      organization: data.organization_name,
      organizationId: data.organization_id ?? "",
      progress: data.progress ?? 0,
      sourceId: data.source_id ?? "",
      sourceType: data.source_type ?? "application",
      startDate: data.start_date ?? "",
      status: data.status,
      title: data.title,
      value: data.value ?? "Custom scope",
    };
  }

  const state = await loadLocalState();
  const localContract = contract as LocalContract;
  await saveLocalState({
    ...state,
    localContracts: [localContract, ...state.localContracts],
  });
  return localContract;
}

export async function updateContractWorkspace(workspace: ContractWorkspace) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("activity_events").insert({
      entity_id: workspace.contractId,
      entity_type: "contract",
      event_type: "contract_workspace_snapshot",
      message: "Contract workspace updated",
      metadata: workspace,
    });
    if (error) {
      throw new Error(`Unable to update contract workspace: ${getSupabaseErrorMessage(error)}`);
    }
    return;
  }

  const state = await loadLocalState();
  await saveLocalState({
    ...state,
    contractWorkspaces: [
      workspace,
      ...state.contractWorkspaces.filter(
        (candidate) => candidate.contractId !== workspace.contractId,
      ),
    ],
  });
}

export async function createMilestone(
  contractId: string,
  milestone: ContractMilestone,
) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("contract_milestones").insert({
      completed: milestone.completed,
      completed_at: milestone.completedAt,
      contract_id: contractId,
      notes: milestone.notes,
      title: milestone.title,
    });
    if (error) {
      throw new Error(`Unable to create milestone: ${getSupabaseErrorMessage(error)}`);
    }
  }
}

export async function updateMilestone(
  milestoneId: string,
  milestone: Partial<ContractMilestone>,
) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("contract_milestones")
      .update({
        completed: milestone.completed,
        completed_at: milestone.completedAt,
        notes: milestone.notes,
        title: milestone.title,
      })
      .eq("id", milestoneId);
    if (error) {
      throw new Error(`Unable to update milestone: ${getSupabaseErrorMessage(error)}`);
    }
  }
}

export async function createDeliverable(
  contractId: string,
  deliverable: ContractDeliverable,
) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("contract_deliverables").insert({
      approved_at: deliverable.approvedAt,
      contract_id: contractId,
      decisions: deliverable.decisions,
      notes: deliverable.notes,
      status: deliverable.status,
      submitted_at: deliverable.submittedAt,
      title: deliverable.title,
    });
    if (error) {
      throw new Error(`Unable to create deliverable: ${getSupabaseErrorMessage(error)}`);
    }
  }
}

export async function updateDeliverable(
  deliverableId: string,
  deliverable: Partial<ContractDeliverable>,
) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("contract_deliverables")
      .update({
        approved_at: deliverable.approvedAt,
        decisions: deliverable.decisions,
        notes: deliverable.notes,
        status: deliverable.status,
        submitted_at: deliverable.submittedAt,
        title: deliverable.title,
      })
      .eq("id", deliverableId);
    if (error) {
      throw new Error(`Unable to update deliverable: ${getSupabaseErrorMessage(error)}`);
    }
  }
}

export async function createMessage(message: ContractMessage & { contractId: string }) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("contract_messages").insert({
      author: message.author,
      body: message.body,
      contract_id: message.contractId,
      sender_type: message.senderType,
    });
    if (error) {
      throw new Error(`Unable to create message: ${getSupabaseErrorMessage(error)}`);
    }
  }
}
