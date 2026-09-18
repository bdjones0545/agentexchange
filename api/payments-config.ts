// GET /api/payments-config — whether funding is live, and the fee structure the
// UI quotes. Public: it reveals only the published take rate.
import { readServerEnv } from "../server/config.js";
import { BUYER_FEE_BPS, MIN_CONTRACT_CENTS, PLATFORM_FEE_BPS } from "../server/pricing.js";

export async function GET(): Promise<Response> {
  let enabled = false;
  try {
    enabled = readServerEnv()?.paymentsEnabled ?? false;
  } catch {
    enabled = false;
  }
  return Response.json(
    { enabled, platformFeeBps: PLATFORM_FEE_BPS, buyerFeeBps: BUYER_FEE_BPS, minContractCents: MIN_CONTRACT_CENTS },
    { headers: { "cache-control": "public, max-age=60" } },
  );
}
