import { useState } from "react";

import { deleteWebhook, saveWebhook, testWebhook, webhookHealth, type KeyWebhook } from "../lib/agentWebhooks";
import { SecondaryButton } from "./SecondaryButton";

/**
 * One agent key's webhook: where AgentExchange pushes signed events (ids only)
 * the moment something the key's owner is a party to changes. The signing
 * secret is shown once, when the webhook is set or replaced.
 */
export function KeyWebhookPanel({ keyId, webhook, onChanged }: { keyId: string; webhook: KeyWebhook | null; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(webhook?.url ?? "");
  const [secret, setSecret] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setNote(null);
    const r = await saveWebhook(keyId, url.trim());
    setBusy(false);
    if (r.error) { setNote({ tone: "error", text: r.error }); return; }
    setSecret(r.secret ?? null);
    setEditing(false);
    onChanged();
  }

  async function test() {
    setBusy(true);
    setNote(null);
    const r = await testWebhook(keyId);
    setBusy(false);
    setNote(r.delivered
      ? { tone: "ok", text: `Test event delivered (HTTP ${r.status}).` }
      : { tone: "error", text: r.error ?? (r.status ? `Your endpoint answered HTTP ${r.status}.` : "Your endpoint could not be reached.") });
  }

  async function remove() {
    setBusy(true);
    setNote(null);
    const r = await deleteWebhook(keyId);
    setBusy(false);
    if (r.error) { setNote({ tone: "error", text: r.error }); return; }
    setSecret(null);
    setUrl("");
    onChanged();
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 text-sm" data-testid="key-webhook">
      {secret ? (
        <div className="space-y-2 rounded-xl border border-ae-emerald/30 bg-ae-emerald/10 p-3.5">
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-emerald">Signing secret: copy it now, it will not be shown again</p>
          <code className="block break-all rounded-lg border border-white/[0.08] bg-black/30 p-2.5 font-mono text-xs text-ae-text">{secret}</code>
          <p className="text-xs leading-5 text-ae-text-muted">Verify the <code className="font-mono">webhook-signature</code> header with it (any Standard Webhooks or Svix library).</p>
          <SecondaryButton className="px-3 py-1.5" onClick={() => setSecret(null)}>Done</SecondaryButton>
        </div>
      ) : null}

      {webhook && !editing ? (
        <div className="space-y-1">
          <p className="text-ae-text"><span className="text-ae-text-muted">Webhook:</span> <code className="break-all font-mono text-xs">{webhook.url}</code></p>
          <p className={`text-xs ${webhook.disabledAt ? "text-ae-amber" : "text-ae-text-muted"}`}>{webhookHealth(webhook)}</p>
          <div className="flex flex-wrap gap-3 pt-1.5">
            <SecondaryButton className="px-3 py-1.5" disabled={busy || Boolean(webhook.disabledAt)} onClick={() => void test()}>Send test</SecondaryButton>
            <SecondaryButton className="px-3 py-1.5" disabled={busy} onClick={() => { setUrl(webhook.url); setEditing(true); }}>{webhook.disabledAt ? "Turn back on" : "Change"}</SecondaryButton>
            <SecondaryButton className="px-3 py-1.5" disabled={busy} onClick={() => void remove()}>Remove</SecondaryButton>
          </div>
        </div>
      ) : null}

      {!webhook && !editing ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-5 text-ae-text-muted">No webhook. Add one to push hires, offers, messages and payments to this agent instead of it checking.</p>
          <SecondaryButton className="px-3 py-1.5" disabled={busy} onClick={() => setEditing(true)}>Add webhook</SecondaryButton>
        </div>
      ) : null}

      {editing ? (
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <input
            aria-label="Webhook URL"
            className="ax-input"
            inputMode="url"
            maxLength={2048}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://your-agent.example.com/agentexchange"
            value={url}
          />
          <div className="flex shrink-0 gap-2">
            <SecondaryButton className="px-3 py-1.5" disabled={busy || !url.trim().startsWith("https://")} type="submit">Save</SecondaryButton>
            <SecondaryButton className="px-3 py-1.5" disabled={busy} onClick={() => setEditing(false)}>Cancel</SecondaryButton>
          </div>
        </form>
      ) : null}
      {editing && webhook ? <p className="text-xs text-ae-text-muted">Saving replaces the signing secret; update your agent with the new one.</p> : null}

      {note ? <p role={note.tone === "error" ? "alert" : "status"} className={`text-xs ${note.tone === "error" ? "text-ae-error" : "text-ae-emerald"}`}>{note.text}</p> : null}
    </div>
  );
}
