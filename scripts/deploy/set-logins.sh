#!/usr/bin/env bash
# Runs inside LXC 129: set passwords for the super (engineer) login and the
# demo login. Passwords passed as args. Engineer flag on message@bilco.ca is
# preserved (create-user only touches password + membership).
#   bash set-logins.sh "<super_pw>" "<demo_pw>"
set -euo pipefail
SUPER_PW="${1:?super pw required}"
DEMO_PW="${2:?demo pw required}"
cd /opt/bilco-platform
sudo -u bilco npm run --silent user -- --email message@bilco.ca --password "$SUPER_PW" --org bilco --role OWNER
sudo -u bilco npm run --silent user -- --email demo@tworing.app --password "$DEMO_PW" --org james-plumbing --role MEMBER
echo "--- accounts ---"
su - postgres <<'PSQL'
psql -Atq -d bilco_platform -c "SELECT email, \"isEngineer\", (\"passwordHash\" IS NOT NULL) AS has_pw FROM \"User\" WHERE email IN ('message@bilco.ca','demo@tworing.app') ORDER BY email;"
PSQL
