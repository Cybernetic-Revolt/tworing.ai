#!/usr/bin/env bash
# Runs inside LXC 129: book a synthetic appointment through the public tool
# endpoint, verify the row, then delete it.
set -euo pipefail
KEY=$(cat /root/.bilco-ingest-key)

SLOT=$(curl -s -X POST https://tworing.ai/api/vapi/tools \
  -H "x-vapi-secret: $KEY" -H "Content-Type: application/json" \
  -d '{"message":{"type":"tool-calls","call":{"id":"test-book-001"},"toolCallList":[{"id":"tc1","function":{"name":"check_availability","arguments":{}}}]}}' \
  | grep -oP '(?<=slotStart: )[0-9TZ:.-]+' | head -1)
echo "first open slot: $SLOT"

curl -s -X POST https://tworing.ai/api/vapi/tools \
  -H "x-vapi-secret: $KEY" -H "Content-Type: application/json" \
  -d "{\"message\":{\"type\":\"tool-calls\",\"call\":{\"id\":\"test-book-001\"},\"toolCallList\":[{\"id\":\"tc2\",\"function\":{\"name\":\"book_appointment\",\"arguments\":{\"name\":\"E2E Test\",\"phone\":\"+15555550100\",\"address\":\"123 Test St\",\"jobType\":\"Pipe test\",\"slotStart\":\"$SLOT\"}}}]}}"
echo

echo "== double-book attempt (must refuse) =="
curl -s -X POST https://tworing.ai/api/vapi/tools \
  -H "x-vapi-secret: $KEY" -H "Content-Type: application/json" \
  -d "{\"message\":{\"type\":\"tool-calls\",\"call\":{\"id\":\"test-book-002\"},\"toolCallList\":[{\"id\":\"tc3\",\"function\":{\"name\":\"book_appointment\",\"arguments\":{\"name\":\"Conflict Test\",\"phone\":\"+15555550101\",\"slotStart\":\"$SLOT\"}}}]}}"
echo

su - postgres <<'PSQL'
psql -d bilco_platform \
  -c 'SELECT title, status, source, "startsAt", "vapiCallId" FROM "Appointment";' \
  -c 'DELETE FROM "Appointment" WHERE "vapiCallId" LIKE $$test-book-%$$;' \
  -c 'SELECT count(*) AS remaining FROM "Appointment";'
PSQL
