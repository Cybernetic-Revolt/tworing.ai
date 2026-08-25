#!/usr/bin/env bash
# Runs inside LXC 129: simulate VoIP.ms inbound-SMS callbacks (a normal reply
# and a STOP) and verify they're recorded + CASL opt-out is honored. Cleans up.
set -euo pipefail
SECRET=$(grep '^SMS_INBOUND_SECRET=' /etc/bilco-platform.env | cut -d= -f2-)
BASE="http://localhost:3000/api/sms/inbound"

echo "== inbound reply =="
curl -s -G "$BASE" --data-urlencode "secret=$SECRET" --data-urlencode "from=4035550123" \
  --data-urlencode "to=2899991089" --data-urlencode "message=Yes tomorrow works" --data-urlencode "id=in1"; echo
echo "== inbound STOP =="
curl -s -G "$BASE" --data-urlencode "secret=$SECRET" --data-urlencode "from=4035550123" \
  --data-urlencode "to=2899991089" --data-urlencode "message=STOP" --data-urlencode "id=in2"; echo
echo "== bad secret (expect forbidden) =="
curl -s -G "$BASE" --data-urlencode "secret=wrong" --data-urlencode "from=4035550123" \
  --data-urlencode "to=2899991089" --data-urlencode "message=hi"; echo

echo "== result =="
su - postgres <<'PSQL'
psql -d bilco_platform <<'SQL'
SELECT m.direction, m.status, m.body FROM "Message" m WHERE m."fromAddress" = '+14035550123' ORDER BY m."createdAt";
SELECT customer_thread.consentstate FROM (SELECT "consentState" AS consentstate FROM "SmsThread" WHERE "customerPhone" = '+14035550123') customer_thread;
SQL
PSQL

echo "== cleanup =="
su - postgres <<'PSQL'
psql -d bilco_platform <<'SQL'
DELETE FROM "Message" WHERE "fromAddress" = '+14035550123';
DELETE FROM "SmsThread" WHERE "customerPhone" = '+14035550123';
SQL
PSQL
echo done
