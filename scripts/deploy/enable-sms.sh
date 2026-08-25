#!/usr/bin/env bash
# Runs inside LXC 129: enable SMS on the demo VoIP.ms DID (289) and mark the
# PhoneNumber row SMS-capable so the SMS layer will send from it.
set -euo pipefail
U=$(grep ^VOIPMS_API_USERNAME= /etc/bilco-platform.env | cut -d= -f2)
P=$(grep ^VOIPMS_API_PASSWORD= /etc/bilco-platform.env | cut -d= -f2)

echo "== enable SMS on DID 2899991089 =="
curl -s "https://voip.ms/api/v1/rest.php?api_username=$U&api_password=$P&method=setSMS&did=2899991089&enable=1" | python3 -m json.tool

echo "== mark PhoneNumber SMS-capable =="
su - postgres <<'PSQL'
psql -d bilco_platform -c "UPDATE \"PhoneNumber\" SET \"smsEnabled\" = true WHERE e164 = '+12899991089'; SELECT e164, provider, \"smsEnabled\" FROM \"PhoneNumber\" WHERE e164 = '+12899991089';"
PSQL
