#!/usr/bin/env bash
# Runs inside LXC 129: take_message mid-call -> end-of-call report links the
# lead (no duplicate). Cleans up after itself.
set -euo pipefail
KEY=$(cat /root/.tworing-key-billys-realty)
CID="test-msg-001"

echo "== mid-call take_message =="
curl -s -X POST https://tworing.ai/api/vapi/tools \
  -H "x-vapi-secret: $KEY" -H "Content-Type: application/json" \
  -d "{\"message\":{\"type\":\"tool-calls\",\"call\":{\"id\":\"$CID\"},\"toolCallList\":[{\"id\":\"t1\",\"function\":{\"name\":\"take_message\",\"arguments\":{\"name\":\"Msg Test\",\"phone\":\"+15555550103\",\"message\":\"Wants a callback about listing their condo\",\"jobType\":\"Listing inquiry\"}}}]}}"
echo; echo "== end-of-call report (same call id) =="
curl -s -X POST http://localhost:3000/api/ingest/vapi \
  -H "x-vapi-secret: $KEY" -H "Content-Type: application/json" \
  -d "{\"message\":{\"type\":\"end-of-call-report\",\"call\":{\"id\":\"$CID\",\"customer\":{\"number\":\"+15555550103\"}},\"startedAt\":\"2026-06-12T22:50:00.000Z\",\"endedAt\":\"2026-06-12T22:51:30.000Z\",\"durationSeconds\":90,\"summary\":\"Caller asked for a callback about listing a condo.\",\"analysis\":{\"structuredData\":{\"name\":\"Msg Test\",\"phone\":\"+15555550103\"}}}}"
echo
su - postgres <<'PSQL'
psql -d bilco_platform \
  -c "SELECT o.slug, l.name, l.status, l.notes, (l.\"callId\" IS NOT NULL) AS linked,
             (SELECT count(*) FROM \"Lead\" x WHERE x.\"vapiCallId\" = 'test-msg-001') AS lead_rows
      FROM \"Lead\" l JOIN \"Org\" o ON o.id = l.\"orgId\" WHERE l.\"vapiCallId\" = 'test-msg-001';" \
  -c "DELETE FROM \"Lead\" WHERE \"vapiCallId\" = 'test-msg-001';" \
  -c "DELETE FROM \"Call\" WHERE \"vapiCallId\" = 'test-msg-001';"
PSQL
