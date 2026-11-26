import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { fetchModerationQueue, type ModerationQueue } from "../lib/moderation";

/** The lines the notice shows, or none when nothing waits on the owner. */
export function reviewNoticeLines(queue: ModerationQueue, now = Date.now()): string[] {
  const lines: string[] = [];
  if (queue.pending.length) {
    const oldest = queue.pending[0]?.createdAt;
    const days = oldest ? Math.floor((now - new Date(oldest).getTime()) / 86_400_000) : 0;
    lines.push(`${queue.pending.length} seller ${queue.pending.length === 1 ? "listing is" : "listings are"} waiting for review${days > 0 ? ` (oldest ${days} ${days === 1 ? "day" : "days"})` : ""}; buyers can't see them until you approve.`);
  }
  const due = queue.disputes.filter((d) => d.dueForReview).length;
  if (due) lines.push(`${due} ${due === 1 ? "dispute has" : "disputes have"} been quiet for 7 days and ${due === 1 ? "is" : "are"} due for your review.`);
  const deletions = queue.deletionRequests.filter((d) => d.status !== "completed").length;
  if (deletions) lines.push(`${deletions} account deletion ${deletions === 1 ? "request needs" : "requests need"} a person.`);
  return lines;
}

/**
 * For the platform owner only (everyone else gets a 404 from /api/moderation and
 * sees nothing): listings, stalled disputes and deletion requests wait on the
 * owner, and nothing else says so.
 */
export function OwnerReviewNotice() {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    void fetchModerationQueue().then((r) => {
      if (live && r.state === "ok") setLines(reviewNoticeLines(r.queue));
    });
    return () => { live = false; };
  }, []);

  if (!lines.length) return null;
  return (
    <Link
      to="/owner/moderation"
      data-testid="owner-review-notice"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ae-amber/30 bg-ae-amber/[0.08] px-5 py-4 text-sm text-ae-amber transition hover:border-ae-amber/50"
    >
      <span className="space-y-1">
        {lines.map((line) => <span className="block" key={line}>{line}</span>)}
      </span>
      <span className="font-semibold">Review now →</span>
    </Link>
  );
}
