#!/usr/bin/env bash
# Runs inside LXC 129: set realistic average job values on the demo orgs so
# the Found Money Report shows real dollar figures in the public demo.
set -euo pipefail
su - postgres <<'PSQL'
psql -d bilco_platform \
  -c "UPDATE \"Org\" SET \"averageJobValue\" = 450 WHERE slug = 'james-plumbing';" \
  -c "UPDATE \"Org\" SET \"averageJobValue\" = 12000 WHERE slug = 'billys-realty';" \
  -c "SELECT slug, \"averageJobValue\" FROM \"Org\" WHERE \"isDemoOrg\";"
PSQL
