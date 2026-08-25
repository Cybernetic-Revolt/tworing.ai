#!/usr/bin/env bash
# Runs inside LXC 129: verify the booking tools authenticate as the
# James Plumbing org after the key repoint. Cleans up after itself.
set -euo pipefail
KEY=$(cat /root/.tworing-key-james-plumbing)

SLOT=$(curl -s -X POST https://tworing.ai/api/vapi/tools \
  -H "x-vapi-secret: $KEY" -H "Content-Type: application/json" \
  -d '{"message":{"type":"tool-calls","call":{"id":"test-split-001"},"toolCallList":[{"id":"t1","function":{"name":"check_availability","arguments":{}}}]}}' \
  | grep -oP '(?<=slotStart: )[0-9TZ:.-]+' | head -1)
echo "slot offered: $SLOT"

curl -s -X POST https://tworing.ai/api/vapi/tools \
  -H "x-vapi-secret: $KEY" -H "Content-Type: application/json" \
  -d "{\"message\":{\"type\":\"tool-calls\",\"call\":{\"id\":\"test-split-001\"},\"toolCallList\":[{\"id\":\"t2\",\"function\":{\"name\":\"book_appointment\",\"arguments\":{\"name\":\"Split Test\",\"phone\":\"+15555550102\",\"slotStart\":\"$SLOT\"}}}]}}" \
  | head -c 200
echo

su - postgres <<'PSQL'
psql -d bilco_platform \
  -c "SELECT o.slug, a.title, a.status FROM \"Appointment\" a JOIN \"Org\" o ON o.id = a.\"orgId\" WHERE a.\"vapiCallId\" = 'test-split-001';" \
  -c "DELETE FROM \"Appointment\" WHERE \"vapiCallId\" = 'test-split-001';"
PSQL
