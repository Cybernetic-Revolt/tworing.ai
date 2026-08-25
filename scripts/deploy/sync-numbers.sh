#!/usr/bin/env bash
# Runs inside LXC 129: upsert org bilco's AI numbers from the live Vapi
# account, including carrier facts for the VoIP.ms DID.
set -euo pipefail
KEY=$(grep ^VAPI_API_KEY= /etc/bilco-platform.env | cut -d= -f2)

curl -s -H "Authorization: Bearer $KEY" https://api.vapi.ai/phone-number \
  | python3 -c '
import json, sys
rows = []
for p in json.load(sys.stdin):
    num = p.get("number")
    aid = p.get("assistantId")
    if not num or not aid:
        continue
    label = (p.get("name") or "Vapi number").replace("$", "")
    provider = "voipms" if p.get("provider") == "byo-phone-number" else "vapi"
    rows.append((num, label, provider, aid))
print(f"-- {len(rows)} numbers from Vapi")
for num, label, provider, aid in rows:
    print(f"""INSERT INTO "PhoneNumber" (id, "orgId", e164, label, provider, "vapiAssistantId")
SELECT gen_random_uuid()::text, id, $${num}$$, $${label}$$, $${provider}$$, $${aid}$$
FROM "Org" WHERE slug = $$bilco$$
ON CONFLICT (e164) DO UPDATE SET "vapiAssistantId" = $${aid}$$, provider = $${provider}$$;""")
' > /tmp/sync-numbers.sql

cat /tmp/sync-numbers.sql
su - postgres <<'PSQL'
psql -d bilco_platform -f /tmp/sync-numbers.sql \
  -c 'UPDATE "PhoneNumber"
      SET "sipSubaccount" = $$548365_bilco1$$, "failoverE164" = $$+14036165487$$
      WHERE e164 = $$+12899991089$$;' \
  -c 'SELECT e164, label, provider, "sipSubaccount", "failoverE164",
             left("vapiAssistantId", 8) AS assistant
      FROM "PhoneNumber" ORDER BY e164;'
PSQL
