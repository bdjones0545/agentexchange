#!/usr/bin/env bash
# Bind worker.agentsexchange.ai to the existing "trainchat" Cloudflare tunnel (origin
# http://localhost:2361 on orgo-desktop) through the Cloudflare API. Idempotent.
#
# Needs one API token with:  Account · Cloudflare Tunnel · Edit
#                            Zone    · DNS               · Edit   (zone: agentsexchange.ai)
# Create it at https://dash.cloudflare.com/profile/api-tokens ("Create Custom Token").
# Provide it as CLOUDFLARE_API_TOKEN in the environment, or in ~/.config/cloudflare/token (mode 600).
#
# Facts (non-secret, read from the tunnel token payload on the VM):
ACCOUNT_ID="${CF_ACCOUNT_ID:-f993aab42054680fb5b6779c2a67d774}"
TUNNEL_ID="${CF_TUNNEL_ID:-0a737fb5-9bf3-4bd0-8c96-15d391390032}"
ZONE_NAME="${CF_ZONE_NAME:-agentsexchange.ai}"
HOSTNAME_FQDN="${CF_WORKER_HOSTNAME:-worker.agentsexchange.ai}"
ORIGIN="${CF_WORKER_ORIGIN:-http://localhost:2361}"
set -euo pipefail

TOKEN="${CLOUDFLARE_API_TOKEN:-}"
if [ -z "$TOKEN" ] && [ -s "$HOME/.config/cloudflare/token" ]; then TOKEN="$(tr -d '[:space:]' < "$HOME/.config/cloudflare/token")"; fi
if [ -z "$TOKEN" ]; then echo "no token: set CLOUDFLARE_API_TOKEN or write ~/.config/cloudflare/token" >&2; exit 2; fi
API="https://api.cloudflare.com/client/v4"
cf() { curl -sS -m 30 -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "$@"; }
py() { python3 -c "$1" "${@:2}"; }

echo "== token check"
cf "$API/user/tokens/verify" | py 'import json,sys; d=json.load(sys.stdin); print("token:", d["result"]["status"] if d.get("success") else d.get("errors"))'

echo "== tunnel ingress (merge, do not clobber)"
CUR="$(cf "$API/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/configurations")"
NEW="$(printf '%s' "$CUR" | py '
import json,sys
host, origin = sys.argv[1], sys.argv[2]
d = json.load(sys.stdin)
if not d.get("success"): raise SystemExit("read config failed: %s" % d.get("errors"))
cfg = (d.get("result") or {}).get("config") or {}
ingress = [r for r in (cfg.get("ingress") or []) if r.get("hostname") or r.get("service","").startswith("http_status")]
rules = [r for r in ingress if r.get("hostname")]
catch = [r for r in ingress if not r.get("hostname")] or [{"service": "http_status:404"}]
existing = next((r for r in rules if r.get("hostname") == host), None)
if existing and existing.get("service") == origin:
    print(json.dumps({"unchanged": True}))
else:
    rules = [r for r in rules if r.get("hostname") != host] + [{"hostname": host, "service": origin}]
    cfg["ingress"] = rules + catch[:1]
    print(json.dumps({"config": cfg}))
' "$HOSTNAME_FQDN" "$ORIGIN")"
if printf '%s' "$NEW" | grep -q '"unchanged"'; then
  echo "ingress already maps $HOSTNAME_FQDN -> $ORIGIN"
else
  cf -X PUT "$API/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/configurations" --data "$NEW" | py 'import json,sys; d=json.load(sys.stdin); print("ingress updated" if d.get("success") else "ingress FAILED: %s" % d.get("errors"))'
fi

echo "== DNS CNAME"
ZONE_ID="$(cf "$API/zones?name=$ZONE_NAME" | py 'import json,sys; d=json.load(sys.stdin); r=d.get("result") or []; print(r[0]["id"] if r else "")')"
[ -n "$ZONE_ID" ] || { echo "zone $ZONE_NAME not visible to this token" >&2; exit 3; }
TARGET="$TUNNEL_ID.cfargotunnel.com"
REC="$(cf "$API/zones/$ZONE_ID/dns_records?type=CNAME&name=$HOSTNAME_FQDN")"
REC_ID="$(printf '%s' "$REC" | py 'import json,sys; r=(json.load(sys.stdin).get("result") or []); print(r[0]["id"] if r else "")')"
BODY="$(py 'import json,sys; print(json.dumps({"type":"CNAME","name":sys.argv[1],"content":sys.argv[2],"proxied":True,"ttl":1,"comment":"AgentExchange worker runtime on orgo-desktop (tunnel Kevin_hermes -> localhost:2361)"}))' "$HOSTNAME_FQDN" "$TARGET")"
if [ -n "$REC_ID" ]; then
  cf -X PUT "$API/zones/$ZONE_ID/dns_records/$REC_ID" --data "$BODY" | py 'import json,sys; d=json.load(sys.stdin); print("dns updated" if d.get("success") else "dns FAILED: %s" % d.get("errors"))'
else
  cf -X POST "$API/zones/$ZONE_ID/dns_records" --data "$BODY" | py 'import json,sys; d=json.load(sys.stdin); print("dns created" if d.get("success") else "dns FAILED: %s" % d.get("errors"))'
fi

echo "== verify (may take ~30s to propagate)"
for i in $(seq 1 12); do
  if curl -sf -m 10 "https://$HOSTNAME_FQDN/health" >/dev/null 2>&1; then curl -s -m 10 "https://$HOSTNAME_FQDN/health"; echo; echo "worker reachable at https://$HOSTNAME_FQDN"; exit 0; fi
  sleep 5
done
echo "not reachable yet; check with: curl https://$HOSTNAME_FQDN/health"
