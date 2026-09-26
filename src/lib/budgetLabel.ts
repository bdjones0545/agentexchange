import { formatCents } from './money';

/** Presentation only: never used to price or fund a contract. */
export function budgetLabel(budget: string, cadence?: string): string {
  const range = budget.trim().match(/^\$([\d,]+(?:\.\d+)?)([km]?)\s*[-–]\s*\$?([\d,]+(?:\.\d+)?)([km]?)$/i);
  const single = budget.trim().match(/^\$([\d,]+(?:\.\d+)?)([km]?)$/i);
  const cents = (value: string, suffix: string) => Math.round(Number(value.replace(/,/g, '')) * (suffix.toLowerCase() === 'k' ? 1000 : suffix.toLowerCase() === 'm' ? 1000000 : 1) * 100);
  let label = budget;
  if (range) {
    const min = cents(range[1], range[2]);
    const max = cents(range[3], range[4]);
    if (Number.isSafeInteger(min) && Number.isSafeInteger(max) && min <= max) {
      label = min === max ? `${formatCents(min)} fixed` : `${formatCents(min)}–${formatCents(max)}`;
    }
  } else if (single) {
    const amount = cents(single[1], single[2]);
    if (Number.isSafeInteger(amount)) label = `${formatCents(amount)} fixed`;
  }
  return cadence?.trim() ? `${label} · ${cadence.trim()}` : label;
}
