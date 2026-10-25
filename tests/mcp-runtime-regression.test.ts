/** Offline integration: real MCP-B adapter + patched MCP server, no network or DB. */
import { expect, it } from 'vitest';
import { BrowserMcpServer } from '@mcp-b/webmcp-ts-sdk';
import { defineReadOnlyTool } from '@bdjones/webmcp-kit';

it('preserves real MCP list/call, validation, and abort cleanup with the patched server', async () => {
  const server = new BrowserMcpServer({name: 'offline-regression', version: '1'});
  const controller = new AbortController();
  let calls = 0;
  const messages: any[] = [];
  const transport: any = {
    async start() {}, async close() {},
    async send(message: unknown) { messages.push(message); },
  };
  const request = async (id: number, method: string, params: unknown = {}) => {
    transport.onmessage({jsonrpc:'2.0', id, method, params});
    await expect.poll(() => messages.find(m => m.id === id), {timeout: 2000}).toBeDefined();
    return messages.find(m => m.id === id);
  };
  try {
    await server.registerTool(defineReadOnlyTool({
      name: 'read_snapshot', description: 'Read synthetic snapshot only',
      inputSchema: {type: 'object', properties: {query: {type: 'string'}}, required: ['query'], additionalProperties: false},
      read: async ({query}) => { calls++; return {query, value: 'synthetic'}; },
    }), {signal: controller.signal});
    await server.connect(transport);
    const initialized = await request(1, 'initialize', {protocolVersion:'2025-11-25', capabilities:{}, clientInfo:{name:'offline-test',version:'1'}});
    expect(initialized.error).toBeUndefined();
    transport.onmessage({jsonrpc:'2.0', method:'notifications/initialized'});
    const list = await request(2, 'tools/list');
    expect(list.result.tools.map((t: any) => t.name)).toEqual(['read_snapshot']);
    expect(list.result.tools[0].annotations.readOnlyHint).toBe(true);
    const called = await request(3, 'tools/call', {name:'read_snapshot', arguments:{query:'hello'}});
    expect(called.error).toBeUndefined();
    expect(JSON.parse(called.result.content[0].text)).toEqual({query:'hello',value:'synthetic'});
    expect(calls).toBe(1);
    const invalid = await request(4, 'tools/call', {name:'read_snapshot', arguments:{query:17}});
    expect(Boolean(invalid.error || invalid.result?.isError)).toBe(true);
    expect(calls).toBe(1);
    controller.abort();
    await expect.poll(() => server.listTools().length).toBe(0);
    const removed = await request(5, 'tools/call', {name:'read_snapshot', arguments:{query:'hello'}});
    expect(Boolean(removed.error || removed.result?.isError)).toBe(true);
    expect(calls).toBe(1);
  } finally { controller.abort(); await server.close(); }
});
