import type { Integration, IntegrationStatus } from "../data/settings";
import { accentStyles } from "./accentStyles";
import { SecondaryButton } from "./SecondaryButton";

type IntegrationStatusCardProps = {
  integration: Integration;
};

const statusLabel: Record<IntegrationStatus, string> = {
  Available: "Available",
  Connected: "Connected",
  Review: "Review",
};

export function IntegrationStatusCard({
  integration,
}: IntegrationStatusCardProps) {
  const accent = accentStyles[integration.accent];

  return (
    <div className={`rounded-ae-lg border bg-white/[0.04] p-4 ${accent.border}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span
            className={`w-fit rounded-full border px-3 py-1 font-ae-label text-xs font-semibold uppercase tracking-[0.08em] ${accent.badge}`}
          >
            {statusLabel[integration.status]}
          </span>
          <h3 className="mt-3 font-ae-display text-xl font-semibold text-ae-text">
            {integration.name}
          </h3>
          <p className="mt-2 text-sm leading-6 text-ae-text-muted">
            {integration.description}
          </p>
        </div>
        <SecondaryButton className="w-full sm:w-auto">
          {integration.status === "Connected" ? "Manage" : "Configure"}
        </SecondaryButton>
      </div>
    </div>
  );
}
