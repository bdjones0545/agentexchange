import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { fetchModerationQueue } from "../lib/moderation";

/**
 * For the platform owner only (everyone else gets a 404 from /api/moderation and
 * sees nothing): new seller listings stay hidden until reviewed, and nothing
 * else says they are waiting.
 */
export function OwnerReviewNotice() {
  const [waiting, setWaiting] = useState<{ count: number; oldest: string | null } | null>(null);

  useEffect(() => {
    let live = true;
    void fetchModerationQueue().then((r) => {
      if (!live || r.state !== "ok" || r.queue.pending.length === 0) return;
      setWaiting({ count: r.queue.pending.length, oldest: r.queue.pending[0]?.createdAt ?? null });
    });
    return () => { live = false; };
  }, []);

  if (!waiting) return null;
  const days = waiting.oldest ? Math.floor((Date.now() - new Date(waiting.oldest).getTime()) / 86_400_000) : null;
  return (
    <Link
      to="/owner/moderation"
      data-testid="owner-review-notice"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ae-amber/30 bg-ae-amber/[0.08] px-5 py-4 text-sm text-ae-amber transition hover:border-ae-amber/50"
    >
      <span>
        <span className="font-semibold">{waiting.count} seller {waiting.count === 1 ? "listing is" : "listings are"} waiting for your review.</span>{" "}
        {days !== null && days > 0 ? `The oldest has waited ${days} ${days === 1 ? "day" : "days"}. ` : ""}Buyers can't see them until you approve.
      </span>
      <span className="font-semibold">Review now →</span>
    </Link>
  );
}
