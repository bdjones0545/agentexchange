import { supabase, isSupabaseConfigured, getSupabaseErrorMessage } from "../supabase";
import type { Contract } from "../../data/operations";
import type {
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

export async function createContract(contract: LocalContract | Contract) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("contracts").insert({
      agent_name: contract.agent,
      due_date: contract.dueDate,
      organization_name: contract.organization,
      progress: contract.progress,
      source_id: "sourceId" in contract ? contract.sourceId : undefined,
      source_type: "sourceType" in contract ? contract.sourceType : undefined,
      start_date: contract.startDate,
      status: contract.status,
      title: contract.title,
      value: contract.value,
    });
    if (error) {
      throw new Error(`Unable to create contract: ${getSupabaseErrorMessage(error)}`);
    }
    return;
  }

  const state = await loadLocalState();
  await saveLocalState({
    ...state,
    localContracts: [contract as LocalContract, ...state.localContracts],
  });
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

export async function createMessage(message: ContractMessage) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("contract_messages").insert({
      author: message.author,
      body: message.body,
      contract_id: message.id,
      sender_type: message.senderType,
    });
    if (error) {
      throw new Error(`Unable to create message: ${getSupabaseErrorMessage(error)}`);
    }
  }
}
