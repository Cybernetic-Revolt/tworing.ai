#!/usr/bin/env bash
# Runs on the Proxmox host: backfill real calls 127 -> platform, then remove
# the synthetic demo rows and show final counts.
set -euo pipefail

pct pull 129 /root/.bilco-ingest-key /tmp/.bk
pct push 127 /tmp/.bk /tmp/.bk
rm -f /tmp/.bk
pct push 127 /tmp/backfill.py /tmp/backfill.py
pct exec 127 -- python3 /tmp/backfill.py
pct exec 127 -- rm -f /tmp/.bk /tmp/backfill.py

cat > /tmp/cleanup.sh <<'SH'
su - postgres <<'PSQL'
psql -d bilco_platform \
  -c 'DELETE FROM "Lead" WHERE "callId" IN (SELECT id FROM "Call" WHERE "vapiCallId" IN ($$e2e-test-001$$, $$n8n-fwd-test-001$$));' \
  -c 'DELETE FROM "Call" WHERE "vapiCallId" IN ($$e2e-test-001$$, $$n8n-fwd-test-001$$);' \
  -c 'SELECT count(*) AS calls FROM "Call";' \
  -c 'SELECT count(*) AS leads FROM "Lead";' \
  -c 'SELECT "vapiCallId","callerName","startedAt" FROM "Call" ORDER BY "startedAt" DESC LIMIT 5;'
PSQL
SH
pct push 129 /tmp/cleanup.sh /tmp/cleanup.sh
pct exec 129 -- bash /tmp/cleanup.sh
rm -f /tmp/cleanup.sh /tmp/backfill.py
