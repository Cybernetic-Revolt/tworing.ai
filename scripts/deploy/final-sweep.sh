#!/usr/bin/env bash
# Runs inside LXC 129: end-of-loop sanity — orgs, demo wiring, and the
# engineer-session portal (connections + home link).
set -euo pipefail
echo "== orgs & demo wiring =="
su - postgres <<'PSQL'
psql -d bilco_platform <<'SQL'
SELECT o.slug, o.tier, o."isDemoOrg",
  (SELECT count(*) FROM "IngestKey" k WHERE k."orgId"=o.id) AS keys,
  (SELECT count(*) FROM "PhoneNumber" p WHERE p."orgId"=o.id) AS nums,
  (SELECT count(*) FROM "AvailabilityRule" r WHERE r."orgId"=o.id) AS hours
FROM "Org" o ORDER BY o.slug;
SQL
PSQL

echo "== integration env present? =="
for k in RESEND_API_KEY STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET GOOGLE_CLIENT_ID JOBBER_CLIENT_ID SMS_INBOUND_SECRET MAIL_DOMAIN_VERIFIED TOKEN_ENCRYPTION_KEY; do
  v=$(grep "^${k}=" /etc/bilco-platform.env | cut -d= -f2-)
  echo "  $k = ${v:+SET}${v:-EMPTY}"
done

echo "== engineer-session portal =="
ORG_ID=$(su - postgres <<'P'
psql -Atq -d bilco_platform -c "SELECT id FROM \"Org\" WHERE slug='bilco';"
P
)
USER_ID=$(su - postgres <<'P'
psql -Atq -d bilco_platform -c "SELECT id FROM \"User\" WHERE email='message@bilco.ca';"
P
)
TOKEN=$(cd /opt/bilco-platform && SESSION_SECRET=$(grep ^SESSION_SECRET= /etc/bilco-platform.env | cut -d= -f2) \
  ORG_ID=$ORG_ID USER_ID=$USER_ID node --input-type=module -e '
import { SignJWT } from "jose";
const t = await new SignJWT({ userId: process.env.USER_ID, orgId: process.env.ORG_ID, role: "OWNER", email: "message@bilco.ca", engineer: true })
  .setProtectedHeader({ alg:"HS256" }).setIssuedAt().setExpirationTime("10m")
  .sign(new TextEncoder().encode(process.env.SESSION_SECRET)); console.log(t);')
CONN=$(curl -s -H "Cookie: bilco_session=$TOKEN" http://localhost:3000/app/connections)
echo "  Google row: $(echo "$CONN" | grep -qF 'Google Calendar' && echo yes || echo no)"
echo "  Jobber row: $(echo "$CONN" | grep -qF 'Jobber' && echo yes || echo no)"
echo "  Webhook row: $(echo "$CONN" | grep -qF 'Outbound webhook' && echo yes || echo no)"
APP=$(curl -s -H "Cookie: bilco_session=$TOKEN" http://localhost:3000/app)
echo "  portal home link: $(echo "$APP" | grep -qF 'Back to tworing.ai' && echo yes || echo no)"
