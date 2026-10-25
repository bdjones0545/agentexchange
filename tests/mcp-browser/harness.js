import {defineReadOnlyTool, registerWebMcpTools} from '@bdjones/webmcp-kit';
import {TabClientTransport} from '@mcp-b/transports';
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const waitFor = async (predicate) => {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for polyfill state');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
};
window.runMcpRegression = async () => {
  assert(!document.modelContext && !navigator.modelContext, 'Expected fresh Chromium without native WebMCP');
  assert(window.isSecureContext, 'Loopback harness must be a secure context');
  window.__webModelContextOptions = {transport: {tabServer: {allowedOrigins: [location.origin]}}};
  let calls = 0;
  const dispose = registerWebMcpTools([defineReadOnlyTool({
    name: 'read_snapshot', description: 'Read synthetic data only',
    inputSchema: {type: 'object', properties: {query: {type: 'string'}}, required: ['query'], additionalProperties: false},
    read: async ({query}) => {calls++; return {query, value: 'synthetic'};},
  })], {enabled: true, polyfill: true});
  const client = new TabClientTransport({targetOrigin: location.origin});
  const pending = new Map();
  client.onmessage = message => pending.get(message.id)?.(message);
  let id = 0;
  const request = async (method, params = {}) => {
    const requestId = ++id;
    let timer;
    try {
      return await new Promise((resolve, reject) => {
        pending.set(requestId, resolve);
        timer = setTimeout(() => reject(new Error(`Timeout: ${method}`)), 10000);
        client.send({jsonrpc: '2.0', id: requestId, method, params}).catch(reject);
      });
    } finally {clearTimeout(timer); pending.delete(requestId);}
  };
  const failed = response => Boolean(response.error || response.result?.isError);
  try {
    await waitFor(() => document.modelContext?.listTools?.().some(t => t.name === 'read_snapshot'));
    assert(document.modelContext === navigator.modelContext, 'Global bridge not mirrored');
    await client.start();
    const init = await request('initialize', {protocolVersion: '2025-11-25', capabilities: {}, clientInfo: {name: 'browser-regression', version: '1'}});
    assert(!init.error, 'MCP initialize failed');
    await client.send({jsonrpc: '2.0', method: 'notifications/initialized'});
    const list = await request('tools/list');
    const tool = list.result?.tools.find(t => t.name === 'read_snapshot');
    assert(tool?.annotations?.readOnlyHint === true, 'Read-only tool missing');
    const valid = await request('tools/call', {name: 'read_snapshot', arguments: {query: 'hello'}});
    assert(!failed(valid), 'Valid tool call failed');
    assert(JSON.parse(valid.result.content[0].text).value === 'synthetic' && calls === 1, 'Unexpected reader result');
    const invalid = await request('tools/call', {name: 'read_snapshot', arguments: {query: 17}});
    assert(failed(invalid) && calls === 1, 'Invalid input reached reader');
    dispose(); dispose(); // cleanup must also tolerate repeated React effect disposal
    await waitFor(() => !document.modelContext.listTools().some(t => t.name === 'read_snapshot'));
    const after = await request('tools/list');
    assert(!after.result.tools.some(t => t.name === 'read_snapshot'), 'Disposed tool remains on wire');
    const removed = await request('tools/call', {name: 'read_snapshot', arguments: {query: 'hello'}});
    assert(failed(removed) && calls === 1, 'Disposed tool still callable');
    return {polyfill: true, initialize: true, readOnlyRegistration: true, validCall: true, invalidInputRejected: true, abortCleanup: true, readerCalls: calls};
  } finally {
    dispose(); await client.close();
    const {cleanupWebModelContext} = await import('@mcp-b/global');
    cleanupWebModelContext();
  }
};
