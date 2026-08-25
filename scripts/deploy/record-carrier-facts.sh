#!/usr/bin/env bash
# Runs inside LXC 129: record verified VoIP.ms carrier facts on the org's
# PhoneNumber rows (discovered/confirmed 2026-06-12).
set -euo pipefail
su - postgres <<'PSQL'
psql -d bilco_platform \
  -c 'UPDATE "PhoneNumber"
      SET "sipSubaccount" = $$548365_bilco1$$,
          "failoverE164"  = $$+14036165487$$
      WHERE e164 = $$+12899991089$$;' \
  -c 'SELECT e164, label, provider, "sipSubaccount", "failoverE164" FROM "PhoneNumber" ORDER BY e164;'
PSQL
