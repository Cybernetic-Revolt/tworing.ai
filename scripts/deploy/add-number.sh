#!/usr/bin/env bash
# Runs inside LXC 129: record the org's real-world business line.
set -euo pipefail
su - postgres <<'PSQL'
psql -d bilco_platform \
  -c 'INSERT INTO "PhoneNumber" (id, "orgId", e164, label, provider)
      SELECT gen_random_uuid()::text, id, $$+15875006941$$, $$Business line (forwards to AI)$$, $$external$$
      FROM "Org" WHERE slug = $$bilco$$
      ON CONFLICT (e164) DO NOTHING;' \
  -c 'SELECT e164, label, provider FROM "PhoneNumber";'
PSQL
