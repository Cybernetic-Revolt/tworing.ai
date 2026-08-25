#!/usr/bin/env bash
# Runs inside LXC 129: set the Resend API key. Value passed as arg.
#   bash set-resend-env.sh "<re_...>"
set -euo pipefail
KEY="${1:?resend key required}"
ENV=/etc/bilco-platform.env
if grep -q '^RESEND_API_KEY=' "$ENV"; then
  sed -i "s|^RESEND_API_KEY=.*|RESEND_API_KEY=$KEY|" "$ENV"
else
  echo "RESEND_API_KEY=$KEY" >> "$ENV"
fi
grep -q '^MAIL_FROM_DOMAIN=' "$ENV" || echo "MAIL_FROM_DOMAIN=mail.tworing.ai" >> "$ENV"
v=$(grep '^RESEND_API_KEY=' "$ENV" | cut -d= -f2-)
echo "RESEND_API_KEY set (${#v} chars, ${v:0:6}...)"
