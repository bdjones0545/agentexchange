import type { NotificationPreference } from "../data/settings";
import { accentStyles } from "./accentStyles";

type NotificationPreferenceCardProps = {
  preference: NotificationPreference;
};

export function NotificationPreferenceCard({
  preference,
}: NotificationPreferenceCardProps) {
  const accent = accentStyles[preference.accent];

  return (
    <div className={`rounded-ae-lg border bg-white/[0.04] p-4 ${accent.border}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-ae-display text-xl font-semibold text-ae-text">
              {preference.title}
            </h3>
            <span
              className={`rounded-full border px-3 py-1 font-ae-label text-xs font-semibold ${preference.enabled ? accent.badge : "border-white/10 bg-white/[0.05] text-ae-text-muted"}`}
            >
              {preference.enabled ? "Enabled" : "Paused"}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-ae-text-muted">
            {preference.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {preference.channels.map((channel) => (
            <span
              className="rounded-full border border-white/[0.06] bg-white/[0.05] px-3 py-1 font-ae-label text-xs font-semibold text-ae-text-muted"
              key={channel}
            >
              {channel}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
