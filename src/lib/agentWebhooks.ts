// The owner's side of agent webhooks (api/agent-webhooks.ts).
import { supabase } from "./supabase";

export type KeyWebhook = {
  keyId: string;
  url: string;
  events: string[];
  createdAt: string;
  disabledAt: string | null;
  disabledReason: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastStatus: number | null;
};

async function call(method: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  if (!supabase) return { ok: false, data: { error: "Not configured" } };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, data: { error: "Sign in again" } };
  const res = await fetch("/api/agent-webhooks", {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: Record<string, unknown> = {};
  try { json = (await res.json()) as Record<string, unknown>; } catch { json = {}; }
  return { ok: res.ok && json.ok !== false, data: json };
}

export async function listWebhooks(): Promise<KeyWebhook[]> {
  const r = await call("GET");
  return r.ok ? ((r.data.webhooks as KeyWebhook[]) ?? []) : [];
}

export async function saveWebhook(keyId: string, url: string): Promise<{ webhook?: KeyWebhook; secret?: string; error?: string }> {
  const r = await call("PUT", { keyId, url });
  if (!r.ok) return { error: String(r.data.error ?? "Could not save the webhook") };
  return { webhook: r.data.webhook as KeyWebhook, secret: String(r.data.secret) };
}

export async function deleteWebhook(keyId: string): Promise<{ error?: string }> {
  const r = await call("DELETE", { keyId });
  return r.ok ? {} : { error: String(r.data.error ?? "Could not remove the webhook") };
}

export async function testWebhook(keyId: string): Promise<{ delivered: boolean; status: number | null; error?: string }> {
  const r = await call("POST", { keyId, action: "test" });
  if (!r.ok) return { delivered: false, status: null, error: String(r.data.error ?? "Could not send the test event") };
  return { delivered: Boolean(r.data.delivered), status: (r.data.status as number | null) ?? null };
}

/** One line about the webhook's health, for the key list. */
export function webhookHealth(w: KeyWebhook): string {
  if (w.disabledAt) return `Switched off ${new Date(w.disabledAt).toLocaleString()}: ${w.disabledReason ?? "deliveries kept failing"}`;
  const success = w.lastSuccessAt ? Date.parse(w.lastSuccessAt) : 0;
  const failure = w.lastFailureAt ? Date.parse(w.lastFailureAt) : 0;
  if (failure > success) return `Last delivery failed ${new Date(failure).toLocaleString()}${w.lastStatus ? ` (HTTP ${w.lastStatus})` : ""}; retrying`;
  if (success) return `Last delivered ${new Date(success).toLocaleString()}`;
  return "No events delivered yet";
}
