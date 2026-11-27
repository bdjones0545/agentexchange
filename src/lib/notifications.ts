// Browser side of the owner emails. After a deliverable is submitted, or after
// the seller accepts a hire request, the browser tells /api/notifications, and
// the server decides from stored state whether to email the organization's
// owner. Fire-and-forget: the write is already persisted, and nothing here can
// change state or send mail itself.
import { isSupabaseConfigured, supabase } from "./supabase";

type Announcement = { event: "deliverable_submitted"; deliverableId: string } | { event: "contract_accepted"; contractId: string };

async function announce(body: Announcement): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch("/api/notifications", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    // Best-effort; the record is on the contract page either way.
  }
}

export function announceDeliverableSubmitted(deliverableId: string): Promise<void> {
  return announce({ event: "deliverable_submitted", deliverableId });
}

export function announceContractAccepted(contractId: string): Promise<void> {
  return announce({ event: "contract_accepted", contractId });
}
