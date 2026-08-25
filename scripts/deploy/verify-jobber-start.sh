#!/usr/bin/env bash
# Runs inside LXC 129: mint an OWNER session and confirm the Jobber OAuth
# start endpoint redirects to Jobber's authorize URL.
set -euo pipefail
ORG_ID=$(su - postgres <<'PSQL'
psql -Atq -d bilco_platform -c "SELECT id FROM \"Org\" WHERE slug = 'bilco';"
PSQL
)
USER_ID=$(su - postgres <<'PSQL'
psql -Atq -d bilco_platform -c "SELECT id FROM \"User\" WHERE email = 'message@bilco.ca';"
PSQL
)
TOKEN=$(cd /opt/bilco-platform && SESSION_SECRET=$(grep ^SESSION_SECRET= /etc/bilco-platform.env | cut -d= -f2) \
  ORG_ID=$ORG_ID USER_ID=$USER_ID node --input-type=module -e '
import { SignJWT } from "jose";
const t = await new SignJWT({ userId: process.env.USER_ID, orgId: process.env.ORG_ID, role: "OWNER", email: "message@bilco.ca", engineer: true })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m")
  .sign(new TextEncoder().encode(process.env.SESSION_SECRET));
console.log(t);')
LOC=$(curl -s -o /dev/null -w '%{redirect_url}' -H "Cookie: bilco_session=$TOKEN" http://localhost:3000/api/jobber/oauth/start)
echo "redirect: $(echo "$LOC" | sed -E 's#(https?://[^?]+).*#\1#')"
echo "has client_id: $(echo "$LOC" | grep -qF '20010937-' && echo yes || echo no)"
echo "callback ok: $(echo "$LOC" | grep -qF 'tworing.ai%2Fapi%2Fjobber%2Foauth%2Fcallback' && echo yes || echo no)"
