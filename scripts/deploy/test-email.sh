#!/usr/bin/env bash
# Runs inside LXC 129: set a notify email on james-plumbing, fire a synthetic
# end-of-call report, and check the Message ledger records the send + Resend's
# response. Cleans up after.
set -euo pipefail
KEY=$(cat /root/.tworing-key-james-plumbing)
CID="test-email-001"

su - postgres <<'PSQL'
psql -d bilco_platform -c "UPDATE \"Org\" SET \"notifyEmail\" = 'message@bilco.ca' WHERE slug = 'james-plumbing';"
PSQL

echo "== fire end-of-call report =="
curl -s -X POST https://tworing.ai/api/ingest/vapi \
  -H "x-vapi-secret: $KEY" -H "Content-Type: application/json" \
  -d "{\"message\":{\"type\":\"end-of-call-report\",\"call\":{\"id\":\"$CID\",\"customer\":{\"number\":\"+15555550170\"}},\"startedAt\":\"2026-06-16T17:00:00Z\",\"endedAt\":\"2026-06-16T17:02:00Z\",\"durationSeconds\":120,\"summary\":\"Test caller wants a quote for a water heater swap.\",\"analysis\":{\"structuredData\":{\"name\":\"Email Test\",\"jobType\":\"Water heater\",\"urgency\":\"this week\"}}}}" >/dev/null
echo "(posted; waiting for fire-and-forget email)"
sleep 5

echo "== Message ledger row =="
su - postgres <<'PSQL'
psql -d bilco_platform <<'SQL'
SELECT m.template, m.status, m."toAddress", left(m.error, 90) AS error, m.subject
FROM "Message" m JOIN "Org" o ON o.id = m."orgId"
WHERE o.slug = 'james-plumbing' ORDER BY m."createdAt" DESC LIMIT 1;
SQL
PSQL

echo "== cleanup =="
su - postgres <<'PSQL'
psql -d bilco_platform <<'SQL'
DELETE FROM "Message" m USING "Call" c WHERE m."callId" = c.id AND c."vapiCallId" = 'test-email-001';
DELETE FROM "Lead" WHERE "vapiCallId" = 'test-email-001';
DELETE FROM "Call" WHERE "vapiCallId" = 'test-email-001';
UPDATE "Org" SET "notifyEmail" = NULL WHERE slug = 'james-plumbing';
SQL
PSQL
echo done
