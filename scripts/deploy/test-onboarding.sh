#!/usr/bin/env bash
# Runs inside LXC 129: mint an engineer session and fetch an org detail page
# to confirm the onboarding checklist renders.
set -euo pipefail
ORG_ID=$(su - postgres <<'PSQL'
psql -At -d bilco_platform -c "SELECT id FROM \"Org\" WHERE slug = 'james-plumbing';"
PSQL
)
USER_ID=$(su - postgres <<'PSQL'
psql -At -d bilco_platform -c "SELECT id FROM \"User\" WHERE email = 'message@bilco.ca';"
PSQL
)
TOKEN=$(cd /opt/bilco-platform && SESSION_SECRET=$(grep ^SESSION_SECRET= /etc/bilco-platform.env | cut -d= -f2) \
  ORG_ID=$ORG_ID USER_ID=$USER_ID node --input-type=module -e '
import { SignJWT } from "jose";
const t = await new SignJWT({
  userId: process.env.USER_ID, orgId: process.env.ORG_ID,
  role: "OWNER", email: "message@bilco.ca", engineer: true,
}).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m")
  .sign(new TextEncoder().encode(process.env.SESSION_SECRET));
console.log(t);')

curl -s "http://localhost:3000/admin/orgs/$ORG_ID" -H "Cookie: bilco_session=$TOKEN" -o /tmp/onb.html -w "org detail: %{http_code}\n"
grep -q "Onboarding" /tmp/onb.html && echo "PASS: onboarding section" || echo "FAIL: no onboarding section"
grep -oE "[0-9]/8 complete" /tmp/onb.html | head -1
grep -q "Business hours set" /tmp/onb.html && echo "PASS: checklist items render" || echo "FAIL: checklist items missing"
grep -q "Send a Stripe checkout link" /tmp/onb.html && echo "PASS: billing step shown as pending" || echo "FAIL: billing step missing"
