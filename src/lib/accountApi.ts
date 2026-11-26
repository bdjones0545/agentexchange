// Browser side of /api/account: download my data, delete my account, and the
// owner-readable deletion request (account_deletion_requests, RLS: own row only).
import { supabase } from "./supabase";

export interface DeletionRequest {
  status: string;
  requested_at: string;
  updated_at: string | null;
  response: string;
}

export type DeleteResult = { status: "deleted" } | { status: "requested"; request: DeletionRequest };

async function accessToken(): Promise<string> {
  if (!supabase) throw new Error("Your account is unavailable right now.");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in again to continue.");
  return token;
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error) return body.error;
  } catch {
    // Not JSON (a platform error page): use the fallback.
  }
  return res.status === 401 ? "Sign in again to continue." : fallback;
}

/** The file name from Content-Disposition, or a dated default. */
export function downloadName(disposition: string | null, today = new Date()): string {
  const match = /filename="([^"]+)"/.exec(disposition ?? "");
  const name = match?.[1] ?? "";
  return /^[\w.-]+\.json$/.test(name) ? name : `agentexchange-data-${today.toISOString().slice(0, 10)}.json`;
}

/** Fetches the export and hands it to the browser as a download. */
export async function downloadAccountData(): Promise<string> {
  const res = await fetch("/api/account", { headers: { authorization: `Bearer ${await accessToken()}` } });
  if (!res.ok) throw new Error(await errorMessage(res, "Could not prepare your data. Try again in a few minutes."));
  const blob = await res.blob();
  const name = downloadName(res.headers.get("content-disposition"));
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Give the browser a moment to start the download before the URL goes away.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  return name;
}

export async function deleteAccount(confirm: string): Promise<DeleteResult> {
  const res = await fetch("/api/account", {
    method: "DELETE",
    headers: { authorization: `Bearer ${await accessToken()}`, "content-type": "application/json" },
    body: JSON.stringify({ confirm }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Account deletion failed. Nothing was deleted."));
  const body = (await res.json()) as { status?: unknown; request?: DeletionRequest };
  if (body.status === "deleted") return { status: "deleted" };
  if (body.status === "requested" && body.request) return { status: "requested", request: body.request };
  throw new Error("Account deletion failed. Nothing was deleted.");
}

export async function loadDeletionRequest(userId: string): Promise<DeletionRequest | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("account_deletion_requests")
    .select("status,requested_at,updated_at,response")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return (data as DeletionRequest | null) ?? null;
}

/** Ends this browser's session without calling Auth (the account may no longer exist). */
export async function endLocalSession() {
  if (!supabase) return;
  await supabase.auth.signOut({ scope: "local" });
}
