import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { confirmationMatches, deleteAccount, DeletionError, supabaseDeletionStore, type DeletionStore } from "../server/accountDeletion";
import { fakeDb } from "./fakeSupabase";

const who = { userId: "u-me", profileId: "p-me" };
const queued = { status: "requested", requested_at: "2026-11-26T00:00:00Z", updated_at: null, response: "Your deletion request has been received." };

function store(over: Partial<DeletionStore> = {}): DeletionStore & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    ready: vi.fn(async () => { calls.push("ready"); return true; }),
    deleteUser: vi.fn(async () => { calls.push("deleteUser"); return { error: null }; }),
    userExists: vi.fn(async () => { calls.push("userExists"); return true; }),
    request: vi.fn(async () => { calls.push("request"); return queued; }),
    ...over,
  };
}

describe("delete my account", () => {
  it("deletes at once when the database says nothing must be kept", async () => {
    const s = store();
    expect(await deleteAccount(s, who)).toEqual({ status: "deleted" });
    expect(s.deleteUser).toHaveBeenCalledWith("u-me");
    expect(s.request).not.toHaveBeenCalled();
  });

  it("queues a review, and deletes nothing, when marketplace or billing records exist", async () => {
    const s = store({ ready: vi.fn(async () => false) });
    expect(await deleteAccount(s, who)).toEqual({ status: "requested", request: queued });
    expect(s.deleteUser).not.toHaveBeenCalled();
  });

  it("queues a review when a record appeared between the check and the delete (the guard refused it)", async () => {
    const ready = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const s = store({ ready, deleteUser: vi.fn(async () => ({ error: "Database error deleting user" })) });
    expect(await deleteAccount(s, who)).toEqual({ status: "requested", request: queued });
  });

  it("reports deleted when the delete committed but its reply was lost", async () => {
    const s = store({ deleteUser: vi.fn(async () => ({ error: "fetch failed" })), userExists: vi.fn(async () => false) });
    expect(await deleteAccount(s, who)).toEqual({ status: "deleted" });
    expect(s.request).not.toHaveBeenCalled();
  });

  it("fails without queueing when Auth refused for some other reason", async () => {
    const s = store({ deleteUser: vi.fn(async () => ({ error: "Service unavailable" })) });
    await expect(deleteAccount(s, who)).rejects.toBeInstanceOf(DeletionError);
    expect(s.request).not.toHaveBeenCalled();
  });

  it.each([
    ["me@example.com", "me@example.com", true],
    ["  ME@Example.com ", "me@example.com", true],
    ["you@example.com", "me@example.com", false],
    ["", "me@example.com", false],
    [undefined, "me@example.com", false],
    ["DELETE", "me@example.com", false],
    ["delete", null, true],
    ["me@example.com", null, false],
  ])("confirmation %j for %j matches: %s", (typed, email, ok) => {
    expect(confirmationMatches(typed, email)).toBe(ok);
  });
});

describe("Supabase deletion store", () => {
  function admin(tables: Record<string, Record<string, unknown>[]>, opts: { ready?: boolean; rpcError?: boolean; duplicate?: boolean } = {}) {
    const db = fakeDb({
      tables,
      rpc: (name, args) => (name === "account_deletion_ready" && args.target === "p-me" && !opts.rpcError ? { data: opts.ready ?? true, error: null } : { data: null, error: { message: "boom" } }),
      refuseInsert: (table, row) => {
        if (table !== "account_deletion_requests" || !opts.duplicate) return null;
        // Another tab queued it first.
        tables.account_deletion_requests.push({ ...queued, user_id: row.user_id });
        return "duplicate key value violates unique constraint";
      },
    });
    const deleteUser = vi.fn(async () => ({ data: {}, error: null }));
    const getUserById = vi.fn(async () => ({ data: { user: null }, error: { status: 404, message: "User not found" } }));
    return { client: Object.assign(db, { auth: { admin: { deleteUser, getUserById } } }) as unknown as SupabaseClient, deleteUser, getUserById };
  }

  it("asks the database whether the profile can go, and fails closed when it cannot answer", async () => {
    expect(await supabaseDeletionStore(admin({}, { ready: false }).client).ready("p-me")).toBe(false);
    expect(await supabaseDeletionStore(admin({}).client).ready("p-me")).toBe(true);
    await expect(supabaseDeletionStore(admin({}, { rpcError: true }).client).ready("p-me")).rejects.toBeInstanceOf(DeletionError);
  });

  it("queues one request per account and returns the existing one again", async () => {
    const tables = { account_deletion_requests: [] as Record<string, unknown>[] };
    const s = supabaseDeletionStore(admin(tables).client);
    const first = await s.request("u-me");
    expect(first).toMatchObject({ user_id: "u-me" });
    tables.account_deletion_requests[0] = { ...tables.account_deletion_requests[0], ...queued };
    expect(await s.request("u-me")).toMatchObject(queued);
    expect(tables.account_deletion_requests).toHaveLength(1);
  });

  it("returns the other tab's request when the insert loses the race", async () => {
    const tables = { account_deletion_requests: [] as Record<string, unknown>[] };
    expect(await supabaseDeletionStore(admin(tables, { duplicate: true }).client).request("u-me")).toMatchObject(queued);
  });

  it("deletes the Auth user and treats a 404 as gone", async () => {
    const a = admin({});
    const s = supabaseDeletionStore(a.client);
    expect(await s.deleteUser("u-me")).toEqual({ error: null });
    expect(a.deleteUser).toHaveBeenCalledWith("u-me");
    expect(await s.userExists("u-me")).toBe(false);
  });
});
