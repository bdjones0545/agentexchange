#!/usr/bin/env bash
# Prove the worker runtime from outside: health shows the MCP server registered,
# an unauthenticated /turn is refused, a sweep is accepted and completes.
# Usage: scripts/check_worker.sh https://worker.agentsexchange.ai <token-file>
set -euo pipefail
BASE="${1:?base url}"; TOKEN="$(tr -d '[:space:]' < "${2:?token file}")"
echo "== health"
curl -s -m 10 "$BASE/health" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("ready:", d.get("ready"), "| model:", d.get("model"), "| mcpServers:", d.get("mcpServers"), "| mcpTools:", d.get("mcpTools"), "| queue:", d.get("queue"))'
echo "== unauthenticated /turn"
curl -s -o /dev/null -w 'HTTP %{http_code}\n' -m 10 -X POST "$BASE/turn" -H 'content-type: application/json' -d '{"event":"sweep"}'
echo "== authenticated sweep"
JOB="$(curl -s -m 10 -X POST "$BASE/sweep" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{}' | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("jobId") or ""); sys.stderr.write(json.dumps(d)+"\n")')"
[ -n "$JOB" ] || { echo "sweep not accepted"; exit 1; }
for i in $(seq 1 60); do
  OUT="$(curl -s -m 10 "$BASE/jobs/$JOB" -H "authorization: Bearer $TOKEN")"
  STATUS="$(printf '%s' "$OUT" | python3 -c 'import json,sys; print((json.load(sys.stdin).get("job") or {}).get("status",""))')"
  if [ "$STATUS" = "done" ] || [ "$STATUS" = "failed" ]; then
    printf '%s' "$OUT" | python3 -c 'import json,sys; j=json.load(sys.stdin)["job"]; r=j.get("result") or {}; print("status:", j["status"], "| actions:", r.get("actions"), "| timing:", r.get("timing")); print("text:", (r.get("text") or r.get("error") or "")[:400])'
    exit 0
  fi
  sleep 3
done
echo "job $JOB still $STATUS after 180s"; exit 1
