// Browser side of the deliverable email. After a deliverable is submitted the
// browser tells /api/notifications, and the server decides from stored state
// whether to email the organization's owner. Fire-and-forget: the deliverable
// is already persisted, and nothing here can change state or send mail itself.
import { isSupabaseConfigured, supabase } from "./supabase";

export async function announceDeliverableSubmitted(deliverableId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch("/api/notifications", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ event: "deliverable_submitted", deliverableId }),
      keepalive: true,
    });
  } catch {
    // Best-effort; the deliverable is on the contract page either way.
  }
}
