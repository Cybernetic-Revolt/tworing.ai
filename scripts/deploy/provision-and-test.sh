#!/usr/bin/env bash
# Runs inside LXC 129: provision the Bilco Works org, stash the ingest key at
# /root/.bilco-ingest-key, then round-trip a synthetic end-of-call through the
# local ingest endpoint and show what landed in Postgres.
set -euo pipefail

cd /opt/bilco-platform
OUT=$(su -s /bin/bash bilco -c "cd /opt/bilco-platform && npm run provision -- --name 'Bilco Works' --slug bilco --email message@bilco.ca --tier OPERATIONS" 2>&1)
echo "$OUT" | grep -v "blk_" || true

KEY=$(echo "$OUT" | grep -oE "blk_[A-Za-z0-9_-]+" | head -1)
[ -n "$KEY" ] || { echo "no ingest key captured"; echo "$OUT"; exit 1; }
printf "%s" "$KEY" > /root/.bilco-ingest-key
chmod 600 /root/.bilco-ingest-key
echo "ingest key stored at /root/.bilco-ingest-key"

CODE=$(curl -s -o /tmp/resp.json -w "%{http_code}" \
  -H "x-bilco-ingest-key: $KEY" -H "content-type: application/json" \
  -d '{"message":{"type":"end-of-call-report","call":{"id":"e2e-test-001","customer":{"number":"+15555550100"}},"startedAt":"2026-06-10T03:00:00Z","endedAt":"2026-06-10T03:02:00Z","durationSeconds":120,"summary":"E2E test call","transcript":"test transcript","analysis":{"summary":"E2E test","structuredData":{"name":"Test Caller","phone":"+15555550100","job_type":"test"}}}}' \
  http://localhost:3000/api/ingest/vapi)
echo "ingest test -> http $CODE"
cat /tmp/resp.json; echo

su - postgres <<'EOF'
psql -d bilco_platform \
  -c 'SELECT "vapiCallId","callerNumber","durationSec",summary FROM "Call";' \
  -c 'SELECT phone,name,"jobType",status FROM "Lead";'
EOF
