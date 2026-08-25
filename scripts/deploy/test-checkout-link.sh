#!/usr/bin/env bash
# Runs inside LXC 129: create a real Checkout Session (OFFICE price, 14-day
# trial) via the Stripe API and confirm the hosted URL loads.
set -euo pipefail
SK=$(grep '^STRIPE_SECRET_KEY=' /etc/bilco-platform.env | cut -d= -f2-)
PRICE=$(grep '^STRIPE_PRICE_OFFICE=' /etc/bilco-platform.env | cut -d= -f2-)

URL=$(curl -s https://api.stripe.com/v1/checkout/sessions \
  -u "$SK:" \
  -d mode=subscription \
  -d "line_items[0][price]=$PRICE" \
  -d "line_items[0][quantity]=1" \
  -d "subscription_data[trial_period_days]=14" \
  -d "success_url=https://tworing.ai/admin?billing=started" \
  -d "cancel_url=https://tworing.ai/admin?billing=cancelled" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["url"])')
echo "checkout url: $URL"
curl -s -o /dev/null -w "hosted page loads: HTTP %{http_code}\n" "$URL"
