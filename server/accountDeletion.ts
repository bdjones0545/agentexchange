// Deleting the signed-in account. The database decides whether it can go at
// once: account_deletion_ready() is true only when the deletion guard trigger
// is deployed and no marketplace or billing record would be orphaned (saved
// briefs and agent keys go with the account). Deleting the Auth user cascades
// to the profile, and the guard checks again inside that same transaction, so
// a record created after the check makes the delete fail rather than orphan it.
// An account that cannot go at once is queued in account_deletion_requests for
// a support review; its owner can read that request, nobody else can.
import type { SupabaseClient } from "@supabase/supabase-js";

export const DELETION_REQUEST_COLUMNS = "status,requested_at,updated_at,response";

export interface DeletionRequest {
  status: string;
  requested_at: string;
  updated_at: string | null;
  response: string;
}

export type DeletionOutcome = { status: "deleted" } | { status: "requested"; request: DeletionRequest };

export interface DeletionStore {
  ready(profileId: string): Promise<boolean>;
  deleteUser(userId: string): Promise<{ error: string | null }>;
  userExists(userId: string): Promise<boolean>;
  request(userId: string): Promise<DeletionRequest>;
}

export class DeletionError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** The person types their account email (or DELETE when the account has none) to confirm. */
export function confirmationMatches(typed: unknown, email: string | null): boolean {
  if (typeof typed !== "string") return false;
  const value = typed.trim().toLowerCase();
  if (!value) return false;
  return email ? value === email.trim().toLowerCase() : value === "delete";
}

export async function deleteAccount(store: DeletionStore, who: { userId: string; profileId: string }): Promise<DeletionOutcome> {
  if (await store.ready(who.profileId)) {
    const { error } = await store.deleteUser(who.userId);
    if (!error) return { status: "deleted" };
    // The delete may have committed before the reply was lost.
    if (!(await store.userExists(who.userId))) return { status: "deleted" };
    // Still deletable on a fresh check: this was not the guard, so say so rather than queue it.
    if (await store.ready(who.profileId)) throw new DeletionError(503, "Account deletion failed. Nothing was deleted; try again in a few minutes.");
  }
  return { status: "requested", request: await store.request(who.userId) };
}

export function supabaseDeletionStore(admin: SupabaseClient): DeletionStore {
  const readRequest = async (userId: string) => {
    const { data, error } = await admin.from("account_deletion_requests").select(DELETION_REQUEST_COLUMNS).eq("user_id", userId).maybeSingle();
    if (error) throw new DeletionError(503, "Could not record the deletion request");
    return (data as DeletionRequest | null) ?? null;
  };
  return {
    async ready(profileId) {
      const { data, error } = await admin.rpc("account_deletion_ready", { target: profileId });
      if (error) throw new DeletionError(503, "Account deletion is unavailable right now");
      return data === true;
    },
    async deleteUser(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      return { error: error ? error.message : null };
    },
    async userExists(userId) {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (data?.user) return true;
      // Anything but a clear "not found" counts as still there.
      return !(error && (error.status === 404 || /not found/i.test(error.message)));
    },
    async request(userId) {
      const existing = await readRequest(userId);
      if (existing) return existing;
      const { data, error } = await admin.from("account_deletion_requests").insert({ user_id: userId }).select(DELETION_REQUEST_COLUMNS).single();
      if (!error && data) return data as DeletionRequest;
      // A second tab may have queued it first (user_id is unique).
      const raced = await readRequest(userId);
      if (raced) return raced;
      throw new DeletionError(503, "Could not record the deletion request");
    },
  };
}
