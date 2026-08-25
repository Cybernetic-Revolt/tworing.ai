#!/usr/bin/env bash
# Runs inside LXC 129: fire a synthetic short hang-up call to billys-realty and
# confirm a missed-call text-back SMS is sent (real text to the founder cell).
set -euo pipefail
KEY=$(cat /root/.tworing-key-billys-realty)
CID="test-sms-001"

curl -s -X POST https://tworing.ai/api/ingest/vapi \
  -H "x-vapi-secret: $KEY" -H "Content-Type: application/json" \
  -d "{\"message\":{\"type\":\"end-of-call-report\",\"call\":{\"id\":\"$CID\",\"customer\":{\"number\":\"+14036165487\"}},\"startedAt\":\"2026-06-16T18:00:00Z\",\"endedAt\":\"2026-06-16T18:00:08Z\",\"durationSeconds\":8,\"endedReason\":\"customer-ended-call\"}}" >/dev/null
echo "(posted short hang-up; waiting for text-back)"
sleep 5

echo "== SMS message ledger row =="
su - postgres <<'PSQL'
psql -d bilco_platform -c "SELECT m.channel, m.direction, m.status, m.\"toAddress\", left(m.error,80) AS error, m.template FROM \"Message\" m JOIN \"Call\" c ON c.id = m.\"callId\" WHERE c.\"vapiCallId\" = 'test-sms-001';"
PSQL

echo "== cleanup =="
su - postgres <<'PSQL'
psql -d bilco_platform <<'SQL'
DELETE FROM "Message" m USING "Call" c WHERE m."callId" = c.id AND c."vapiCallId" = 'test-sms-001';
DELETE FROM "Lead" WHERE "vapiCallId" = 'test-sms-001';
DELETE FROM "Call" WHERE "vapiCallId" = 'test-sms-001';
DELETE FROM "SmsThread" WHERE "customerPhone" = '+14036165487';
SQL
PSQL
echo done
