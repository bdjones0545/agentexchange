import { useEffect, useId, useState, type FormEvent } from "react";

import { PURCHASE_NOTE_MAX, listingPriceCents, type PurchasableListing } from "../lib/listingPurchase";
import { formatCents } from "../lib/money";
import { fetchPaymentsConfig } from "../lib/payments";
import { useAgentExchange } from "../state/AgentExchangeContext";
import { PrimaryButton } from "./PrimaryButton";
import { SecondaryButton } from "./SecondaryButton";

/** What the buyer pays when funding: the price plus the service fee. */
export function buyerTotals(priceCents: number, buyerFeeBps: number) {
  const feeCents = Math.round((priceCents * buyerFeeBps) / 10_000);
  return { priceCents, feeCents, totalCents: priceCents + feeCents };
}

type BuyListingModalProps = {
  listing: PurchasableListing & { avatarInitials?: string };
  isOpen: boolean;
  onClose: () => void;
  onBought?: () => void;
  /** Organization names the buyer already uses, newest first. */
  knownOrganizations?: string[];
};

/**
 * Buy a fixed-price listing at its listed price in one step. The buyer names
 * their organization and, optionally, what the seller should know; nothing is
 * charged until the seller accepts and the buyer funds the contract.
 */
export function BuyListingModal({ listing, isOpen, onClose, onBought, knownOrganizations = [] }: BuyListingModalProps) {
  const titleId = useId();
  const { buyListing } = useAgentExchange();
  const [organization, setOrganization] = useState(knownOrganizations[0] ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [buyerFeeBps, setBuyerFeeBps] = useState(300);

  useEffect(() => {
    if (!isOpen) return;
    let live = true;
    void fetchPaymentsConfig()
      .then((config) => {
        if (live && Number.isFinite(config.buyerFeeBps)) setBuyerFeeBps(config.buyerFeeBps);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [isOpen]);

  const priceCents = listingPriceCents(listing.startingRate);
  if (!isOpen || !priceCents) return null;
  const totals = buyerTotals(priceCents, buyerFeeBps);
  const canSubmit = organization.trim().length >= 2 && !busy;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    const sent = await buyListing({ listing, organizationName: organization, note });
    setBusy(false);
    if (sent) {
      setNote("");
      onClose();
      onBought?.();
    }
  }

  return (
    <div aria-labelledby={titleId} aria-modal="true" className="fixed inset-0 z-[60] overflow-y-auto bg-ae-background-deep/70 backdrop-blur-md" role="dialog">
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <form
          className="ax-pop relative w-full max-w-xl space-y-6 rounded-3xl border border-white/10 bg-gradient-to-b from-ae-surface to-ae-background-deep p-6 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.05),0_40px_120px_-30px_rgb(0_0_0_/_0.9)] sm:p-8"
          onSubmit={(event) => void submit(event)}
        >
          <div className="flex items-start gap-4">
            {listing.avatarInitials ? (
              <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl border border-ae-primary/25 bg-gradient-to-br from-ae-primary/20 to-ae-cyan/10 font-ae-label text-sm font-semibold text-ae-primary">
                {listing.avatarInitials}
              </span>
            ) : null}
            <div className="min-w-0">
              <p className="font-ae-label text-xs font-semibold uppercase tracking-[0.16em] text-ae-primary">Buy at the listed price</p>
              <h2 id={titleId} className="mt-1 break-words font-ae-display text-2xl font-semibold tracking-tight text-ae-text sm:text-3xl">{listing.name}</h2>
            </div>
          </div>

          <dl className="space-y-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-ae-text-muted">Price</dt><dd className="tabular-nums text-ae-text">{formatCents(totals.priceCents)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ae-text-muted">Service fee ({buyerFeeBps / 100}%)</dt><dd className="tabular-nums text-ae-text">{formatCents(totals.feeCents)}</dd></div>
            <div className="flex justify-between gap-4 border-t border-white/[0.08] pt-2 font-semibold"><dt className="text-ae-text">Held on your card when you fund</dt><dd className="tabular-nums text-ae-text">{formatCents(totals.totalCents)}</dd></div>
          </dl>

          <ol className="list-decimal space-y-1 pl-5 text-sm leading-6 text-ae-text-muted">
            <li>The seller accepts your request at this price.</li>
            <li>You fund the contract: a hold on your card, not a charge.</li>
            <li>The work is delivered. You approve it before you are charged.</li>
          </ol>

          <label className="block space-y-2">
            <span className="ax-label">Your organization or business name</span>
            <input
              autoComplete="organization"
              className="ax-input"
              list={knownOrganizations.length ? `${titleId}-orgs` : undefined}
              maxLength={120}
              onChange={(event) => setOrganization(event.target.value)}
              placeholder="Example: Acme Fitness"
              required
              value={organization}
            />
            {knownOrganizations.length ? (
              <datalist id={`${titleId}-orgs`}>
                {knownOrganizations.map((name) => <option key={name} value={name} />)}
              </datalist>
            ) : null}
          </label>

          <label className="block space-y-2">
            <span className="ax-label">What should the seller know? (optional)</span>
            <textarea
              className="ax-input min-h-28"
              maxLength={PURCHASE_NOTE_MAX}
              onChange={(event) => setNote(event.target.value)}
              placeholder="The details the listing asks for under &quot;What I need from you&quot;."
              value={note}
            />
            <span className="block text-xs leading-5 text-ae-text-muted">
              Saved with your purchase. Don't include passwords, payment details or private documents; share those in the contract thread once the seller accepts.
            </span>
          </label>

          <div className="flex flex-col-reverse gap-3 border-t border-white/[0.06] pt-5 sm:flex-row sm:justify-end">
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            <PrimaryButton disabled={!canSubmit} type="submit">
              {busy ? "Sending…" : `Send request for ${formatCents(totals.priceCents)}`}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}
