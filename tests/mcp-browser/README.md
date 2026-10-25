# Isolated MCP browser regression

Tests the actual @bdjones/webmcp-kit dynamic @mcp-b/global import and same-origin
TabClientTransport JSON-RPC in Chromium, using synthetic read-only data only.
No application server, authentication, database or live endpoint is used. External
browser requests are blocked and fail the test. Chromium must start without native
WebMCP so the test cannot silently skip the polyfill.

From repository root, after `npm ci --ignore-scripts`:

```
npm ci --ignore-scripts --prefix tests/mcp-browser/runtime
node tests/mcp-browser/runtime/node_modules/playwright/cli.js install --with-deps chromium
node tests/mcp-browser/run.mjs
```

Playwright is pinned in a separate test-only manifest and lockfile, not added to
application production dependencies. CI should run this independently of Vitest.
Coverage: global bridge installation, read-only registration, MCP initialize/list,
valid call, invalid argument rejection before reader execution, repeated disposal,
abort cleanup on the wire, and rejection after removal. This is not application
UI/login coverage, a production test, or a native WebMCP compatibility claim.
