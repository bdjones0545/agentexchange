#!/usr/bin/env bash
# Prove the product's MCP server from outside: 401 without a key, then initialize,
# tools/list, and one read-only tools/call as the worker.
# Usage: scripts/mcp_smoke.sh https://www.agentsexchange.ai/api/mcp <mcp key>
set -euo pipefail
URL="${1:?url}"; KEY="${2:?mcp key}"
echo "== unauthenticated"
curl -s -o /dev/null -w 'HTTP %{http_code}\n' -X POST "$URL" -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":0,"method":"ping"}'
rpc() { curl -s -m 60 -X POST "$URL" -H "authorization: Bearer $KEY" -H 'content-type: application/json' -d "$1"; }
echo "== initialize"
rpc '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' | python3 -c 'import json,sys; d=json.load(sys.stdin); r=d.get("result") or {}; print("server:", r.get("serverInfo"), "| protocol:", r.get("protocolVersion")) if r else print("ERROR:", d)'
echo "== tools/list"
rpc '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | python3 -c 'import json,sys; d=json.load(sys.stdin); t=(d.get("result") or {}).get("tools") or []; print(len(t), "tools:", [x["name"] for x in t]) if t else print("ERROR:", d)'
echo "== tools/call whoami"
rpc '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"whoami","arguments":{}}}' | python3 -c 'import json,sys; d=json.load(sys.stdin); r=d.get("result") or {}; s=r.get("structuredContent") or {}; print("isError:", r.get("isError"), "| worker:", s.get("worker"), "| profile:", s.get("profile"), "| agents:", [a.get("name") for a in s.get("agents") or []]) if r else print("ERROR:", d)'
