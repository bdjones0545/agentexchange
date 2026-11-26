import { useState, type FormEvent } from "react";

import { setListingListed, updateOwnListing } from "../lib/repositories/ownerManagement";
import type { CreatedAgent } from "../state/marketplaceTypes";
import { GlassCard } from "./GlassCard";
import { PrimaryButton } from "./PrimaryButton";
import { SecondaryButton } from "./SecondaryButton";

const list = (value: string) => value.split(",").map((s) => s.trim()).filter(Boolean);

export function listingStatusText(agent: Pick<CreatedAgent, "listed" | "moderationStatus">): string {
  if (agent.listed === false) return "Unlisted: hidden from buyers and search. List it again any time; no new review.";
  if (agent.moderationStatus === "pending") return "Waiting for review: buyers see it once the platform approves it.";
  if (agent.moderationStatus === "rejected") return "Not approved: it stays private. Edit it to send it for review again.";
  return "Public on the marketplace.";
}

/** The seller's controls for one listing: edit (back to review when public text changes) and unlist/relist (instant). */
export function OwnerListingPanel({ agent, onChanged }: { agent: CreatedAgent; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({
    name: agent.name, specialty: agent.specialty, description: agent.description, skills: (agent.customSkills ?? []).join(", "),
    startingRate: agent.startingRate, toolAccess: (agent.toolAccess ?? []).join(", "), availability: agent.availability ?? "Available",
  });
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      const review = await updateOwnListing(agent.id, {
        name: form.name.trim(), specialty: form.specialty.trim(), description: form.description.trim(), skills: list(form.skills),
        startingRate: form.startingRate.trim(), toolAccess: list(form.toolAccess), availability: form.availability,
      });
      setEditing(false);
      setNote({ tone: "ok", text: review === "pending" ? "Saved. The listing went back for review and is hidden until approved." : "Saved." });
      onChanged();
    } catch (e) {
      setNote({ tone: "error", text: e instanceof Error ? e.message : "Could not save the listing." });
    } finally {
      setBusy(false);
    }
  }

  async function toggleListed() {
    setBusy(true);
    setNote(null);
    try {
      await setListingListed(agent.id, agent.listed === false);
      setNote({ tone: "ok", text: agent.listed === false ? "Listed again." : "Unlisted." });
      onChanged();
    } catch (e) {
      setNote({ tone: "error", text: e instanceof Error ? e.message : "Could not change the listing." });
    } finally {
      setBusy(false);
    }
  }

  const field = "ax-input";
  return (
    <GlassCard className="space-y-3 p-5" data-testid="owner-listing-panel">
      <h3 className="font-semibold text-ae-text">Your listing</h3>
      <p className={`text-sm leading-6 ${agent.listed === false || agent.moderationStatus !== "approved" ? "text-ae-amber" : "text-ae-text-muted"}`}>{listingStatusText(agent)}</p>
      {!editing ? (
        <div className="flex flex-wrap gap-3">
          <SecondaryButton className="px-4 py-2" disabled={busy} onClick={() => setEditing(true)}>Edit listing</SecondaryButton>
          <SecondaryButton className="px-4 py-2" disabled={busy} onClick={() => void toggleListed()}>{agent.listed === false ? "List again" : "Unlist"}</SecondaryButton>
        </div>
      ) : (
        <form className="space-y-2.5" onSubmit={(e) => void save(e)}>
          <input aria-label="Agent name" className={field} maxLength={80} value={form.name} onChange={(e) => set("name")(e.target.value)} />
          <input aria-label="Specialty" className={field} maxLength={120} value={form.specialty} onChange={(e) => set("specialty")(e.target.value)} />
          <textarea aria-label="Description" className={`${field} min-h-28`} maxLength={2000} value={form.description} onChange={(e) => set("description")(e.target.value)} />
          <input aria-label="Skills, comma separated" className={field} value={form.skills} onChange={(e) => set("skills")(e.target.value)} placeholder="Skills, comma separated" />
          <input aria-label="Starting rate" className={field} maxLength={60} value={form.startingRate} onChange={(e) => set("startingRate")(e.target.value)} />
          <input aria-label="Tools, comma separated" className={field} value={form.toolAccess} onChange={(e) => set("toolAccess")(e.target.value)} placeholder="Tools, comma separated" />
          <select aria-label="Availability" className={field} value={form.availability} onChange={(e) => set("availability")(e.target.value)}>
            <option>Available</option><option>Limited</option><option>Unavailable</option>
          </select>
          <p className="text-xs leading-5 text-ae-text-muted">Changing what buyers read sends the listing back for review; it is hidden until approved.</p>
          <div className="flex gap-3">
            <PrimaryButton className="px-4 py-2" disabled={busy || form.name.trim().length < 2 || form.specialty.trim().length < 2} type="submit">Save</PrimaryButton>
            <SecondaryButton className="px-4 py-2" disabled={busy} onClick={() => setEditing(false)}>Cancel</SecondaryButton>
          </div>
        </form>
      )}
      {note ? <p role={note.tone === "error" ? "alert" : "status"} className={`text-xs ${note.tone === "error" ? "text-ae-error" : "text-ae-emerald"}`}>{note.text}</p> : null}
    </GlassCard>
  );
}
