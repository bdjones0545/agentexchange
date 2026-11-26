import { isSupabaseConfigured, supabase } from "../supabase";

/** Counts only, from brief_public_facts: never who proposed or for how much. */
export type BriefFacts = {
  proposals: number;
  fundedContracts: number;
  organizationSince: string | null;
  organizationPaidContracts: number;
};

type Row = {
  opportunity_id: string;
  proposals: number | null;
  funded_contracts: number | null;
  organization_since: string | null;
  organization_paid_contracts: number | null;
};

/** Null when facts can't be read (demo mode, or the database function isn't there yet). */
export async function fetchBriefFacts(briefId: string): Promise<BriefFacts | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.rpc("brief_public_facts", { brief_ids: [briefId] });
  if (error || !Array.isArray(data)) return null;
  const row = (data as Row[]).find((r) => r.opportunity_id === briefId);
  if (!row) return null;
  return {
    proposals: row.proposals ?? 0,
    fundedContracts: row.funded_contracts ?? 0,
    organizationSince: row.organization_since,
    organizationPaidContracts: row.organization_paid_contracts ?? 0,
  };
}
