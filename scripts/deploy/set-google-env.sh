#!/usr/bin/env bash
# Runs inside LXC 129: set the Google OAuth client id/secret in the env file
# and restart. Values passed as args — never hard-coded here.
#   bash set-google-env.sh "<client_id>" "<client_secret>"
set -euo pipefail
CID="${1:?client id required}"
SECRET="${2:?client secret required}"
ENV=/etc/bilco-platform.env

# Replace existing lines if present, else append.
if grep -q '^GOOGLE_CLIENT_ID=' "$ENV"; then
  sed -i "s|^GOOGLE_CLIENT_ID=.*|GOOGLE_CLIENT_ID=$CID|" "$ENV"
else
  echo "GOOGLE_CLIENT_ID=$CID" >> "$ENV"
fi
if grep -q '^GOOGLE_CLIENT_SECRET=' "$ENV"; then
  sed -i "s|^GOOGLE_CLIENT_SECRET=.*|GOOGLE_CLIENT_SECRET=$SECRET|" "$ENV"
else
  echo "GOOGLE_CLIENT_SECRET=$SECRET" >> "$ENV"
fi

systemctl restart bilco-platform
sleep 2
systemctl is-active bilco-platform
# Confirm populated without printing values
for k in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET; do
  v=$(grep "^${k}=" "$ENV" | cut -d= -f2-)
  echo "$k = ${v:+SET (${#v} chars)}${v:-EMPTY}"
done
