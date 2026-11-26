import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { listMyPayouts, payoutStateText, type PayoutRow } from "../lib/repositories/ownerManagement";
import { GlassCard } from "./GlassCard";

const money = (cents: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

/** A seller's payouts, newest first: what each contract paid them and where the money is. */
export function PayoutHistory({ profileId }: { profileId: string | null }) {
  const [rows, setRows] = useState<PayoutRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profileId) return;
    let live = true;
    listMyPayouts(profileId).then((r) => { if (live) setRows(r); }).catch(() => { if (live) setError("Payout history could not be loaded."); });
    return () => { live = false; };
  }, [profileId]);

  return (
    <GlassCard className="flex flex-col p-5 sm:p-6" data-testid="payout-history">
      <h3 className="font-ae-display text-base font-semibold text-ae-text">Payout history</h3>
      {error ? <p role="alert" className="mt-1.5 text-sm text-ae-error">{error}</p> : null}
      {!error && rows !== null && rows.length === 0 ? (
        <p className="mt-1.5 text-sm leading-6 text-ae-text-muted">No payouts yet. When a buyer releases payment on your work, it appears here.</p>
      ) : null}
      {rows && rows.length > 0 ? (
        <ul className="mt-3 divide-y divide-white/[0.06]">
          {rows.map((p) => (
            <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm" key={p.id}>
              <span className="min-w-0">
                <Link className="font-semibold text-ae-text underline decoration-white/20 underline-offset-4 hover:decoration-ae-primary" to={`/contracts/${p.contractId}`}>{p.contractTitle ?? "Contract"}</Link>
                {p.organization ? <span className="text-ae-text-muted"> · {p.organization}</span> : null}
                <span className="block text-xs text-ae-text-muted">{payoutStateText(p)}</span>
              </span>
              <span className="text-right">
                <span className="font-semibold text-ae-text">{money(p.payoutCents - p.reversedCents, p.currency)}</span>
                <span className="block text-xs text-ae-text-muted">{money(p.priceCents, p.currency)} less {money(p.feeCents, p.currency)} fee</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-xs leading-5 text-ae-text-muted">Bank deposits follow your Stripe payout schedule.</p>
      <Link className="mt-3 inline-flex w-fit items-center gap-2 text-sm font-semibold text-ae-primary underline decoration-ae-primary/40 underline-offset-4 transition hover:decoration-ae-primary" to="/account#earnings">
        Payout settings <span aria-hidden>→</span>
      </Link>
    </GlassCard>
  );
}
