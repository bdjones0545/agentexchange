// The signed-in account's own data.
//   GET    /api/account              download what AgentExchange holds for this account (a JSON file)
//   DELETE /api/account {confirm}    delete the account now, or queue it for a review when
//                                    marketplace or billing records have to be kept
// "Forgot password" and "change email" need no route here: Supabase Auth sends
// those emails straight from the browser (src/lib/auth.ts).
import { buildAccountExport, EXPORT_MAX_BYTES, exportFileName } from "../server/accountExport.js";
import { confirmationMatches, deleteAccount, DeletionError, supabaseDeletionStore } from "../server/accountDeletion.js";
import { bearerToken, callerProfile } from "../server/caller.js";
import { readServerEnv } from "../server/config.js";
import { serviceClient, serviceRoleConfigured } from "../server/service.js";
import { supportEmail } from "../src/content/publicRoutes.js";

const NO_STORE = { "cache-control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });
const unauthorized = () => Response.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: { ...NO_STORE, "www-authenticate": "Bearer" } });

async function caller(request: Request) {
  const env = readServerEnv();
  const token = bearerToken(request);
  if (!env || !token) return null;
  return callerProfile(env, token);
}

export async function GET(request: Request): Promise<Response> {
  const who = await caller(request);
  if (!who) return unauthorized();
  try {
    const service = serviceRoleConfigured() ? serviceClient() : null;
    const file = await buildAccountExport({ client: who.client, service, user: who.user, profileId: who.profileId });
    const body = JSON.stringify(file, null, 2);
    if (new TextEncoder().encode(body).length > EXPORT_MAX_BYTES) {
      return json({ ok: false, error: `Your data is too large to download here. Email ${supportEmail} and we will send you a full copy.` }, 413);
    }
    return new Response(body, {
      headers: {
        ...NO_STORE,
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${exportFileName(file.exported_at)}"`,
      },
    });
  } catch (e) {
    console.error(JSON.stringify({ event: "account_export", ok: false, reason: e instanceof Error ? e.name : "unknown" }));
    return json({ ok: false, error: "Could not prepare your data. Try again in a few minutes." }, 500);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const who = await caller(request);
  if (!who) return unauthorized();
  let body: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = await request.json();
    body = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    body = null;
  }
  if (!confirmationMatches(body?.confirm, who.email)) {
    return json({ ok: false, error: who.email ? "Type your account email exactly to confirm." : "Type DELETE to confirm." }, 400);
  }
  if (!serviceRoleConfigured()) {
    return json({ ok: false, error: `Account deletion is unavailable right now. Email ${supportEmail} to delete your account.` }, 503);
  }
  try {
    const outcome = await deleteAccount(supabaseDeletionStore(serviceClient()), who);
    console.info(JSON.stringify({ event: "account_deletion", ok: true, outcome: outcome.status }));
    return outcome.status === "deleted" ? json({ ok: true, status: "deleted" }) : json({ ok: true, status: "requested", request: outcome.request }, 202);
  } catch (e) {
    const status = e instanceof DeletionError ? e.status : 500;
    console.error(JSON.stringify({ event: "account_deletion", ok: false, status }));
    return json({ ok: false, error: e instanceof DeletionError ? e.message : "Account deletion failed. Nothing was deleted." }, status);
  }
}
