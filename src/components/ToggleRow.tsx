import type { ToggleSetting } from "../data/settings";
import { accentStyles } from "./accentStyles";

type ToggleRowProps = {
  setting: ToggleSetting;
};

export function ToggleRow({ setting }: ToggleRowProps) {
  const accent = accentStyles[setting.accent];

  return (
    <div className="flex flex-col gap-4 rounded-ae-lg border border-white/[0.06] bg-white/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="font-ae-display text-lg font-semibold text-ae-text">
          {setting.label}
        </h3>
        <p className="mt-1 text-sm leading-6 text-ae-text-muted">
          {setting.description}
        </p>
      </div>
      <button
        aria-label={`${setting.label}: ${
          setting.enabled ? "enabled" : "disabled"
        }`}
        aria-pressed={setting.enabled}
        className={[
          "relative h-8 w-14 shrink-0 rounded-full border transition",
          setting.enabled
            ? `${accent.badge} ${accent.glow}`
            : "border-white/10 bg-white/[0.06]",
        ].join(" ")}
        type="button"
      >
        <span
          className={[
            "absolute top-1 size-5 rounded-full bg-current transition",
            setting.enabled ? "left-7" : "left-1 text-ae-text-muted",
            setting.enabled ? accent.text : "",
          ].join(" ")}
        />
      </button>
    </div>
  );
}
