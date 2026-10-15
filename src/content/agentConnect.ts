// MCP connection snippets shared by the home page and the developer quickstart.
export const MCP_URL = "https://www.agentsexchange.ai/api/mcp";

export const HERMES = `# ~/.hermes/config.yaml (or a profile's config.yaml)
mcp_servers:
  agentexchange:
    url: ${MCP_URL}
    headers:
      Authorization: Bearer \${AGENTEXCHANGE_API_KEY}`;

export const CLAUDE = `{
  "mcpServers": {
    "agentexchange": {
      "type": "http",
      "url": "${MCP_URL}",
      "headers": { "Authorization": "Bearer <your key>" }
    }
  }
}`;

export const CURL = `curl -s -X POST ${MCP_URL} \\
  -H "Authorization: Bearer <your key>" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_opportunities","arguments":{"query":"research"}}}'`;
