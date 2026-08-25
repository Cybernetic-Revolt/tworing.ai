#!/usr/bin/env bash
# Runs inside LXC 129: verify the carrier/engineering work end to end.
# 1. VoIP.ms DID config matches the intended (original) state
# 2. DB PhoneNumber rows match the live Vapi account bindings
# 3. /app/engineering renders for a real engineer session (JWT minted
#    locally with the server's own SESSION_SECRET)
# 4. Booking tools regression check
set -euo pipefail
PASS=0; FAIL=0
ok()   { echo "PASS: $1"; PASS=$((PASS+1)); }
bad()  { echo "FAIL: $1"; FAIL=$((FAIL+1)); }

U=$(grep ^VOIPMS_API_USERNAME= /etc/bilco-platform.env | cut -d= -f2)
P=$(grep ^VOIPMS_API_PASSWORD= /etc/bilco-platform.env | cut -d= -f2)
VAPI=$(grep ^VAPI_API_KEY= /etc/bilco-platform.env | cut -d= -f2)

echo "== 1. VoIP.ms DID config =="
DID_JSON=$(curl -s "https://voip.ms/api/v1/rest.php?api_username=$U&api_password=$P&method=getDIDsInfo&did=2899991089")
ROUTING=$(echo "$DID_JSON" | python3 -c 'import json,sys; d=json.load(sys.stdin)["dids"][0]; print(d["routing"])')
FB=$(echo "$DID_JSON" | python3 -c 'import json,sys; d=json.load(sys.stdin)["dids"][0]; print(d["failover_busy"], d["failover_unreachable"], d["failover_noanswer"])')
[ "$ROUTING" = "account:548365_bilco1" ] && ok "primary routing -> SIP/Vapi ($ROUTING)" || bad "routing is $ROUTING"
[ "$FB" = "fwd:2325739 fwd:2325739 fwd:2325739" ] && ok "failover all 3 conditions -> fwd:2325739 (403-616-5487 cell)" || bad "failover is $FB"

echo "== 2. DB vs live Vapi bindings =="
curl -s -H "Authorization: Bearer $VAPI" https://api.vapi.ai/phone-number \
  | python3 -c '
import json,sys
m = {p["number"]: p.get("assistantId") for p in json.load(sys.stdin) if p.get("number")}
for num, aid in sorted(m.items()): print(f"{num} {aid}")
' > /tmp/vapi-map.txt
su - postgres <<'PSQL' > /tmp/db-map.txt
psql -At -d bilco_platform -c "SELECT e164 || ' ' || \"vapiAssistantId\" FROM \"PhoneNumber\" WHERE \"vapiAssistantId\" IS NOT NULL ORDER BY e164;"
PSQL
if diff -q /tmp/vapi-map.txt /tmp/db-map.txt > /dev/null; then
  ok "DB bindings identical to live Vapi account ($(wc -l < /tmp/db-map.txt) numbers)"
else
  bad "DB/Vapi mismatch:"; diff /tmp/vapi-map.txt /tmp/db-map.txt || true
fi

echo "== 3. Engineering tab (authenticated render) =="
ORG_ID=$(su - postgres <<'PSQL'
psql -At -d bilco_platform -c "SELECT id FROM \"Org\" WHERE slug = 'bilco';"
PSQL
)
USER_ID=$(su - postgres <<'PSQL'
psql -At -d bilco_platform -c "SELECT id FROM \"User\" WHERE email = 'message@bilco.ca';"
PSQL
)
TOKEN=$(cd /opt/bilco-platform && SESSION_SECRET=$(grep ^SESSION_SECRET= /etc/bilco-platform.env | cut -d= -f2) \
  ORG_ID=$ORG_ID USER_ID=$USER_ID node --input-type=module -e '
import { SignJWT } from "jose";
const t = await new SignJWT({
  userId: process.env.USER_ID, orgId: process.env.ORG_ID,
  role: "OWNER", email: "message@bilco.ca", engineer: true,
}).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m")
  .sign(new TextEncoder().encode(process.env.SESSION_SECRET));
console.log(t);')
curl -s http://localhost:3000/app/engineering -H "Cookie: bilco_session=$TOKEN" -o /tmp/eng.html -w "http %{http_code}\n"
grep -q "548365_bilco1" /tmp/eng.html && ok "SIP subaccount shown" || bad "SIP subaccount missing"
grep -q "+14036165487" /tmp/eng.html && ok "failover target shown" || bad "failover target missing"
grep -q "Vapi connection" /tmp/eng.html && ok "Vapi section rendered" || bad "Vapi section missing"
grep -qE "James Plumbing|assistants" /tmp/eng.html && ok "live assistant map rendered" || bad "assistant map missing"
grep -q "Recent ingest deliveries" /tmp/eng.html && ok "ingest deliveries section rendered" || bad "ingest section missing"

echo "== 4. Booking tools regression =="
KEY=$(cat /root/.bilco-ingest-key)
TOOLS=$(curl -s -X POST https://tworing.ai/api/vapi/tools \
  -H "x-vapi-secret: $KEY" -H "Content-Type: application/json" \
  -d '{"message":{"type":"tool-calls","call":{"id":"test-verify-001"},"toolCallList":[{"id":"t1","function":{"name":"check_availability","arguments":{}}}]}}')
echo "$TOOLS" | grep -q "slotStart" && ok "check_availability returns slots" || bad "tools endpoint broken: $TOOLS"

echo
echo "RESULT: $PASS passed, $FAIL failed"
exit $FAIL
