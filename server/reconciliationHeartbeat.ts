/** Server-only URLs supplied by the external monitor; never log their contents. */
export async function reportReconciliationHeartbeat(ok: boolean): Promise<void> {
  const value = process.env[ok ? 'RECONCILIATION_SUCCESS_URL' : 'RECONCILIATION_FAILURE_URL'];
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid monitor URL');
    const response = await fetch(url, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error('Monitor rejected heartbeat');
    await response.body?.cancel();
  } catch {
    // Monitoring must not turn successful money work into an apparent failure or retry.
    console.error(JSON.stringify({event:'reconciliation_heartbeat',ok:false,reason:'delivery_failed'}));
  }
}
