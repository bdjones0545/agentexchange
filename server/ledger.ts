// The only writer of money state.
//
// payment_status on contracts, and every row in payments / payouts /
// stripe_events, are immutable to end users (triggers + revoked grants). This
// module holds the service-role client that may change them, and it is imported
// only by the handlers that react to Stripe: checkout creation, the webhook, and
// release. Nothing in the browser bundle or the MCP tools can reach it.
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "./service.js";

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

export interface BillingAccount {
  profile_id: string;
  stripe_customer_id: string | null;
  default_payment_method_id: string | null;
  card_brand: string | null;
  card_last4: string | null;
  agent_daily_cap_cents: number;
  agent_per_contract_cap_cents: number;
}

export interface Ledger {
  getContract(contractId: string): Promise<ContractMoneyRow | null>;
  getBillingAccount(profileId: string): Promise<BillingAccount | null>;
  upsertBillingAccount(profileId: string, patch: Partial<Omit<BillingAccount, "profile_id">> & { card_exp_month?: number | null; card_exp_year?: number | null }): Promise<void>;
  /** Cents authorized by agents on this operator's contracts in the last 24 hours. */
  agentSpendLast24h(profileId: string): Promise<number>;
  setPaymentStatus(contractId: string, status: PaymentStatus): Promise<void>;
  recordPayment(input: { contractId: string; providerRef: string; kind: "charge" | "refund"; amountCents: number; currency: string; status: "pending" | "authorized" | "captured" | "refunded" | "failed"; metadata?: Record<string, unknown>; authorizedBy?: "human" | "agent" }): Promise<void>;
  updatePayment(providerRef: string, patch: { status?: "pending" | "authorized" | "captured" | "refunded" | "failed"; providerRef?: string; metadata?: Record<string, unknown> }): Promise<void>;
  findPaymentByRef(providerRef: string): Promise<{ contract_id: string; status: string } | null>;
  recordPayout(input: { contractId: string; agentId: string | null; operatorProfileId: string | null; grossCents: number; feeCents: number; currency: string; paymentIntentId: string }): Promise<void>;
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

export function supabaseLedger(client: SupabaseClient = serviceClient(), reader: SupabaseClient = client): Ledger {
  const fail = (step: string, error: { message: string } | null) => new Error(`${step}: ${error?.message ?? "unknown"}`);
  return {
    async getContract(contractId) {
      const { data, error } = await reader
        .from("contracts")
        .select("id,organization_id,agent_id,title,amount_cents,currency,payment_status,platform_fee_bps,status")
        .eq("id", contractId)
        .maybeSingle();
      if (error) throw fail("getContract", error);
      return (data as ContractMoneyRow) ?? null;
    },
    async getBillingAccount(profileId) {
      const { data, error } = await client.from("billing_accounts").select("profile_id,stripe_customer_id,default_payment_method_id,card_brand,card_last4,agent_daily_cap_cents,agent_per_contract_cap_cents").eq("profile_id", profileId).maybeSingle();
      if (error) throw fail("getBillingAccount", error);
      return (data as BillingAccount) ?? null;
    },
    async upsertBillingAccount(profileId, patch) {
      const { error } = await client.from("billing_accounts").upsert({ profile_id: profileId, ...patch }, { onConflict: "profile_id" });
      if (error) throw fail("upsertBillingAccount", error);
    },
    async agentSpendLast24h(profileId) {
      // Contracts whose organization this operator owns, payments authorized by an agent in the window.
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: orgs } = await reader.from("organizations").select("id").eq("owner_id", profileId);
      const orgIds = ((orgs ?? []) as Array<{ id: string }>).map((o) => o.id);
      if (orgIds.length === 0) return 0;
      const { data: contracts } = await client.from("contracts").select("id").in("organization_id", orgIds);
      const contractIds = ((contracts ?? []) as Array<{ id: string }>).map((c) => c.id);
      if (contractIds.length === 0) return 0;
      const { data, error } = await client
        .from("payments")
        .select("amount_cents")
        .in("contract_id", contractIds)
        .eq("kind", "charge")
        .eq("authorized_by", "agent")
        .in("status", ["authorized", "captured"])
        .gte("created_at", since);
      if (error) throw fail("agentSpendLast24h", error);
      return ((data ?? []) as Array<{ amount_cents: number }>).reduce((t, p) => t + p.amount_cents, 0);
    },
    async setPaymentStatus(contractId, status) {
      const { error } = await client.rpc("set_contract_payment_status", {p_contract: contractId, p_status: status});
      if (error) throw fail("setPaymentStatus", error);
    },
    async recordPayment(input) {
      const { error } = await client.from("payments").upsert({
        contract_id: input.contractId,
        provider: "stripe",
        provider_ref: input.providerRef,
        kind: input.kind,
        amount_cents: input.amountCents,
        currency: input.currency,
        status: input.status,
        metadata: input.metadata ?? {},
        authorized_by: input.authorizedBy ?? null,
      }, { onConflict: "provider_ref", ignoreDuplicates: input.kind !== "refund" });
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
      const { error } = await client.from("payouts").upsert({
        contract_id: input.contractId,
        agent_id: input.agentId,
        operator_profile_id: input.operatorProfileId,
        gross_cents: input.grossCents,
        fee_cents: input.feeCents,
        net_cents: input.grossCents - input.feeCents,
        currency: input.currency,
        status: "pending",
        payment_intent_id: input.paymentIntentId,
      }, {onConflict: "contract_id", ignoreDuplicates: true});
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
      const { data } = await reader.from("agents").select("owner_id").eq("id", agentId).maybeSingle();
      return (data?.owner_id as string | undefined) ?? null;
    },
    async organizationOwner(organizationId) {
      if (!organizationId) return null;
      const { data } = await reader.from("organizations").select("owner_id").eq("id", organizationId).maybeSingle();
      return (data?.owner_id as string | undefined) ?? null;
    },
    async authorizedPaymentRef(contractId) {
      const { data } = await client
        .from("payments")
        .select("provider_ref")
        .eq("contract_id", contractId)
        .eq("kind", "charge")
        .in("status", ["authorized", "captured"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data?.provider_ref as string | undefined) ?? null;
    },
    async deliverableSummary(contractId) {
      const { data, error } = await reader.from("contract_deliverables").select("status").eq("contract_id", contractId);
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
