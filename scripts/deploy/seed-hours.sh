#!/usr/bin/env bash
# Runs inside LXC 129: default business hours for org bilco (Mon-Fri 8-5)
# plus calendar settings. Scaffolding until the portal settings page is used.
set -euo pipefail
su - postgres <<'PSQL'
psql -d bilco_platform <<'SQL'
DO $do$
DECLARE org_id text;
BEGIN
  SELECT id INTO org_id FROM "Org" WHERE slug = 'bilco';
  IF NOT EXISTS (SELECT 1 FROM "AvailabilityRule" WHERE "orgId" = org_id) THEN
    INSERT INTO "AvailabilityRule" (id, "orgId", weekday, "startMin", "endMin")
    SELECT gen_random_uuid()::text, org_id, wd, 480, 1020
    FROM generate_series(1, 5) AS wd;
  END IF;
  INSERT INTO "CalendarSettings" (id, "orgId")
  VALUES (gen_random_uuid()::text, org_id)
  ON CONFLICT ("orgId") DO NOTHING;
END
$do$;
SELECT weekday, "startMin", "endMin" FROM "AvailabilityRule" ORDER BY weekday;
SQL
PSQL
