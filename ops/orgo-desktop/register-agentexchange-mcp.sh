#!/usr/bin/env bash
# Register AgentExchange as an MCP server in Hermes profiles on orgo-desktop.
#
# Reads KEYS_FILE (lines: <profile>=<key>; `_`-prefixed lines are skipped), and for each profile:
#   1. appends AGENTEXCHANGE_MCP_KEY=<key> to /root/.hermes/profiles/<p>/.env (if absent)
#   2. inserts an `agentexchange:` entry under `mcp_servers:` in config.yaml (if absent)
# Backups: config.yaml.bak-agentexchange-<ts>, .env.bak-agentexchange-<ts>.
# Verify per profile: HERMES_HOME=/root/.hermes/profiles/<p> hermes mcp test agentexchange
set -euo pipefail
KEYS_FILE="${1:?usage: register-agentexchange-mcp.sh <keys.env> [url]}"
URL="${2:-https://www.agentsexchange.ai/api/mcp}"
PROFILES_ROOT="${PROFILES_ROOT:-/root/.hermes/profiles}"
SERVER_NAME="${SERVER_NAME:-agentexchange}"
KEY_VAR="${KEY_VAR:-AGENTEXCHANGE_MCP_KEY}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
while IFS='=' read -r profile key; do
  [[ -z "$profile" || "$profile" == \#* || "$profile" == _* ]] && continue
  dir="$PROFILES_ROOT/$profile"
  if [[ ! -d "$dir" ]]; then echo "skip $profile: no profile dir"; continue; fi
  env_file="$dir/.env"; cfg="$dir/config.yaml"
  touch "$env_file"; chmod 600 "$env_file"
  if grep -q "^$KEY_VAR=" "$env_file"; then
    echo "$profile: key already present (unchanged)"
  else
    cp "$env_file" "$env_file.bak-agentexchange-$TS"
    printf '%s=%s\n' "$KEY_VAR" "$key" >> "$env_file"
    echo "$profile: key added"
  fi
  if grep -q "^  $SERVER_NAME:" "$cfg"; then
    echo "$profile: mcp server already registered"
  elif ! grep -q '^mcp_servers:' "$cfg"; then
    echo "$profile: WARNING no mcp_servers: block in config.yaml — skipped"
  else
    cp "$cfg" "$cfg.bak-agentexchange-$TS"
    python3 - "$cfg" "$URL" "$SERVER_NAME" "$KEY_VAR" <<'PY'
import sys
path, url, server, keyvar = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
lines = open(path).read().split("\n")
out = []
for line in lines:
    out.append(line)
    if line.startswith("mcp_servers:"):
        out += [
            f"  {server}:",
            f"    url: {url}",
            "    headers:",
            "      Authorization: Bearer ${" + keyvar + "}",
        ]
open(path, "w").write("\n".join(out))
PY
    echo "$profile: mcp server registered"
  fi
done < "$KEYS_FILE"
