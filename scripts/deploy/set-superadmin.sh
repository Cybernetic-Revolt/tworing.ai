#!/usr/bin/env bash
# Runs inside LXC 129: grant the ENGINEER flag to the platform owner account.
# (Column renamed from isSuperadmin in the engineer_rename migration.)
set -euo pipefail
su - postgres <<'PSQL'
psql -d bilco_platform \
  -c 'UPDATE "User" SET "isEngineer" = true WHERE email = $$message@bilco.ca$$;' \
  -c 'SELECT email, "isEngineer" FROM "User" ORDER BY email;'
PSQL
