#!/usr/bin/env bash
# Runs inside LXC 129: set the Stripe secret key and ensure billing env
# placeholders exist. Key passed as arg — never hard-coded.
#   bash set-stripe-env.sh "<sk_test_...>"
set -euo pipefail
SK="${1:?stripe secret key required}"
ENV=/etc/bilco-platform.env

set_kv() { # key value
  if grep -q "^$1=" "$ENV"; then
    sed -i "s|^$1=.*|$1=$2|" "$ENV"
  else
    echo "$1=$2" >> "$ENV"
  fi
}
ensure() { grep -q "^$1=" "$ENV" || echo "$1=" >> "$ENV"; }

set_kv STRIPE_SECRET_KEY "$SK"
ensure STRIPE_WEBHOOK_SECRET
ensure STRIPE_PRICE_ANSWER
ensure STRIPE_PRICE_OFFICE
ensure STRIPE_PRICE_OPERATIONS
ensure STRIPE_PRICE_OVERAGE
ensure STRIPE_PRICE_EXTRA_NUMBER

sk=$(grep '^STRIPE_SECRET_KEY=' "$ENV" | cut -d= -f2-)
echo "STRIPE_SECRET_KEY set (${#sk} chars, ${sk:0:8}...)"
