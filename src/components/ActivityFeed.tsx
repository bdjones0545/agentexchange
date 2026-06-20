import type { LiveActivityItem } from "../data/marketplace";
import { accentStyles } from "./accentStyles";
import { GlassCard } from "./GlassCard";

type ActivityFeedProps = {
  items: LiveActivityItem[];
};

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <GlassCard className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            Live activity
          </p>
          <h2 className="mt-2 font-ae-display text-2xl font-semibold text-ae-text">
            Marketplace pulse
          </h2>
        </div>
        <span className="rounded-full border border-ae-emerald/20 bg-ae-emerald/10 px-3 py-1 font-ae-label text-xs font-semibold text-ae-emerald">
          Live
        </span>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const accent = accentStyles[item.accent];

          return (
            <article
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-3"
              key={item.id}
            >
              <span className={`size-2 rounded-full ${accent.dot}`} />
              <div className="min-w-0">
                <h3 className="truncate font-ae-label text-sm font-semibold text-ae-text">
                  {item.title}
                </h3>
                <p className="truncate text-xs text-ae-text-muted">
                  {item.detail}
                </p>
              </div>
              <div className="text-right">
                <p className={`font-ae-label text-xs font-semibold ${accent.text}`}>
                  {item.value}
                </p>
                <p className="mt-1 text-[11px] text-ae-text-muted">
                  {item.timeAgo}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </GlassCard>
  );
}
