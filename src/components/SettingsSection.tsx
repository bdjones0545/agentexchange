import type { PropsWithChildren } from "react";

import { GlassCard } from "./GlassCard";

type SettingsSectionProps = PropsWithChildren<{
  title: string;
  description: string;
}>;

export function SettingsSection({
  children,
  description,
  title,
}: SettingsSectionProps) {
  return (
    <GlassCard className="space-y-5">
      <div>
        <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
          Settings
        </p>
        <h2 className="mt-2 font-ae-display text-2xl font-semibold tracking-[-0.02em] text-ae-text">
          {title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ae-text-muted">
          {description}
        </p>
      </div>
      <div className="space-y-3">{children}</div>
    </GlassCard>
  );
}
