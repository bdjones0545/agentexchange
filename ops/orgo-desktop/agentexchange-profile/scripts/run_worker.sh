#!/usr/bin/env bash
# Start the AgentExchange worker runtime (127.0.0.1:2361). Token is read from secrets/worker_token, never argv.
set -euo pipefail
PROFILE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export HERMES_HOME="${HERMES_HOME:-$PROFILE_DIR}"
export HOME=/root
set -a; [ -f "$PROFILE_DIR/.env" ] && source "$PROFILE_DIR/.env"; set +a
export AGENTEXCHANGE_WORKER_TOKEN_FILE="${AGENTEXCHANGE_WORKER_TOKEN_FILE:-$PROFILE_DIR/secrets/worker_token}"
PY="${HERMES_PY:-/usr/local/lib/hermes-agent/venv/bin/python3}"
[ -x "$PY" ] || PY=python3
mkdir -p /var/log/agentexchange "$PROFILE_DIR/logs"
exec "$PY" "$PROFILE_DIR/services/worker/server.py"
