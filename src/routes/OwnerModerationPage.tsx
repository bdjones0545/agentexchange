import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { AuthRequiredNotice } from "../components/AuthRequiredNotice";
import { GlassCard } from "../components/GlassCard";
import { PageHeader } from "../components/PageHeader";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { decide, fetchModerationQueue, type QueueItem, type QueueResult } from "../lib/moderation";
import { useAuth } from "../state/AuthContext";

function Listing({ item, busy, onDecide }: { item: QueueItem; busy: boolean; onDecide: (decision: "approve" | "reject") => void }) {
  return (
    <GlassCard className="space-y-3 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-ae-display text-xl font-semibold tracking-tight text-ae-text">{item.name}</h3>
          <p className="mt-1 text-sm text-ae-text-muted">{item.specialty}</p>
        </div>
        {item.startingRate ? <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1 text-xs font-semibold text-ae-text">{item.startingRate}</span> : null}
      </div>
      <p className="text-xs text-ae-text-muted">
        By {item.owner} · listed {new Date(item.createdAt).toLocaleDateString()}
        {item.updatedAt && item.updatedAt !== item.createdAt ? ` · edited ${new Date(item.updatedAt).toLocaleDateString()}` : ""}
      </p>
      {item.description ? <p className="whitespace-pre-line text-sm leading-6 text-ae-text/85">{item.description}</p> : <p className="text-sm italic text-ae-text-muted">No description.</p>}
      {item.skills.length || item.jobKinds.length ? (
        <p className="text-xs text-ae-text-muted">{[...item.jobKinds, ...item.skills].join(" · ")}</p>
      ) : null}
      <div className="flex flex-wrap gap-3 pt-1">
        <PrimaryButton disabled={busy} onClick={() => onDecide("approve")}>
          {item.status === "rejected" ? "Approve after all" : "Approve and publish"}
        </PrimaryButton>
        {item.status === "pending" ? (
          <SecondaryButton disabled={busy} onClick={() => onDecide("reject")}>Reject</SecondaryButton>
        ) : null}
      </div>
    </GlassCard>
  );
}

export function OwnerModerationPage() {
  const { loading: authLoading, session, isSupabaseEnabled } = useAuth();
  const [result, setResult] = useState<QueueResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const token = session?.access_token;

  const load = useCallback(async () => setResult(await fetchModerationQueue()), []);
  useEffect(() => {
    if (authLoading || !token) return;
    void load();
  }, [authLoading, token, load]);

  async function onDecide(item: QueueItem, decision: "approve" | "reject") {
    setBusy(item.id);
    setNotice(null);
    const r = await decide(item.id, decision);
    setNotice(r.ok ? `${item.name} ${decision === "approve" ? "is now public" : "was rejected and stays private"}.` : r.message);
    await load();
    setBusy(null);
  }

  const queue = result?.state === "ok" ? result.queue : null;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Platform owner"
        title="Listing review"
        description="New agent listings stay private until you approve them, and a listing goes back here when its seller edits its name, description, price or skills. Approve to publish it on the marketplace; reject to keep it private."
      />
      <p className="text-sm">
        <Link className="font-semibold text-ae-primary underline decoration-ae-primary/40 underline-offset-4" to="/owner/revenue">Platform revenue</Link>
      </p>

      {!isSupabaseEnabled ? (
        <GlassCard><p className="text-sm text-ae-text-muted">Listing review needs the live database; this build runs in local demo mode.</p></GlassCard>
      ) : authLoading ? null : !token || result?.state === "signed-out" ? (
        <AuthRequiredNotice action="review listings" />
      ) : result === null ? (
        <p className="text-sm text-ae-text-muted">Loading listings…</p>
      ) : result.state === "not-owner" ? (
        <GlassCard>
          <p className="text-sm leading-6 text-ae-text-muted">
            This page isn't available for your account. <Link className="font-semibold text-ae-primary underline decoration-ae-primary/40 underline-offset-4" to="/agents">Browse agents</Link>
          </p>
        </GlassCard>
      ) : result.state === "error" ? (
        <GlassCard><p className="text-sm text-ae-text-muted">{result.message}</p></GlassCard>
      ) : queue ? (
        <>
          {notice ? <p role="status" className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-sm text-ae-text">{notice}</p> : null}
          <section aria-label="Waiting for review" className="space-y-4">
            <h2 className="font-ae-display text-2xl font-semibold tracking-tight text-ae-text">Waiting for review ({queue.pending.length})</h2>
            {queue.pending.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.12] px-5 py-10 text-center text-sm leading-6 text-ae-text-muted">Nothing to review. New listings appear here.</div>
            ) : (
              queue.pending.map((item) => <Listing busy={busy === item.id} item={item} key={item.id} onDecide={(d) => void onDecide(item, d)} />)
            )}
          </section>
          {queue.rejected.length ? (
            <section aria-label="Rejected" className="space-y-4">
              <h2 className="font-ae-display text-2xl font-semibold tracking-tight text-ae-text">Rejected ({queue.rejected.length})</h2>
              {queue.rejected.map((item) => <Listing busy={busy === item.id} item={item} key={item.id} onDecide={(d) => void onDecide(item, d)} />)}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
