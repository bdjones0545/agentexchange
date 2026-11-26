import type { SupabaseClient, User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { accountSummary, buildAccountExport, EXPORT_SECTIONS, exportFileName } from "../server/accountExport";
import { fakeDb } from "./fakeSupabase";

const USER = "u-me";
const ME = "p-me";
const user = {
  id: USER,
  email: "me@example.com",
  new_email: "next@example.com",
  created_at: "2026-10-01T00:00:00Z",
  identities: [{ provider: "email" }],
  app_metadata: { provider: "email", providers: ["email", "google"] },
  user_metadata: { display_name: "Me" },
} as unknown as User;

function tables() {
  return {
    profiles: [{ id: ME, user_id: USER, email: "me@example.com", display_name: "Me" }, { id: "p-other", user_id: "u-other", email: "other@example.com" }],
    organizations: [{ id: "o-me", owner_id: ME, name: "Mine", created_at: "1" }, { id: "o-other", owner_id: "p-other", name: "Theirs", created_at: "2" }],
    agents: [{ id: "a-me", owner_id: ME, name: "My agent", created_at: "1" }, { id: "a-other", owner_id: "p-other", name: "Their agent", created_at: "2" }],
    opportunities: [{ id: "b-me", owner_id: ME, title: "My brief", created_at: "1" }, { id: "b-other", owner_id: "p-other", title: "Their brief", created_at: "2" }],
    contracts: [
      { id: "c-buyer", organization_id: "o-me", agent_id: "a-other", created_at: "1" },
      { id: "c-seller", organization_id: "o-other", agent_id: "a-me", created_at: "2" },
      { id: "c-both", organization_id: "o-me", agent_id: "a-me", created_at: "3" },
      { id: "c-strangers", organization_id: "o-other", agent_id: "a-other", created_at: "4" },
    ],
    contract_messages: [
      { id: "m1", contract_id: "c-buyer", body: "hello", created_at: "1" },
      { id: "m2", contract_id: "c-strangers", body: "not yours", created_at: "2" },
    ],
    payments: [{ id: "pay1", contract_id: "c-seller", amount_cents: 20000, created_at: "1" }],
    agent_api_keys: [{ id: "k1", profile_id: ME, name: "Bot", key_prefix: "axk_ab12", key_hash: "SECRET-HASH", created_at: "1", revoked_at: null }],
    agent_payment_cards: [{ key_id: "k1", profile_id: ME, mode: "dedicated", setup_token: "SECRET-SETUP", card_last4: "4242", updated_at: "1" }],
    policy_acceptances: [{ user_id: USER, policy_version: "v1", accepted_at: "1" }, { user_id: "u-other", policy_version: "v1", accepted_at: "1" }],
    account_deletion_requests: [] as Record<string, unknown>[],
  };
}

const webhooks = () => fakeDb({ projectColumns: true, tables: { agent_webhooks: [{ key_id: "k1", profile_id: ME, url: "https://agent.example.com/hook", secret: "whsec_SECRET", events: [] }, { key_id: "k9", profile_id: "p-other", url: "https://x.test", secret: "whsec_OTHER" }] } });

describe("download my data", () => {
  it("includes the account's own rows and the contracts it is party to, nothing else", async () => {
    const file = await buildAccountExport({ client: fakeDb({ tables: tables(), projectColumns: true }), service: webhooks(), user, profileId: ME }, () => new Date("2026-11-26T12:00:00Z"));
    expect(file).toMatchObject({ format: "agentexchange-account-export", version: 1, exported_at: "2026-11-26T12:00:00.000Z" });
    expect(file.profile).toMatchObject({ id: ME, email: "me@example.com" });
    expect(file.data.organizations.map((r) => r.id)).toEqual(["o-me"]);
    expect(file.data.agents.map((r) => r.id)).toEqual(["a-me"]);
    expect(file.data.opportunities.map((r) => r.id)).toEqual(["b-me"]);
    expect(file.data.contracts.map((r) => r.id).sort()).toEqual(["c-both", "c-buyer", "c-seller"]);
    expect(file.data.contract_messages.map((r) => r.id)).toEqual(["m1"]);
    expect(file.data.payments.map((r) => r.id)).toEqual(["pay1"]);
    expect(file.data.policy_acceptances).toHaveLength(1);
    expect(file.data.agent_webhooks).toEqual([expect.objectContaining({ key_id: "k1", url: "https://agent.example.com/hook" })]);
    expect(Object.keys(file.data).sort()).toEqual([...EXPORT_SECTIONS].sort());
    expect(file.unavailable).toEqual([]);
    expect(file.truncated).toEqual([]);
  });

  it("never exports key hashes, card setup tokens or webhook secrets", async () => {
    const file = await buildAccountExport({ client: fakeDb({ tables: tables(), projectColumns: true }), service: webhooks(), user, profileId: ME });
    const text = JSON.stringify(file);
    for (const secret of ["SECRET-HASH", "SECRET-SETUP", "whsec_SECRET", "whsec_OTHER"]) expect(text).not.toContain(secret);
    expect(file.data.agent_api_keys[0]).toMatchObject({ id: "k1", key_prefix: "axk_ab12" });
    expect(file.data.agent_payment_cards[0]).toMatchObject({ key_id: "k1", card_last4: "4242" });
  });

  it("names a section it could not read instead of silently leaving it out", async () => {
    const base = fakeDb({ tables: tables() });
    const refused = { data: null, error: { message: "permission denied for table seller_bank_payouts" } };
    const failing: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "order", "range"]) failing[m] = () => failing;
    failing.then = (resolve: (r: unknown) => void) => resolve(refused);
    const client = { from: (t: string) => (t === "seller_bank_payouts" ? failing : base.from(t)) } as unknown as SupabaseClient;
    const file = await buildAccountExport({ client, service: null, user, profileId: ME });
    expect(file.unavailable).toEqual([
      { section: "seller_bank_payouts", reason: "not readable with your sign-in" },
      { section: "agent_webhooks", reason: "could not be read" },
    ]);
    expect(file.data.organizations).toHaveLength(1);
  });

  it("reads past the first page and marks a section cut off at the limit", async () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `e${String(i).padStart(6, "0")}`, owner_id: ME, created_at: String(i).padStart(6, "0") }));
    const full = await buildAccountExport({ client: fakeDb({ tables: { ...tables(), activity_events: many(2500) } }), user, profileId: ME });
    expect(full.data.activity_events).toHaveLength(2500);
    expect(full.truncated).toEqual([]);
    const capped = await buildAccountExport({ client: fakeDb({ tables: { ...tables(), activity_events: many(10_050) } }), user, profileId: ME });
    expect(capped.data.activity_events).toHaveLength(10_000);
    expect(capped.truncated).toEqual(["activity_events"]);
  });

  it("describes the sign-in account and names the file by date", () => {
    expect(accountSummary(user)).toMatchObject({ id: USER, email: "me@example.com", pending_email: "next@example.com", sign_in_methods: ["email", "google"], user_metadata: { display_name: "Me" } });
    expect(exportFileName("2026-11-26T12:00:00.000Z")).toBe("agentexchange-data-2026-11-26.json");
  });
});
