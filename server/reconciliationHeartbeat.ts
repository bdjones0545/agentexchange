// After each reconcile run, ping an external monitor (Healthchecks.io or any
// service with a success and a failure URL). The monitor alerts the owner when
// a run reports a problem or when the pings stop, which also catches a cron that
// no longer runs. Based on the opt-in heartbeat from PR #71.
//
// RECONCILIATION_SUCCESS_URL / RECONCILIATION_FAILURE_URL are server-only and
// hold the monitor's secret check id: never log them. Unset means no ping.

export type HeartbeatCounts = Record<string, number>;

/**
 * Post one ping for the run's outcome. The body carries counts only, so the
 * alert says what is wrong without any contract id, amount or provider text.
 * A monitor failure never turns successful money work into a failure or retry.
 */
export async function reportReconciliationHeartbeat(ok: boolean, counts: HeartbeatCounts = {}): Promise<void> {
  const value = process.env[ok ? "RECONCILIATION_SUCCESS_URL" : "RECONCILIATION_FAILURE_URL"];
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid monitor URL");
    const body = JSON.stringify(Object.fromEntries(Object.entries(counts).filter(([, n]) => Number.isFinite(n))));
    const response = await fetch(url, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(3000),
      headers: { "content-type": "application/json" }, body,
    });
    await response.body?.cancel();
    if (!response.ok) throw new Error("Monitor rejected heartbeat");
  } catch {
    console.error(JSON.stringify({ event: "reconciliation_heartbeat", ok: false, reason: "delivery_failed" }));
  }
}
