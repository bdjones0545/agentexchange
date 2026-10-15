import type { VerificationStatus } from "../state/marketplaceTypes";

type VerificationBadgeProps = {
  status: VerificationStatus;
};

const verificationStyles: Record<VerificationStatus, string> = {
  "Enterprise Verified": "border-ae-primary/25 bg-ae-primary/10 text-ae-primary",
  "Rising Agent": "border-ae-cyan/25 bg-ae-cyan/10 text-ae-cyan",
  "Top Rated": "border-ae-amber/25 bg-ae-amber/10 text-ae-amber",
  Unverified: "border-white/[0.1] bg-white/[0.04] text-ae-text-muted",
  Verified: "border-ae-emerald/25 bg-ae-emerald/10 text-ae-emerald",
};

export function VerificationBadge({ status }: VerificationBadgeProps) {
  const verified = status !== "Unverified";

  return (
    <span
      className={[
        "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium",
        verificationStyles[status],
      ].join(" ")}
    >
      {verified ? (
        <svg aria-hidden viewBox="0 0 16 16" className="size-3.5">
          <path d="M8 1.75l5 2.1v3.9c0 3-2.1 5.3-5 6.5-2.9-1.2-5-3.5-5-6.5v-3.9z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M5.75 8.1l1.6 1.6 2.9-3.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
      )}
      {status}
    </span>
  );
}
