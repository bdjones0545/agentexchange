import { useState, type FormEvent } from "react";

import { setBriefOpen, updateOwnBrief } from "../lib/repositories/ownerManagement";
import type { CreatedOpportunity } from "../state/marketplaceTypes";
import { GlassCard } from "./GlassCard";
import { PrimaryButton } from "./PrimaryButton";
import { SecondaryButton } from "./SecondaryButton";

const list = (value: string) => value.split(",").map((s) => s.trim()).filter(Boolean);

/** The poster's controls for one brief: edit while open, close (declining pending proposals) and reopen. */
export function OwnerBriefPanel({ brief, onChanged }: { brief: CreatedOpportunity; onChanged: () => void }) {
  const closed = brief.status === "closed";
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({
    title: brief.title, description: brief.summary ?? "", successCriteria: brief.successCriteria ?? "", budget: brief.budget ?? "",
    duration: brief.duration ?? "", category: brief.category ?? "", requiredSkills: (brief.requiredSkills ?? []).join(", "),
  });
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      await updateOwnBrief(brief.id, {
        title: form.title.trim(), description: form.description.trim(), successCriteria: form.successCriteria.trim(), budget: form.budget.trim(),
        duration: form.duration.trim(), category: form.category.trim(), requiredSkills: list(form.requiredSkills),
      });
      setEditing(false);
      setNote({ tone: "ok", text: "Saved. Agents who applied see the new version; contracts already made keep their terms." });
      onChanged();
    } catch (e) {
      setNote({ tone: "error", text: e instanceof Error ? e.message : "Could not save the brief." });
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    setBusy(true);
    setNote(null);
    try {
      const r = await setBriefOpen(brief.id, closed);
      setNote({ tone: "ok", text: closed ? "Reopened: agents can apply again." : `Closed.${r.declined ? ` ${r.declined} pending proposal${r.declined === 1 ? " was" : "s were"} declined and their agents told.` : ""}` });
      onChanged();
    } catch (e) {
      setNote({ tone: "error", text: e instanceof Error ? e.message : "Could not change the brief." });
    } finally {
      setBusy(false);
    }
  }

  const field = "ax-input";
  return (
    <GlassCard className="space-y-3 p-6" data-testid="owner-brief-panel">
      <h2 className="font-ae-display text-lg font-semibold text-ae-text">Your brief</h2>
      <p className={`text-sm leading-6 ${closed ? "text-ae-amber" : "text-ae-text-muted"}`}>
        {closed ? "Closed: off the marketplace and not taking applications." : "Open: on the marketplace and taking applications."}
      </p>
      {!editing ? (
        <div className="flex flex-wrap gap-3">
          {!closed ? <SecondaryButton className="px-4 py-2" disabled={busy} onClick={() => setEditing(true)}>Edit brief</SecondaryButton> : null}
          <SecondaryButton className="px-4 py-2" disabled={busy} onClick={() => void toggle()}>{closed ? "Reopen brief" : "Close brief"}</SecondaryButton>
        </div>
      ) : (
        <form className="space-y-2.5" onSubmit={(e) => void save(e)}>
          <input aria-label="Title" className={field} maxLength={160} value={form.title} onChange={(e) => set("title")(e.target.value)} />
          <textarea aria-label="Description" className={`${field} min-h-40`} maxLength={8000} value={form.description} onChange={(e) => set("description")(e.target.value)} />
          <textarea aria-label="Success criteria" className={`${field} min-h-24`} maxLength={4000} value={form.successCriteria} onChange={(e) => set("successCriteria")(e.target.value)} placeholder="How you will judge the delivery" />
          <div className="grid gap-2.5 sm:grid-cols-3">
            <input aria-label="Budget" className={field} maxLength={80} value={form.budget} onChange={(e) => set("budget")(e.target.value)} placeholder="Budget" />
            <input aria-label="Timing" className={field} maxLength={80} value={form.duration} onChange={(e) => set("duration")(e.target.value)} placeholder="Timing" />
            <input aria-label="Category" className={field} maxLength={80} value={form.category} onChange={(e) => set("category")(e.target.value)} placeholder="Category" />
          </div>
          <input aria-label="Skills, comma separated" className={field} value={form.requiredSkills} onChange={(e) => set("requiredSkills")(e.target.value)} placeholder="Skills, comma separated" />
          <div className="flex gap-3">
            <PrimaryButton className="px-4 py-2" disabled={busy || form.title.trim().length < 4 || form.description.trim().length < 20} type="submit">Save</PrimaryButton>
            <SecondaryButton className="px-4 py-2" disabled={busy} onClick={() => setEditing(false)}>Cancel</SecondaryButton>
          </div>
        </form>
      )}
      {note ? <p role={note.tone === "error" ? "alert" : "status"} className={`text-xs ${note.tone === "error" ? "text-ae-error" : "text-ae-emerald"}`}>{note.text}</p> : null}
    </GlassCard>
  );
}
