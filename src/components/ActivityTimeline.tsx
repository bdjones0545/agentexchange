import type { ActivityEvent } from "../data/operations";
import { accentStyles } from "./accentStyles";
import { GlassCard } from "./GlassCard";

type ActivityTimelineProps = {
  events: ActivityEvent[];
};

export function ActivityTimeline({ events }: ActivityTimelineProps) {
  return (
    <GlassCard className="space-y-5">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
          Activity Timeline
        </p>
        <h2 className="mt-2 font-ae-display text-3xl font-semibold text-ae-text">
          Operational events
        </h2>
      </div>

      <div className="space-y-4">
        {events.map((event, index) => {
          const accent = accentStyles[event.accent];
          const isLast = index === events.length - 1;

          return (
            <article className="grid grid-cols-[auto_1fr] gap-4" key={event.id}>
              <div className="flex flex-col items-center">
                <span
                  className={`mt-1 size-3 rounded-full ${accent.dot} ${accent.glow}`}
                />
                {!isLast ? (
                  <span className="mt-2 h-full min-h-16 w-px bg-white/[0.08]" />
                ) : null}
              </div>
              <div className="rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span
                    className={`w-fit rounded-full border px-3 py-1 font-ae-label text-xs font-semibold ${accent.badge}`}
                  >
                    {event.type}
                  </span>
                  <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.08em] text-ae-text-muted">
                    {event.timestamp}
                  </span>
                </div>
                <h3 className="mt-3 font-ae-display text-xl font-semibold text-ae-text">
                  {event.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-ae-text-muted">
                  {event.detail}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </GlassCard>
  );
}
