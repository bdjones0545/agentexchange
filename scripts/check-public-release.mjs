// Read-only checks against an explicitly selected deployment.
import { readFileSync } from 'node:fs';
const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/check-public-release.mjs https://www.agentsexchange.ai');
  process.exit(2);
}
const base = new URL(input);
if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
  throw new Error('Supply an HTTPS origin without credentials, path, query or fragment.');
}
// Optional temporary Netscape cookie jar for a protected preview; never print it.
const cookies = process.env.RELEASE_CHECK_COOKIE_FILE
  ? readFileSync(process.env.RELEASE_CHECK_COOKIE_FILE, 'utf8').split('\n')
    .filter(line => line.startsWith('#HttpOnly_') || (line && !line.startsWith('#')))
    .map(line => line.replace(/^#HttpOnly_/, '').split('\t')).filter(parts => parts.length === 7)
  : [];
function cookieHeader(path) {
  return cookies.filter(([domain, subdomains, cookiePath, , expiry]) => {
    const host = domain.replace(/^\./, '');
    const domainMatches = base.hostname === host || (subdomains === 'TRUE' && base.hostname.endsWith('.' + host));
    const pathMatches = path === cookiePath || (path.startsWith(cookiePath) && (cookiePath.endsWith('/') || path[cookiePath.length] === '/'));
    return domainMatches && pathMatches && (Number(expiry) === 0 || Number(expiry) > Date.now() / 1000);
  }).map(parts => `${parts[5]}=${parts[6]}`).join('; ');
}
const pages = ['/', '/marketplace', '/agents', '/for-agents', '/pricing', '/about', '/contact', '/terms', '/privacy', '/refunds', '/acceptable-use'];
const checks = [
  ...pages.map(path => ({ path, status: 200, type: 'text/html', html: true })),
  ...['/release-check-missing-page', '/agents/release-check-missing', '/marketplace/release-check-missing'].map(path => ({ path, status: 404, type: 'text/html' })),
  { path: '/robots.txt', status: 200, type: 'text/plain', pattern: /Sitemap:/i },
  { path: '/sitemap.xml', status: 200, type: 'xml', pattern: /<urlset\b/ },
  { path: '/llms.txt', status: 200, type: 'text/plain', pattern: /AgentExchange/i },
  { path: '/.well-known/agent.json', status: 200, type: 'json', json: true },
  { path: '/brand/og-default.png', status: 200, type: 'image/png' },
  { path: '/privacy', status: 200, type: 'text/html', method: 'HEAD' },
  { path: '/release-check-missing-page', status: 404, type: 'text/html', method: 'HEAD' },
];
let failed = 0;
const titles = new Set();
for (const check of checks) {
  const errors = [];
  try {
    const response = await fetch(new URL(check.path, base), {
      headers: { Cookie: cookieHeader(check.path) },
      method: check.method || 'GET', redirect: 'manual', signal: AbortSignal.timeout(15000),
    });
    if (response.status !== check.status) errors.push(`expected ${check.status}, got ${response.status}`);
    if (!(response.headers.get('content-type') || '').includes(check.type)) errors.push(`expected ${check.type}`);
    const body = await response.text();
    if (check.pattern && !check.pattern.test(body)) errors.push('missing expected document content');
    if (check.json) JSON.parse(body);
    if (check.html) {
      const matches = [...body.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)];
      const title = matches[0]?.[1]?.trim();
      if (matches.length !== 1 || !title) errors.push('expected one nonempty title');
      if (title && titles.has(title)) errors.push('duplicate page title');
      if (title) titles.add(title);
      if (!/<h1\b[^>]*>[\s\S]*?\S[\s\S]*?<\/h1>/i.test(body)) errors.push('missing server-rendered heading');
      if (!/<meta\b[^>]*property=["']og:title["']/i.test(body)) errors.push('missing social title');
    }
  } catch (error) {
    errors.push(error.name === 'TimeoutError' ? 'request timed out' : 'request or document parsing failed');
  }
  if (errors.length) failed++;
  console.log(`${errors.length ? 'FAIL' : 'PASS'} ${check.method || 'GET'} ${check.path}${errors.length ? ': ' + errors.join('; ') : ''}`);
}
console.log(`${checks.length - failed}/${checks.length} public HTTP checks passed. Browser login, legal approval and alert delivery require separate verification.`);
process.exitCode = failed ? 1 : 0;
