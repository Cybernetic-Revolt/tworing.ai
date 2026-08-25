#!/usr/bin/env bash
# Runs on the nginx VM (10.10.1.10): point the tworing.ai zone at the
# bilco tunnel and remove the junk records cloudflared created in bilco.ca.
set -euo pipefail

TUNNEL="1c8de40d-340c-4038-9b82-942795670df4.cfargotunnel.com"
TOKEN=$(grep -oP '(?<=dns_cloudflare_api_token = ).*' /etc/letsencrypt/cloudflare.ini | tr -d ' \r')
API="https://api.cloudflare.com/client/v4"

cf() { # method path [json-body]
  local method=$1 path=$2 body=${3:-}
  if [ -n "$body" ]; then
    curl -s -X "$method" "$API$path" \
      -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
      --data "$body"
  else
    curl -s -X "$method" "$API$path" -H "Authorization: Bearer $TOKEN"
  fi
}

echo "== zones visible to this token =="
cf GET "/zones?per_page=50" | python3 -c '
import json,sys
d=json.load(sys.stdin)
if not d.get("success"): print("ERROR:", d.get("errors")); sys.exit(1)
for z in d["result"]: print(z["name"], z["id"])
'

ZONE_TWORING=$(cf GET "/zones?name=tworing.ai" | python3 -c 'import json,sys; r=json.load(sys.stdin)["result"]; print(r[0]["id"] if r else "")')
ZONE_BILCO=$(cf GET "/zones?name=bilco.ca" | python3 -c 'import json,sys; r=json.load(sys.stdin)["result"]; print(r[0]["id"] if r else "")')
echo "tworing zone: ${ZONE_TWORING:-NOT VISIBLE}; bilco zone: ${ZONE_BILCO:-NOT VISIBLE}"

if [ -n "$ZONE_TWORING" ]; then
  echo "== existing records in tworing.ai =="
  cf GET "/zones/$ZONE_TWORING/dns_records?per_page=100" | python3 -c '
import json,sys
for r in json.load(sys.stdin)["result"]:
    print(r["id"], r["type"], r["name"], "->", r["content"], "proxied" if r["proxied"] else "dns-only")
'
  # Delete any existing A/AAAA/CNAME on apex + www, then create tunnel CNAMEs.
  for NAME in tworing.ai www.tworing.ai; do
    IDS=$(cf GET "/zones/$ZONE_TWORING/dns_records?name=$NAME" | python3 -c '
import json,sys
for r in json.load(sys.stdin)["result"]:
    if r["type"] in ("A","AAAA","CNAME"): print(r["id"])
')
    for ID in $IDS; do
      cf DELETE "/zones/$ZONE_TWORING/dns_records/$ID" >/dev/null
      echo "deleted old record $ID ($NAME)"
    done
    cf POST "/zones/$ZONE_TWORING/dns_records" \
      "{\"type\":\"CNAME\",\"name\":\"$NAME\",\"content\":\"$TUNNEL\",\"proxied\":true}" \
      | python3 -c 'import json,sys; d=json.load(sys.stdin); print("created:", d["result"]["name"], "->", d["result"]["content"]) if d.get("success") else print("CREATE ERROR:", d.get("errors"))'
  done
fi

if [ -n "$ZONE_BILCO" ]; then
  echo "== removing junk tworing.ai.bilco.ca records =="
  for NAME in tworing.ai.bilco.ca www.tworing.ai.bilco.ca; do
    IDS=$(cf GET "/zones/$ZONE_BILCO/dns_records?name=$NAME" | python3 -c '
import json,sys
for r in json.load(sys.stdin)["result"]: print(r["id"])
')
    for ID in $IDS; do
      cf DELETE "/zones/$ZONE_BILCO/dns_records/$ID" >/dev/null
      echo "deleted junk $NAME ($ID)"
    done
  done
fi
