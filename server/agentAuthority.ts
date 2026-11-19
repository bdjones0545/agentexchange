// What an agent key may do with money, as production's database decides it.
//
// Postgres (begin_money_operation) refuses an agent's hold or release unless the
// key is unpaused, unrevoked and has can_spend, lists the action in
// allowed_actions, AND lists the contract's organization in organization_ids.
// Keys start with selling actions only and no organizations, so an owner has to
// grant buying explicitly. These helpers mirror that rule so the app can grant
// it, report it truthfully and explain a refusal before the database has to.
import type { SupabaseClient } from "@supabase/supabase-js";

/** The database default for allowed_actions: everything an agent needs to sell work. */
export const SELLER_ACTIONS = [
  "publish_agent",
  "apply_to_opportunity",
  "negotiate_opportunity",
  "respond_to_negotiation",
  "respond_to_hire_request",
  "post_message",
  "submit_deliverable",
  "update_progress",
] as const;

/** The two actions the database checks before any money moves. */
export const PAYMENT_ACTIONS = ["fund_contract", "release_payment"] as const;
export type PaymentAction = (typeof PAYMENT_ACTIONS)[number];

export interface KeyAuthority {
  can_spend?: boolean | null;
  allowed_actions?: string[] | null;
  organization_ids?: string[] | null;
  paused_at?: string | null;
  revoked_at?: string | null;
}

const list = (value: string[] | null | undefined) => (Array.isArray(value) ? value : []);

/** The key may take part in payments at all: switched on, both money actions granted, at least one organization. */
export function hasPaymentAuthority(key: KeyAuthority): boolean {
  if (key.can_spend !== true || key.paused_at || key.revoked_at) return false;
  const actions = list(key.allowed_actions);
  return PAYMENT_ACTIONS.every((a) => actions.includes(a)) && list(key.organization_ids).length > 0;
}

/** Why this key cannot perform `action` for `organizationId`, or null when the database will allow it. */
export function paymentRefusal(key: KeyAuthority, action: PaymentAction, organizationId: string | null | undefined): string | null {
  if (key.revoked_at) return "This agent key is revoked.";
  if (key.paused_at) return "This agent key is paused by its owner.";
  if (key.can_spend !== true) return "This agent key has no payment permission.";
  if (!list(key.allowed_actions).includes(action)) return `This agent key is not allowed to ${action === "fund_contract" ? "fund contracts" : "release payments"}.`;
  if (!organizationId || !list(key.organization_ids).includes(organizationId)) return "This agent key may not pay for this contract's organization.";
  return null;
}

/**
 * The columns to write when an owner switches payments on or off for a key.
 * On: add both money actions and, when the key covers no organization yet, every
 * organization the owner has. Off: remove the money actions; organizations stay
 * so switching back on restores the same scope.
 */
export function paymentGrant(key: KeyAuthority, enabled: boolean, ownedOrganizationIds: string[]) {
  const actions = list(key.allowed_actions).length ? list(key.allowed_actions) : [...SELLER_ACTIONS];
  const organizations = list(key.organization_ids);
  if (!enabled) {
    return { can_spend: false, allowed_actions: actions.filter((a) => !(PAYMENT_ACTIONS as readonly string[]).includes(a)), organization_ids: organizations };
  }
  return {
    can_spend: true,
    allowed_actions: [...new Set([...actions, ...PAYMENT_ACTIONS])],
    organization_ids: organizations.length ? organizations : [...new Set(ownedOrganizationIds)],
  };
}

export const KEY_AUTHORITY_COLUMNS = "id,name,can_spend,allowed_actions,organization_ids,paused_at,revoked_at";

export class KeyGrantError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export interface GrantRequest {
  id: string;
  canSpend?: boolean;
  organizationIds?: string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A PATCH body from the owner, or null when it is malformed. */
export function parseGrantRequest(body: unknown): GrantRequest | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.id !== "string" || !UUID.test(b.id)) return null;
  if (b.canSpend !== undefined && typeof b.canSpend !== "boolean") return null;
  if (b.organizationIds !== undefined && (!Array.isArray(b.organizationIds) || b.organizationIds.length > 100 || b.organizationIds.some((id) => typeof id !== "string" || !UUID.test(id)))) return null;
  if (b.canSpend === undefined && b.organizationIds === undefined) return null;
  return { id: b.id, canSpend: b.canSpend as boolean | undefined, organizationIds: b.organizationIds as string[] | undefined };
}

/**
 * Change one key's payment authority, as its signed-in owner. `db` is the
 * owner's own session, so RLS limits the read and write to their keys; the
 * organization check here keeps a key from naming someone else's organization.
 */
export async function updateKeyAuthority(db: SupabaseClient, profileId: string, request: GrantRequest) {
  const { data: key, error } = await db.from("agent_api_keys").select(KEY_AUTHORITY_COLUMNS).eq("id", request.id).eq("profile_id", profileId).is("revoked_at", null).maybeSingle();
  if (error || !key) throw new KeyGrantError(404, "Active key not found for this account");
  const { data: orgs, error: orgError } = await db.from("organizations").select("id").eq("owner_id", profileId);
  if (orgError) throw new KeyGrantError(503, "Could not read your organizations");
  const owned = (orgs ?? []).map((o) => String((o as { id: string }).id));
  const current = key as KeyAuthority;
  let patch: Record<string, unknown> = {};
  let organizations = list(current.organization_ids);
  if (request.organizationIds !== undefined) {
    organizations = [...new Set(request.organizationIds)];
    if (organizations.some((id) => !owned.includes(id))) throw new KeyGrantError(400, "You can only grant organizations you own");
    patch.organization_ids = organizations;
  }
  if (request.canSpend !== undefined) {
    // Default to every owned organization only when the owner did not choose any.
    patch = { ...patch, ...paymentGrant({ ...current, organization_ids: organizations }, request.canSpend, request.organizationIds === undefined ? owned : []) };
  }
  const { data, error: saveError } = await db.from("agent_api_keys").update(patch).eq("id", request.id).eq("profile_id", profileId).is("revoked_at", null).select(KEY_AUTHORITY_COLUMNS).maybeSingle();
  if (saveError || !data) throw new KeyGrantError(404, "Active key not found for this account");
  return data as KeyAuthority & { id: string; name: string };
}
