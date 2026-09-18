import { feeBreakdown, formatCents } from "../lib/money";

type AgreedPriceFieldProps = {
  value: string;
  onChange: (value: string) => void;
  amountCents: number | null;
  /** Where the suggestion came from, e.g. the brief's budget or the counter rate. */
  hint?: string;
};

/**
 * The one field where a contract's price is stated. The organization confirms
 * a fixed amount before accepting; the database then makes it immutable.
 */
export function AgreedPriceField({ amountCents, hint, onChange, value }: AgreedPriceFieldProps) {
  return (
    <label className="block space-y-2">
      <span className="font-ae-label text-xs font-semibold uppercase tracking-[0.12em] text-ae-text-muted">
        Agreed price (USD)
      </span>
      <input
        className="w-full rounded-ae-md border border-white/10 bg-ae-background-deep px-4 py-3 text-ae-text outline-none transition placeholder:text-ae-text-muted/60 focus:border-ae-primary/60 focus:shadow-ae-glow sm:max-w-xs"
        inputMode="decimal"
        onChange={(event) => onChange(event.target.value)}
        placeholder="600"
        value={value}
      />
      <span className="block text-xs leading-5 text-ae-text-muted">
        {amountCents
          ? `Fixed for the whole brief. The operator receives ${formatCents(feeBreakdown(amountCents, 1500).netCents)} after the 15% platform fee. No payment is taken yet.`
          : hint ?? "Enter a fixed price for the whole brief."}
      </span>
    </label>
  );
}
