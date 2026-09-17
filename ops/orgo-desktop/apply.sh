#!/usr/bin/env bash
# Apply the orgo-desktop side of the AgentExchange worker, from the Mac.
# Usage: ops/orgo-desktop/apply.sh <path-to-agentexchange-keys.env>
#
# The keys file (from ops/orgo-desktop/mint-keys.mjs; never committed) has:
#   agentexchange=<ax_ MCP key>      the worker profile's credential for the product's MCP server
#   _worker_token=<token>            the bearer the product uses to call this runtime
#
# Steps (each idempotent, each leaves backups):
#   1. `agentexchange` Hermes profile   -> created if missing; model block copied from the root config (grok-4.6 / xai-oauth)
#   2. agentexchange MCP server + key   -> registered in the worker profile
#   3. Worker runtime under supervisord -> 127.0.0.1:2361, health, MCP discovery check
#   4. Verify                           -> hermes mcp test agentexchange for the worker profile
# Afterwards (once): bind-worker-hostname.sh publishes worker.agentsexchange.ai -> http://localhost:2361.
set -euo pipefail
KEYS="${1:?keys file required (never commit it)}"
HOST="${AX_VM_HOST:-root@100.81.80.33}"
HERE="$(cd "$(dirname "$0")" && pwd)"

ssh "$HOST" 'mkdir -p /root/.hermes/agentexchange-setup/profile && chmod 700 /root/.hermes/agentexchange-setup'
scp -q "$HERE/register-agentexchange-mcp.sh" "$KEYS" "$HOST:/root/.hermes/agentexchange-setup/"
scp -q -r "$HERE/agentexchange-profile/." "$HOST:/root/.hermes/agentexchange-setup/profile/"

ssh "$HOST" bash -s <<'REMOTE'
set -euo pipefail
cd /root/.hermes/agentexchange-setup
KEYS="$(ls *keys*.env | head -1)"; chmod 600 "$KEYS"
P=/root/.hermes/profiles/agentexchange

echo "== 1. agentexchange Hermes profile"
if [ ! -d "$P" ]; then
  timeout 120 hermes profile create agentexchange --no-skills --no-alias --description "AgentExchange worker: a contractor on the marketplace that accepts hire requests and delivers contract work through the agentexchange MCP tools" || true
fi
mkdir -p "$P/services/worker" "$P/scripts" "$P/secrets" "$P/logs"; chmod 700 "$P/secrets"
touch "$P/config.yaml" "$P/.env"; chmod 600 "$P/.env"
python3 - "$P/config.yaml" /root/.hermes/config.yaml <<'PY'
import re, sys
dst, src = sys.argv[1], sys.argv[2]
root = open(src).read()
m = re.search(r"^model:\n((?:[ \t]+.*\n)+)", root, re.M)
block = "model:\n" + m.group(1) if m else "model:\n  default: grok-4.6\n  provider: xai-oauth\n  base_url: https://api.x.ai/v1\n"
cur = open(dst).read()
if re.search(r"^model:", cur, re.M):
    cur = re.sub(r"^model:\n(?:[ \t]+.*\n)+", block, cur, count=1, flags=re.M)
else:
    cur = block + cur
if not re.search(r"^mcp_servers:", cur, re.M):
    cur = cur.rstrip("\n") + "\nmcp_servers:\n"
open(dst, "w").write(cur)
print("model block:", block.strip().replace("\n", " | "))
PY
if grep -q '^  tool_search:' "$P/config.yaml"; then
  echo "tool_search setting already present"
else
  printf 'tools:\n  tool_search:\n    enabled: false\n' >> "$P/config.yaml"
  echo "tool_search disabled for the worker profile (9 tools stay visible)"
fi
for src in /root/.hermes/.env /root/.hermes/profiles/sarah/.env; do
  [ -f "$src" ] || continue
  grep -E '^XAI_[A-Z_]+=' "$src" | while IFS= read -r line; do
    k="${line%%=*}"; grep -q "^$k=" "$P/.env" || echo "$line" >> "$P/.env"
  done
done
grep -cE '^XAI_' "$P/.env" | sed 's/^/xai vars in profile .env: /'
cp profile/SOUL.md "$P/SOUL.md"
cp profile/services/worker/server.py "$P/services/worker/server.py"
cp profile/scripts/run_worker.sh "$P/scripts/run_worker.sh"; chmod +x "$P/scripts/run_worker.sh"
grep '^_worker_token=' "$KEYS" | cut -d= -f2- | tr -d '\n' > "$P/secrets/worker_token"; chmod 600 "$P/secrets/worker_token"
[ -s "$P/secrets/worker_token" ] && echo "worker token installed" || { echo "ERROR: no _worker_token in keys file"; exit 1; }

echo "== 2. Register agentexchange MCP in the worker profile"
bash register-agentexchange-mcp.sh "$KEYS"

echo "== 3. Worker runtime under supervisord"
mkdir -p /var/log/agentexchange
OWNER="$( { ss -lntp 2>/dev/null | grep ":2361 " | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2; } || true )"
if [ -n "$OWNER" ] && ! ps -o args= -p "$OWNER" 2>/dev/null | grep -q "services/worker/server.py"; then
  echo "ERROR: port 2361 is held by pid $OWNER ($(ps -o args= -p "$OWNER" | cut -c1-80)); pick another port in agentexchange-worker.conf"; exit 1
fi
cp profile/supervisor/agentexchange-worker.conf /etc/supervisor/conf.d/agentexchange-worker.conf
supervisorctl reread >/dev/null; supervisorctl update agentexchange-worker >/dev/null || true
supervisorctl restart agentexchange-worker >/dev/null || true
for i in $(seq 1 60); do curl -sf -m 3 http://127.0.0.1:2361/health >/dev/null 2>&1 && break; sleep 2; done
supervisorctl status agentexchange-worker
curl -s -m 5 http://127.0.0.1:2361/health; echo

echo "== 4. Verify MCP connection from the worker profile"
cd /root
timeout 90 env HERMES_HOME=/root/.hermes/profiles/agentexchange hermes mcp test agentexchange 2>&1 | tail -3 || true
free -m | sed -n 2p; df -h / | tail -1
echo
echo "NEXT (once): ops/orgo-desktop/bind-worker-hostname.sh  ->  worker.agentsexchange.ai -> http://localhost:2361"
REMOTE
