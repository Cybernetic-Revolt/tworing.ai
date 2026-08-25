#!/usr/bin/env bash
# Runs inside LXC 129: configure a webhook on james-plumbing → httpbin echo,
# fire a booking through the tools endpoint, confirm delivery, then clean up.
set -euo pipefail
KEY=$(cat /root/.tworing-key-james-plumbing)

echo "== set webhook on james-plumbing → httpbin =="
su - postgres <<'PSQL'
psql -d bilco_platform <<'SQL'
INSERT INTO "OrgWebhook" (id, "orgId", url, secret, enabled, "updatedAt")
SELECT gen_random_uuid()::text, id, 'https://httpbin.org/post', 'whsec_test', true, now()
FROM "Org" WHERE slug = 'james-plumbing'
ON CONFLICT ("orgId") DO UPDATE SET url = EXCLUDED.url, enabled = true, "lastStatus" = NULL, "lastError" = NULL;
SQL
PSQL

echo "== fire a booking =="
SLOT=$(curl -s -X POST https://tworing.ai/api/vapi/tools \
  -H "x-vapi-secret: $KEY" -H "Content-Type: application/json" \
  -d '{"message":{"type":"tool-calls","call":{"id":"test-wh-001"},"toolCallList":[{"id":"t1","function":{"name":"check_availability","arguments":{}}}]}}' \
  | grep -oP '(?<=slotStart: )[0-9TZ:.-]+' | head -1)
curl -s -X POST https://tworing.ai/api/vapi/tools \
  -H "x-vapi-secret: $KEY" -H "Content-Type: application/json" \
  -d "{\"message\":{\"type\":\"tool-calls\",\"call\":{\"id\":\"test-wh-001\"},\"toolCallList\":[{\"id\":\"t2\",\"function\":{\"name\":\"book_appointment\",\"arguments\":{\"name\":\"Webhook Test\",\"phone\":\"+15555550150\",\"slotStart\":\"$SLOT\"}}}]}}" >/dev/null
echo "(booked; waiting for fire-and-forget delivery)"
sleep 4

echo "== webhook result =="
su - postgres <<'PSQL'
psql -d bilco_platform <<'SQL'
SELECT o.slug, w."lastStatus", w."lastError", (w."lastFiredAt" IS NOT NULL) AS fired
FROM "OrgWebhook" w JOIN "Org" o ON o.id = w."orgId" WHERE o.slug = 'james-plumbing';
SQL
PSQL

echo "== cleanup =="
su - postgres <<'PSQL'
psql -d bilco_platform <<'SQL'
DELETE FROM "Appointment" WHERE "vapiCallId" = 'test-wh-001';
DELETE FROM "OrgWebhook" w USING "Org" o WHERE w."orgId" = o.id AND o.slug = 'james-plumbing';
SQL
PSQL
echo "done"
