import type { PropsWithChildren, ReactNode } from "react";

import { GlassCard } from "./GlassCard";

type SettingsSectionProps = PropsWithChildren<{
  title: string;
  description: string;
  /** Small label above the title. */
  eyebrow?: string;
  /** Anchor id, so other pages can link straight to the section. */
  id?: string;
  /** Buttons or links shown beside the heading. */
  actions?: ReactNode;
}>;

export function SettingsSection({
  actions,
  children,
  description,
  eyebrow,
  id,
  title,
}: SettingsSectionProps) {
  return (
    <GlassCard className="scroll-mt-28 p-6 sm:p-8" id={id}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-10">
        <div>
          {eyebrow ? (
            <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">
              {eyebrow}
            </p>
          ) : null}
          <h2 className={`font-ae-display text-xl font-semibold tracking-tight text-ae-text sm:text-2xl ${eyebrow ? "mt-2" : ""}`}>
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ae-text-muted">
            {description}
          </p>
          {actions ? <div className="mt-5 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        <div className="min-w-0 space-y-3">{children}</div>
      </div>
    </GlassCard>
  );
}
