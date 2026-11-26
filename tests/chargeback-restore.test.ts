import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertTransferable, fundsInDispute, transferPayout, type PayoutRow, type SellerGateway } from "../server/connect";
import { disputeStateFromStatuses, type PaymentSnapshot, type StripeGateway } from "../server/stripe";
import { memoryOperations } from "./money-operation-store";

const paid: PaymentSnapshot = { id: "pi_1", status: "succeeded", amount: 10300, amountReceived: 10300, currency: "USD", contractId: "c1", chargeId: "ch_1", captureBefore: null, refunded: 0, disputed: false, dispute: "none" };

/** A tiny Stripe + database: transfers with their reversals, and the payout row as reconciliation saves it. */
function world() {
  const transfers = new Map<string, { amount: number; reversed: number }>([["tr_1", { amount: 8500, reversed: 0 }]]);
  let payment: PaymentSnapshot = { ...paid };
  let row: PayoutRow = { id: "p1", contract_id: "c1", operator_profile_id: "seller", payment_intent_id: "pi_1", net_cents: 8500, currency: "USD", provider_ref: "tr_1", status: "transferred", reversed_cents: 0, restore_ref: null, restored_cents: 0 };
  const restores: number[] = [];
  const gateway = {
    readiness: async () => ({ transfers: true, payouts: true }),
    transfer: async () => "tr_unused",
    restoreTransfer: async ({ amount }: { amount: number }) => { restores.push(amount); transfers.set("tr_restore", { amount, reversed: 0 }); return "tr_restore"; },
    retrieveTransfer: async (id: string) => ({ ...transfers.get(id)! }),
    reverseTransfer: async (id: string, amount: number) => { transfers.get(id)!.reversed += amount; },
  } as unknown as SellerGateway;
  const client = {
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === "seller_accounts" ? { stripe_account_id: "acct_seller" } : null, error: null }) }) }),
      update: (patch: Partial<PayoutRow>) => ({ eq: async () => { row = { ...row, ...patch }; return { error: null }; } }),
    }),
  } as unknown as SupabaseClient;
  const stripe = { retrievePaymentIntent: async () => ({ ...payment }) } as unknown as StripeGateway;
  const ops = memoryOperations();
  return {
    run: () => transferPayout(client, ops, gateway, stripe, row),
    set: (patch: Partial<PaymentSnapshot>) => { payment = { ...payment, ...patch }; },
    held: () => { // what the seller holds across both transfers
      let total = 0; for (const t of transfers.values()) total += t.amount - t.reversed; return total;
    },
    row: () => row,
    restores,
  };
}

describe("card disputes and the seller's share", () => {
  it("takes the share back while a dispute is open, and sends it back once when the platform wins", async () => {
    const w = world();
    w.set({ disputed: true, dispute: "open" });
    await w.run();
    expect(w.held()).toBe(0);
    expect(w.row()).toMatchObject({ reversed_cents: 8500, status: "reversed" });

    w.set({ dispute: "won" }); // Stripe keeps charge.disputed true after a win
    expect(await w.run()).toEqual({ state: "restored" });
    expect(w.held()).toBe(8500);
    expect(w.row()).toMatchObject({ restore_ref: "tr_restore", restored_cents: 8500, reversed_cents: 0, status: "transferred" });

    await w.run(); await w.run(); // later reconciliation runs change nothing
    expect(w.restores).toEqual([8500]);
    expect(w.held()).toBe(8500);
  });

  it("keeps the share taken back when the dispute is lost", async () => {
    const w = world();
    w.set({ disputed: true, dispute: "open" }); await w.run();
    w.set({ dispute: "lost" }); await w.run(); await w.run();
    expect(w.held()).toBe(0);
    expect(w.restores).toEqual([]);
  });

  it("takes a later refund out of the restored transfer first", async () => {
    const w = world();
    w.set({ disputed: true, dispute: "open" }); await w.run();
    w.set({ dispute: "won" }); await w.run();
    w.set({ refunded: 5150 }); // half the charge refunded after the win
    await w.run();
    expect(w.held()).toBe(4250);
    expect(w.row()).toMatchObject({ reversed_cents: 4250, status: "reversed" });
  });

  it("leaves the seller paid when a bank inquiry never took the money", async () => {
    const w = world();
    w.set({ disputed: true, dispute: disputeStateFromStatuses(["warning_needs_response"]) });
    await w.run();
    expect(w.held()).toBe(8500);
  });
});

describe("dispute state", () => {
  it("counts the worst dispute, and treats an unknown status on a disputed charge as open", () => {
    expect(disputeStateFromStatuses(["won", "needs_response"])).toBe("open");
    expect(disputeStateFromStatuses(["under_review"])).toBe("open");
    expect(disputeStateFromStatuses(["lost", "won"])).toBe("lost");
    expect(disputeStateFromStatuses(["won"])).toBe("won");
    expect(disputeStateFromStatuses(["warning_closed", "prevented"])).toBe("none");
    expect(fundsInDispute({ disputed: true })).toBe(true);
    expect(fundsInDispute({ disputed: true, dispute: "won" })).toBe(false);
  });

  it("lets a first transfer go out after a won dispute, but not during one", () => {
    const payout: PayoutRow = { id: "p1", contract_id: "c1", operator_profile_id: "seller", payment_intent_id: "pi_1", net_cents: 8500, currency: "USD", provider_ref: null, status: "pending" };
    expect(() => assertTransferable({ ...paid, disputed: true, dispute: "won" }, payout)).not.toThrow();
    expect(() => assertTransferable({ ...paid, disputed: true, dispute: "open" }, payout)).toThrow();
    const { dispute: _unknown, ...noStatus } = paid;
    expect(() => assertTransferable({ ...noStatus, disputed: true }, payout)).toThrow();
  });
});
