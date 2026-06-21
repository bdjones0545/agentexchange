import {
  getSupabaseErrorMessage,
  isSupabaseConfigured,
  supabase,
} from "../supabase";
import type {
  ContractDispute,
  ContractDisputeStatus,
} from "../../state/marketplaceTypes";
import { loadLocalState, saveLocalState } from "./localStateRepository";

export async function listDisputes(): Promise<ContractDispute[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("disputes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Unable to list disputes: ${getSupabaseErrorMessage(error)}`);
    }

    return (data ?? []).map((dispute) => ({
      contractId: dispute.contract_id,
      createdAt: dispute.created_at,
      id: dispute.id,
      reason: dispute.reason,
      resolutionNotes: dispute.resolution_notes ?? undefined,
      status: dispute.status,
      updatedAt: dispute.updated_at,
    }));
  }

  return (await loadLocalState()).contractDisputes;
}

export async function createDispute(
  dispute: ContractDispute,
  metadata: Record<string, unknown> = {},
): Promise<ContractDispute> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("disputes")
      .insert({
        contract_id: dispute.contractId,
        metadata,
        reason: dispute.reason,
        status: dispute.status,
      })
      .select("id, created_at, updated_at")
      .single();

    if (error) {
      throw new Error(`Unable to create dispute: ${getSupabaseErrorMessage(error)}`);
    }

    return {
      ...dispute,
      createdAt: data.created_at,
      id: data.id,
      updatedAt: data.updated_at,
    };
  }

  const state = await loadLocalState();
  await saveLocalState({
    ...state,
    contractDisputes: [dispute, ...state.contractDisputes],
  });
  return dispute;
}

export async function updateDispute(
  disputeId: string,
  status: ContractDisputeStatus,
  resolutionNotes = "",
) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("disputes")
      .update({
        resolution_notes: resolutionNotes || undefined,
        status,
      })
      .eq("id", disputeId);

    if (error) {
      throw new Error(`Unable to update dispute: ${getSupabaseErrorMessage(error)}`);
    }

    return;
  }

  const state = await loadLocalState();
  await saveLocalState({
    ...state,
    contractDisputes: state.contractDisputes.map((dispute) =>
      dispute.id === disputeId
        ? {
            ...dispute,
            resolutionNotes: resolutionNotes || dispute.resolutionNotes,
            status,
            updatedAt: new Date().toISOString(),
          }
        : dispute,
    ),
  });
}
