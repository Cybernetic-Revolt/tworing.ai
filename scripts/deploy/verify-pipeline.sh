#!/usr/bin/env bash
# Runs on the Proxmox host: fire a labeled test end-of-call at the live n8n
# webhook, then confirm it was forwarded into the platform database.
set -euo pipefail

cat > /tmp/fire.sh <<'SH'
curl -s -X POST -H "content-type: application/json" \
  -d '{"message":{"type":"end-of-call-report","call":{"id":"n8n-fwd-test-001","customer":{"number":"+15555550199"}},"startedAt":"2026-06-10T03:30:00Z","endedAt":"2026-06-10T03:31:00Z","durationSeconds":60,"summary":"TEST: n8n-to-platform forwarding verification - please ignore","transcript":"(test transcript)","analysis":{"summary":"TEST: forwarding verification - ignore this email","structuredData":{"name":"Forwarding Test","phone":"+15555550199","job_type":"integration-test"}}}}' \
  http://localhost:5678/webhook/1d9d12be-2896-4c1c-9d33-e9699c0fb21b
echo
SH
pct push 127 /tmp/fire.sh /tmp/fire.sh
pct exec 127 -- bash /tmp/fire.sh
pct exec 127 -- rm -f /tmp/fire.sh

sleep 5

cat > /tmp/check.sh <<'SH'
su - postgres <<'PSQL'
psql -d bilco_platform -c 'SELECT "vapiCallId","callerNumber",summary FROM "Call" ORDER BY "startedAt";' \
  -c 'SELECT phone,name,"jobType",status FROM "Lead" ORDER BY "createdAt";'
PSQL
SH
pct push 129 /tmp/check.sh /tmp/check.sh
pct exec 129 -- bash /tmp/check.sh
rm -f /tmp/fire.sh /tmp/check.sh
