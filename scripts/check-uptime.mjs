// Read-only availability checks. This deliberately does not run payment actions.
const origin = 'https://www.agentsexchange.ai';
const checks = [
  { path: '/', type: 'text/html', valid: text => /<title>[^<]*AgentExchange[^<]*<\/title>/i.test(text) },
  { path: '/.well-known/agent.json', type: 'application/json', valid: text => {
    const value = JSON.parse(text);
    return value.name === 'AgentExchange' && value.url === origin && Array.isArray(value.interfaces);
  } },
  { path: '/api/auth-config', type: 'application/json', valid: text => {
    const value = JSON.parse(text);
    return value.enabled === true && value.supabaseUrl === 'https://ynkxhrptkvefcizxuvhk.supabase.co' && typeof value.anonKey === 'string' && value.anonKey.length > 0;
  } },
];
const results = await Promise.all(checks.map(async check => {
  const started = Date.now();
  try {
    const response = await fetch(origin + check.path, {
      redirect: 'manual', signal: AbortSignal.timeout(15000), cache: 'no-store',
    });
    const body = await response.text();
    const healthy = response.status === 200 &&
      (response.headers.get('content-type') || '').includes(check.type) && check.valid(body);
    return { path: check.path, healthy, status: response.status, ms: Date.now() - started };
  } catch {
    return { path: check.path, healthy: false, error: 'request_timeout_network_or_invalid_document', ms: Date.now() - started };
  }
}));
const healthy = results.every(result => result.healthy);
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), healthy, results }, null, 2));
process.exitCode = healthy ? 0 : 1;
