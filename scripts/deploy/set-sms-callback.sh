#!/usr/bin/env bash
# Runs inside LXC 129: ensure SMS_INBOUND_SECRET, restart, and point the
# VoIP.ms DID's SMS URL callback at our inbound endpoint.
set -euo pipefail
ENV=/etc/bilco-platform.env
if ! grep -q '^SMS_INBOUND_SECRET=' "$ENV"; then
  echo "SMS_INBOUND_SECRET=$(openssl rand -hex 24)" >> "$ENV"
  systemctl restart bilco-platform
  sleep 2
fi
SECRET=$(grep '^SMS_INBOUND_SECRET=' "$ENV" | cut -d= -f2-)
U=$(grep ^VOIPMS_API_USERNAME= "$ENV" | cut -d= -f2)
P=$(grep ^VOIPMS_API_PASSWORD= "$ENV" | cut -d= -f2)
CALLBACK="https://tworing.ai/api/sms/inbound?secret=$SECRET"

curl -s -G "https://voip.ms/api/v1/rest.php" \
  --data-urlencode "api_username=$U" \
  --data-urlencode "api_password=$P" \
  --data-urlencode "method=setSMS" \
  --data-urlencode "did=2899991089" \
  --data-urlencode "enable=1" \
  --data-urlencode "url_callback_enable=1" \
  --data-urlencode "url_callback=$CALLBACK" \
  --data-urlencode "url_callback_retry=1" | python3 -m json.tool
echo "service: $(systemctl is-active bilco-platform)"
