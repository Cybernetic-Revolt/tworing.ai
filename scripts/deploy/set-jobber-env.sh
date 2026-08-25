#!/usr/bin/env bash
# Runs inside LXC 129: set the Jobber OAuth client id/secret in the env file.
# Values passed as args — never hard-coded.
#   bash set-jobber-env.sh "<client_id>" "<client_secret>"
set -euo pipefail
CID="${1:?client id required}"
SECRET="${2:?client secret required}"
ENV=/etc/bilco-platform.env

set_kv() {
  if grep -q "^$1=" "$ENV"; then
    sed -i "s|^$1=.*|$1=$2|" "$ENV"
  else
    echo "$1=$2" >> "$ENV"
  fi
}
set_kv JOBBER_CLIENT_ID "$CID"
set_kv JOBBER_CLIENT_SECRET "$SECRET"

for k in JOBBER_CLIENT_ID JOBBER_CLIENT_SECRET; do
  v=$(grep "^${k}=" "$ENV" | cut -d= -f2-)
  if [ -z "$v" ]; then echo "$k = EMPTY"; else echo "$k = SET (${#v} chars)"; fi
done
