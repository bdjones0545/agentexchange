// Browser side of the Hermes worker integration.
//
// `notifyWorkers` tells the product that something happened on a hire request
// or contract; the product (api/dispatch) decides which workers are parties
// and pokes their runtimes. It is fire-and-forget on purpose: the marketplace
// state is already persisted by the time this runs, and a worker that is down
// simply reads the same truth later. Nothing here can change state.
import { isSupabaseConfigured, supabase } from "./supabase";

export type WorkerEvent =
  | { event: "hire_request"; hireRequestId: string }
  | { event: "contract_created"; contractId: string }
  | { event: "message"; contractId: string }
  | { event: "deliverable_decision"; contractId: string };

export type WorkerInfo = {
  name: string;
  profileId: string | null;
  runtime: boolean;
};

export async function fetchWorkers(): Promise<WorkerInfo[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const res = await fetch("/api/workers", { headers: { accept: "application/json" } });
    if (!res.ok) return [];
    const data = (await res.json()) as { workers?: WorkerInfo[] };
    return Array.isArray(data.workers) ? data.workers : [];
  } catch {
    return [];
  }
}

export async function notifyWorkers(event: WorkerEvent): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch("/api/dispatch", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    });
  } catch {
    // Dispatch is best-effort; the worker will find the work on its next look.
  }
}
