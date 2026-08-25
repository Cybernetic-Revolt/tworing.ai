#!/usr/bin/env bash
# Runs inside LXC 129: flip real email delivery on now that mail.tworing.ai
# is verified in Resend.
set -euo pipefail
ENV=/etc/bilco-platform.env
if grep -q '^MAIL_DOMAIN_VERIFIED=' "$ENV"; then
  sed -i 's/^MAIL_DOMAIN_VERIFIED=.*/MAIL_DOMAIN_VERIFIED=1/' "$ENV"
else
  echo 'MAIL_DOMAIN_VERIFIED=1' >> "$ENV"
fi
grep -q '^MAIL_FROM_DOMAIN=' "$ENV" || echo 'MAIL_FROM_DOMAIN=mail.tworing.ai' >> "$ENV"
systemctl restart bilco-platform
sleep 2
echo "service: $(systemctl is-active bilco-platform)"
grep -E '^MAIL_' "$ENV"
