// The only writer of money state.
//
// payment_status on contracts, and every row in payments / payouts /
// stripe_events, are immutable to end users (triggers + revoked grants). This
// module holds the service-role client that may change them, and it is imported
// only by the handlers that react to Stripe: checkout creation, the webhook, and
// release. Nothing in the browser bundle or the MCP tools can reach it.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type PaymentStatus = "unfunded" | "authorized" | "captured" | "paid_out" | "refunded";

export interface ContractMoneyRow {
  id: string;
  organization_id: string | null;
  agent_id: string | null;
  title: string;
  amount_cents: number | null;
  currency: string;
  payment_status: PaymentStatus;
  platform_fee_bps: number;
  status: string;
}

let cached: SupabaseClient | null = null;

export function serviceClient(env: Record<string, string | undefined> = process.env): SupabaseClient {
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("ledger unavailable: SUPABASE_SERVICE_ROLE_KEY is not set");
  if (!cached) {
    cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  }
  return cached;
}

export interface Ledger {
  getContract(contractId: string): Promise<ContractMoneyRow | null>;
  setPaymentStatus(contractId: string, status: PaymentStatus): Promise<void>;
  recordPayment(input: { contractId: string; providerRef: string; kind: "charge" | "refund"; amountCents: number; currency: string; status: "pending" | "authorized" | "captured" | "refunded" | "failed"; metadata?: Record<string, unknown> }): Promise<void>;
  updatePayment(providerRef: string, patch: { status?: "pending" | "authorized" | "captured" | "refunded" | "failed"; providerRef?: string; metadata?: Record<string, unknown> }): Promise<void>;
  findPaymentByRef(providerRef: string): Promise<{ contract_id: string; status: string } | null>;
  recordPayout(input: { contractId: string; agentId: string | null; operatorProfileId: string | null; grossCents: number; feeCents: number; currency: string }): Promise<void>;
  /** Returns false when the event was already recorded (a redelivery). */
  claimEvent(eventId: string, type: string, contractId?: string | null): Promise<boolean>;
  finishEvent(eventId: string, outcome: string): Promise<void>;
  operatorProfileForAgent(agentId: string | null): Promise<string | null>;
  organizationOwner(organizationId: string | null): Promise<string | null>;
  /** The Stripe PaymentIntent currently holding this contract's funds, if any. */
  authorizedPaymentRef(contractId: string): Promise<string | null>;
  /** The deliverables' decision state, for the release gate. */
  deliverableSummary(contractId: string): Promise<{ total: number; approved: number; submitted: number }>;
}

export function supabaseLedger(client: SupabaseClient = serviceClient()): Ledger {
  const fail = (step: string, error: { message: string } | null) => new Error(`${step}: ${error?.message ?? "unknown"}`);
  return {
    async getContract(contractId) {
      const { data, error } = await client
        .from("contracts")
        .select("id,organization_id,agent_id,title,amount_cents,currency,payment_status,platform_fee_bps,status")
        .eq("id", contractId)
        .maybeSingle();
      if (error) throw fail("getContract", error);
      return (data as ContractMoneyRow) ?? null;
    },
    async setPaymentStatus(contractId, status) {
      const { error } = await client.from("contracts").update({ payment_status: status }).eq("id", contractId);
      if (error) throw fail("setPaymentStatus", error);
    },
    async recordPayment(input) {
      const { error } = await client.from("payments").insert({
        contract_id: input.contractId,
        provider: "stripe",
        provider_ref: input.providerRef,
        kind: input.kind,
        amount_cents: input.amountCents,
        currency: input.currency,
        status: input.status,
        metadata: input.metadata ?? {},
      });
      if (error) throw fail("recordPayment", error);
    },
    async updatePayment(providerRef, patch) {
      const update: Record<string, unknown> = {};
      if (patch.status) update.status = patch.status;
      if (patch.providerRef) update.provider_ref = patch.providerRef;
      if (patch.metadata) update.metadata = patch.metadata;
      const { error } = await client.from("payments").update(update).eq("provider_ref", providerRef);
      if (error) throw fail("updatePayment", error);
    },
    async findPaymentByRef(providerRef) {
      const { data, error } = await client.from("payments").select("contract_id,status").eq("provider_ref", providerRef).maybeSingle();
      if (error) throw fail("findPaymentByRef", error);
      return (data as { contract_id: string; status: string }) ?? null;
    },
    async recordPayout(input) {
      const { error } = await client.from("payouts").insert({
        contract_id: input.contractId,
        agent_id: input.agentId,
        operator_profile_id: input.operatorProfileId,
        gross_cents: input.grossCents,
        fee_cents: input.feeCents,
        net_cents: input.grossCents - input.feeCents,
        currency: input.currency,
        status: "pending",
      });
      if (error) throw fail("recordPayout", error);
    },
    async claimEvent(eventId, type, contractId) {
      const { error } = await client.from("stripe_events").insert({ id: eventId, type, contract_id: contractId ?? null });
      if (error) {
        if (error.code === "23505") return false; // already claimed: a redelivery
        throw fail("claimEvent", error);
      }
      return true;
    },
    async finishEvent(eventId, outcome) {
      const { error } = await client.from("stripe_events").update({ processed_at: new Date().toISOString(), outcome }).eq("id", eventId);
      if (error) throw fail("finishEvent", error);
    },
    async operatorProfileForAgent(agentId) {
      if (!agentId) return null;
      const { data } = await client.from("agents").select("owner_id").eq("id", agentId).maybeSingle();
      return (data?.owner_id as string | undefined) ?? null;
    },
    async organizationOwner(organizationId) {
      if (!organizationId) return null;
      const { data } = await client.from("organizations").select("owner_id").eq("id", organizationId).maybeSingle();
      return (data?.owner_id as string | undefined) ?? null;
    },
    async authorizedPaymentRef(contractId) {
      const { data } = await client
        .from("payments")
        .select("provider_ref")
        .eq("contract_id", contractId)
        .eq("kind", "charge")
        .eq("status", "authorized")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data?.provider_ref as string | undefined) ?? null;
    },
    async deliverableSummary(contractId) {
      const { data, error } = await client.from("contract_deliverables").select("status").eq("contract_id", contractId);
      if (error) throw fail("deliverableSummary", error);
      const rows = (data ?? []) as Array<{ status: string }>;
      return {
        total: rows.length,
        approved: rows.filter((r) => r.status === "approved").length,
        submitted: rows.filter((r) => r.status === "submitted").length,
      };
    },
  };
}
