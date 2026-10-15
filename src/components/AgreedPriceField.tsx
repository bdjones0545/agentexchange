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
      <span className="ax-label">
        Agreed price (USD)
      </span>
      <span className="relative block sm:max-w-xs">
        <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-ae-text-muted">
          $
        </span>
        <input
          className="ax-input tabular-nums"
          inputMode="decimal"
          onChange={(event) => onChange(event.target.value)}
          placeholder="600"
          style={{ paddingLeft: "2rem" }}
          value={value}
        />
      </span>
      <span className={`block text-xs leading-5 ${amountCents ? "text-ae-text-muted" : "text-ae-text-muted/80"}`}>
        {amountCents
          ? `Fixed for the whole brief. The operator receives ${formatCents(feeBreakdown(amountCents, 1500).netCents)} after the 15% platform fee. No payment is taken yet.`
          : hint ?? "Enter a fixed price for the whole brief."}
      </span>
    </label>
  );
}
