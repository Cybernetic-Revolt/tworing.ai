#!/usr/bin/env bash
# Runs inside LXC 129: create a temp org, POST a correctly-signed
# checkout.session.completed event to the live webhook, verify a Subscription
# row + org tier were set, then clean up.
set -euo pipefail

# Create the temp org (no capture here).
su - postgres <<'PSQL'
psql -q -d bilco_platform -c "INSERT INTO \"Org\" (id, slug, name, tier, timezone, \"updatedAt\") VALUES (gen_random_uuid()::text, 'ztest-stripe', 'Z Stripe Test', 'ANSWER', 'America/Edmonton', now()) ON CONFLICT (slug) DO UPDATE SET \"updatedAt\" = now();"
PSQL

# Capture just the id (quiet + tuples-only = clean value).
ORGID=$(su - postgres <<'PSQL'
psql -Atq -d bilco_platform -c "SELECT id FROM \"Org\" WHERE slug = 'ztest-stripe';"
PSQL
)
echo "temp org: [$ORGID]"

SECRET=$(grep '^STRIPE_WEBHOOK_SECRET=' /etc/bilco-platform.env | cut -d= -f2-)
ORGID="$ORGID" SECRET="$SECRET" python3 - <<'PY'
import hmac, hashlib, json, os, time, urllib.request
org = os.environ["ORGID"].strip(); secret = os.environ["SECRET"].strip()
event = {
  "type": "checkout.session.completed",
  "data": {"object": {
    "client_reference_id": org,
    "customer": "cus_ztest123",
    "subscription": "sub_ztest123",
    "metadata": {"orgId": org, "tier": "OFFICE"},
  }},
}
payload = json.dumps(event)
t = int(time.time())
sig = hmac.new(secret.encode(), f"{t}.{payload}".encode(), hashlib.sha256).hexdigest()
req = urllib.request.Request(
  "http://localhost:3000/api/stripe/webhook",
  data=payload.encode(),
  headers={"Content-Type": "application/json", "stripe-signature": f"t={t},v1={sig}"},
  method="POST",
)
with urllib.request.urlopen(req) as r:
  print("webhook HTTP", r.status, r.read().decode())
PY

sleep 1
echo "== result =="
su - postgres <<'PSQL'
psql -d bilco_platform -c "SELECT o.tier AS org_tier, s.status, s.tier AS sub_tier, s.\"stripeCustomerId\", s.\"stripeSubId\" FROM \"Org\" o LEFT JOIN \"Subscription\" s ON s.\"orgId\" = o.id WHERE o.slug = 'ztest-stripe';"
PSQL

echo "== cleanup =="
su - postgres <<'PSQL'
psql -q -d bilco_platform -c "DELETE FROM \"Org\" WHERE slug = 'ztest-stripe';"
PSQL
echo done
