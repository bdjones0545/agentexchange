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
    <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 font-ae-label text-xs font-semibold uppercase tracking-[0.08em] ${meta.tone}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}

type FundingPanelProps = {
  contract: LocalContract;
  isOrganizationSide: boolean;
  allDeliverablesApproved: boolean;
  onChanged: () => void;
};

/**
 * The organization's money controls for one contract: fund it (a held charge
 * of the agreed price + 3% fee), release it after approving the work, or cancel
 * the hold. Renders nothing when payments are not enabled for the product.
 */
export function FundingPanel({ allDeliverablesApproved, contract, isOrganizationSide, onChanged }: FundingPanelProps) {
  const [config, setConfig] = useState<PaymentsConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status: ContractPaymentStatus = contract.paymentStatus ?? "unfunded";
  const funding = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("funding") : null;

  useEffect(() => {
    let mounted = true;
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
    <div className="space-y-3 rounded-ae-md border border-white/[0.06] bg-white/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">Payment</p>
          <p className="mt-1 text-sm leading-6 text-ae-text-muted">{LABELS[status].detail}</p>
        </div>
        <PaymentStatusBadge status={status} />
      </div>

      {funding === "complete" && status === "unfunded" ? (
        <p className="text-xs leading-5 text-ae-text-muted">Checkout finished; confirming with the payment provider. This updates within a few seconds.</p>
      ) : null}
      {funding === "cancelled" && status === "unfunded" ? (
        <p className="text-xs leading-5 text-ae-text-muted">Checkout was cancelled. Nothing was charged.</p>
      ) : null}

      {isOrganizationSide && status === "unfunded" ? (
        <div className="space-y-2">
          <p className="text-sm leading-6 text-ae-text">
            {formatCents(contract.amountCents, currency)} agreed price + {formatCents(buyerFee, currency)} service fee ={" "}
            <strong>{formatCents(contract.amountCents + buyerFee, currency)}</strong>, held until you approve the work.
          </p>
          <PrimaryButton disabled={busy} onClick={() => void fund()}>
            {busy ? "Opening checkout…" : `Fund this contract · ${formatCents(contract.amountCents + buyerFee, currency)}`}
          </PrimaryButton>
        </div>
      ) : null}

      {isOrganizationSide && status === "authorized" ? (
        <div className="space-y-2">
          <p className="text-sm leading-6 text-ae-text-muted">
            {allDeliverablesApproved
              ? `Every deliverable is approved. Releasing pays the operator ${formatCents(fees.netCents, currency)} (${formatCents(fees.feeCents, currency)} platform fee).`
              : "Approve every deliverable to release the payment, or cancel the hold if the work will not go ahead."}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <PrimaryButton disabled={busy || !allDeliverablesApproved} onClick={() => void release("capture")}>
              Release payment
            </PrimaryButton>
            <SecondaryButton disabled={busy} onClick={() => void release("cancel")}>
              Cancel hold
            </SecondaryButton>
          </div>
        </div>
      ) : null}

      {!isOrganizationSide && status === "unfunded" ? (
        <p className="text-sm leading-6 text-ae-text-muted">Work begins once the organization funds the contract.</p>
      ) : null}

      {error ? <p className="text-sm text-ae-amber">{error}</p> : null}
    </div>
  );
}
