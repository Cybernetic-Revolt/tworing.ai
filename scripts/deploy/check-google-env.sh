#!/usr/bin/env bash
# Runs inside LXC 129: report whether Google OAuth creds are populated,
# without revealing their values.
set -euo pipefail
for k in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET TOKEN_ENCRYPTION_KEY; do
  v=$(grep "^${k}=" /etc/bilco-platform.env | cut -d= -f2- || true)
  if [ -z "$v" ]; then echo "$k = (empty)"; else echo "$k = SET (${#v} chars)"; fi
done
