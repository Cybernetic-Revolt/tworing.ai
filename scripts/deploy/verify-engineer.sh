#!/usr/bin/env bash
# Runs inside LXC 129: confirm the engineer flag survived the rename and the
# engineering page guards correctly.
set -euo pipefail
su - postgres -c 'psql -d bilco_platform -c "SELECT email, \"isEngineer\" FROM \"User\" ORDER BY email;"'
curl -s -o /dev/null -w "engineering page (unauthenticated): %{http_code} -> %{redirect_url}\n" http://localhost:3000/app/engineering
