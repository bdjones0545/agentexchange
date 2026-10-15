import type { ActivityEvent } from "../data/operations";
import { accentStyles } from "./accentStyles";
import { GlassCard } from "./GlassCard";

type ActivityTimelineProps = {
  events: ActivityEvent[];
};

export function ActivityTimeline({ events }: ActivityTimelineProps) {
  return (
    <GlassCard className="space-y-6 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
            Activity Timeline
          </p>
          <h2 className="mt-2 font-ae-display text-2xl font-semibold tracking-tight text-ae-text">
            Recent activity
          </h2>
        </div>
        {events.length > 0 ? (
          <span className="font-ae-label text-xs text-ae-text-muted">
            {events.length} {events.length === 1 ? "event" : "events"}
          </span>
        ) : null}
      </div>

      {events.length > 0 ? (
        <ol>
          {events.map((event, index) => {
            const accent = accentStyles[event.accent] ?? accentStyles.violet;
            const isLast = index === events.length - 1;

            return (
              <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-4" key={event.id}>
                <div aria-hidden className="flex flex-col items-center">
                  <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-white/[0.04] ${accent.dot}`} />
                  {!isLast ? <span className="mt-2 w-px flex-1 bg-gradient-to-b from-white/[0.12] to-white/[0.04]" /> : null}
                </div>
                <div className={`min-w-0 ${isLast ? "" : "pb-6"}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 font-ae-label text-[11px] font-semibold ${accent.badge}`}>
                      {event.type}
                    </span>
                    <span className="font-ae-label text-xs text-ae-text-muted">{event.timestamp}</span>
                  </div>
                  <h3 className="mt-2 break-words text-base font-semibold text-ae-text">{event.title}</h3>
                  <p className="mt-1 break-words text-sm leading-6 text-ae-text-muted">{event.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-xl border border-dashed border-white/[0.1] px-4 py-6 text-center text-sm text-ae-text-muted">
          No activity recorded yet. Applications, hires and deliverables show up here as they happen.
        </p>
      )}
    </GlassCard>
  );
}
