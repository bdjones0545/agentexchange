import { useEffect, useState } from "react";

import { feeBreakdown, formatCents } from "../lib/money";
import { fetchPaymentsConfig, releaseFunding, startFunding, type PaymentsConfig } from "../lib/payments";
import type { ContractPaymentStatus, LocalContract } from "../state/marketplaceTypes";
import { PrimaryButton } from "./PrimaryButton";
import { SecondaryButton } from "./SecondaryButton";

const LABELS: Record<ContractPaymentStatus, { label: string; tone: string; detail: string }> = {
  unfunded: { label: "Not funded", tone: "border-white/10 bg-white/[0.04] text-ae-text-muted", detail: "No payment has been taken." },
  authorized: { label: "Funded · held", tone: "border-ae-cyan/25 bg-ae-cyan/10 text-ae-cyan", detail: "The price is held on the organization's card and released when the work is approved." },
  captured: { label: "Paid", tone: "border-ae-emerald/25 bg-ae-emerald/10 text-ae-emerald", detail: "Released to the operator after approval." },
  paid_out: { label: "Paid out", tone: "border-ae-emerald/25 bg-ae-emerald/10 text-ae-emerald", detail: "Transferred to the operator." },
  refunded: { label: "Refunded", tone: "border-ae-amber/25 bg-ae-amber/10 text-ae-amber", detail: "Returned to the organization." },
};

export function PaymentStatusBadge({ status }: { status: ContractPaymentStatus }) {
  const meta = LABELS[status] ?? LABELS.unfunded;
  return (
    <span className={`inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 font-ae-label text-xs font-semibold ${meta.tone}`}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] py-2.5 text-sm last:border-0">
      <dt className="text-ae-text-muted">{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-semibold text-ae-text" : "text-ae-text"}`}>{value}</dd>
    </div>
  );
}

type FundingPanelProps = {
  contract: LocalContract;
  isOrganizationSide: boolean;
  allDeliverablesApproved: boolean;
  /** Unresolved disputes on this contract; the server refuses release while any are open. */
  openDisputes?: number;
  onChanged: () => void;
};

/**
 * The organization's money controls for one contract: fund it (a held charge
 * of the agreed price + 3% fee), release it after approving the work, or cancel
 * the hold. Renders nothing when payments are not enabled for the product.
 */
export function FundingPanel({ allDeliverablesApproved, contract, isOrganizationSide, onChanged, openDisputes = 0 }: FundingPanelProps) {
  const [config, setConfig] = useState<PaymentsConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Read after mount so the server render and the first client render agree.
  const [funding, setFunding] = useState<string | null>(null);
  const status: ContractPaymentStatus = contract.paymentStatus ?? "unfunded";
  const meta = LABELS[status] ?? LABELS.unfunded;

  useEffect(() => {
    let mounted = true;
    setFunding(new URLSearchParams(window.location.search).get("funding"));
    void fetchPaymentsConfig().then((c) => {
      if (mounted) setConfig(c);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!config?.enabled || !contract.amountCents) {
    return null;
  }

  const fees = feeBreakdown(contract.amountCents, contract.platformFeeBps ?? config.platformFeeBps);
  const buyerFee = Math.round((contract.amountCents * config.buyerFeeBps) / 10_000);
  const currency = contract.currency ?? "USD";

  async function fund() {
    setBusy(true);
    setError(null);
    const r = await startFunding(contract.id);
    if (r.url) {
      window.location.assign(r.url);
      return;
    }
    setError(r.error ?? "Could not start checkout.");
    setBusy(false);
  }

  async function release(action: "capture" | "cancel") {
    setBusy(true);
    setError(null);
    const r = await releaseFunding(contract.id, action);
    setBusy(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    onChanged();
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-ae-surface to-ae-surface/70 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04),0_24px_48px_-28px_rgb(0_0_0_/_0.7)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">Payment</p>
          <p className="mt-1.5 text-sm leading-6 text-ae-text-muted">{meta.detail}</p>
        </div>
        <PaymentStatusBadge status={status} />
      </div>

      <div className="space-y-4 px-5 py-4">
        {funding === "complete" && status === "unfunded" ? (
          <p className="rounded-xl border border-ae-cyan/20 bg-ae-cyan/[0.06] px-3.5 py-2.5 text-xs leading-5 text-ae-text-muted">Checkout finished; confirming with the payment provider. This updates within a few seconds.</p>
        ) : null}
        {funding === "cancelled" && status === "unfunded" ? (
          <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-xs leading-5 text-ae-text-muted">Checkout was cancelled. Nothing was charged.</p>
        ) : null}

        {isOrganizationSide && status === "unfunded" ? (
          <div className="space-y-4">
            <dl>
              <Row label="Agreed price" value={formatCents(contract.amountCents, currency)} />
              <Row label="Service fee" value={formatCents(buyerFee, currency)} />
              <Row label="Card hold total" strong value={formatCents(contract.amountCents + buyerFee, currency)} />
            </dl>
            <p className="text-sm leading-6 text-ae-text-muted">
              The total is placed as a card authorization hold, not a charge, and held until you approve the work. Holds can expire.
            </p>
            <PrimaryButton className="w-full" disabled={busy} onClick={() => void fund()}>
              {busy ? "Opening checkout…" : `Fund this contract · ${formatCents(contract.amountCents + buyerFee, currency)}`}
            </PrimaryButton>
          </div>
        ) : null}

        {isOrganizationSide && status === "authorized" ? (
          <div className="space-y-3">
            <p className="text-sm leading-6 text-ae-text-muted">
              {openDisputes > 0
                ? "Release is blocked while a dispute on this contract is open. Resolve the dispute first, or cancel the hold if the work will not go ahead."
                : allDeliverablesApproved
                ? `Every deliverable is approved. Releasing pays the operator ${formatCents(fees.netCents, currency)} (${formatCents(fees.feeCents, currency)} platform fee).`
                : "Approve every deliverable to release the payment, or cancel the hold if the work will not go ahead."}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
              <PrimaryButton className="flex-1" disabled={busy || !allDeliverablesApproved || openDisputes > 0} onClick={() => void release("capture")}>
                Release payment
              </PrimaryButton>
              <SecondaryButton className="flex-1" disabled={busy} onClick={() => void release("cancel")}>
                Cancel hold
              </SecondaryButton>
            </div>
          </div>
        ) : null}

        {!isOrganizationSide && status === "unfunded" ? (
          <p className="text-sm leading-6 text-ae-text-muted">Work begins once the organization funds the contract.</p>
        ) : null}

        {error ? <p className="rounded-xl border border-ae-error/25 bg-ae-error/[0.08] px-3.5 py-2.5 text-sm text-ae-error">{error}</p> : null}
      </div>
    </div>
  );
}
