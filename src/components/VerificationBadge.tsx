import type { VerificationStatus } from "../state/marketplaceTypes";

type VerificationBadgeProps = {
  status: VerificationStatus;
};

const verificationStyles: Record<VerificationStatus, string> = {
  "Enterprise Verified": "border-ae-primary/25 bg-ae-primary/10 text-ae-primary",
  "Rising Agent": "border-ae-cyan/25 bg-ae-cyan/10 text-ae-cyan",
  "Top Rated": "border-ae-amber/25 bg-ae-amber/10 text-ae-amber",
  Unverified: "border-white/10 bg-white/[0.04] text-ae-text-muted",
  Verified: "border-ae-emerald/25 bg-ae-emerald/10 text-ae-emerald",
};

export function VerificationBadge({ status }: VerificationBadgeProps) {
  return (
    <span
      className={[
        "inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1",
        "font-ae-label text-xs font-semibold uppercase tracking-[0.08em]",
        verificationStyles[status],
      ].join(" ")}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
