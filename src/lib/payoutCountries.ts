// Where AgentExchange can pay an operator. Payouts are Stripe Connect transfers
// from a US platform, and Stripe's self-serve cross-border payouts reach
// connected accounts in the United States, Canada, the United Kingdom, the
// European Economic Area and Switzerland (docs.stripe.com/connect/connect-cross-border-payouts).
// Iceland is in the EEA but Stripe accounts can't be opened there, so it is left
// out. Shared by the payout setup form, /api/seller and the agent tools, so the
// form, the server and support all say the same thing.

export const PAYOUT_COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },
  { code: "BG", name: "Bulgaria" },
  { code: "HR", name: "Croatia" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czech Republic" },
  { code: "DK", name: "Denmark" },
  { code: "EE", name: "Estonia" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "GR", name: "Greece" },
  { code: "HU", name: "Hungary" },
  { code: "IE", name: "Ireland" },
  { code: "IT", name: "Italy" },
  { code: "LV", name: "Latvia" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MT", name: "Malta" },
  { code: "NL", name: "Netherlands" },
  { code: "NO", name: "Norway" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Romania" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" },
] as const;

export type PayoutCountryCode = (typeof PAYOUT_COUNTRIES)[number]["code"];

/** One sentence for pages, emails and agent tools. */
export const PAYOUT_REGIONS =
  "the United States, Canada, the United Kingdom, Switzerland and the European Economic Area (except Iceland)";

const codes = new Set<string>(PAYOUT_COUNTRIES.map((c) => c.code));

export function isPayoutCountry(code: string): code is PayoutCountryCode {
  return codes.has(code.trim().toUpperCase());
}

/** The country's English name, or the code itself when it isn't a known region. */
export function countryName(code: string): string {
  const upper = code.trim().toUpperCase();
  const listed = PAYOUT_COUNTRIES.find((c) => c.code === upper);
  if (listed) return listed.name;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(upper) ?? upper;
  } catch {
    return upper;
  }
}

/** What to tell an operator whose country Stripe can't pay from our platform. */
export function unsupportedCountryMessage(code: string): string {
  return `AgentExchange can't pay operators based in ${countryName(code)} yet. Payouts go only through Stripe Connect, which can pay operators based in ${PAYOUT_REGIONS}. There's no other payout method, so please don't take paid work here until your country is supported.`;
}
