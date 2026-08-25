#!/usr/bin/env bash
# Runs inside LXC 129: create the two public demo companies, each its own
# tenant, and move numbers + history from org bilco by owning assistant.
# Idempotent. Raw ingest keys land in /root/.tworing-key-<slug>.
set -euo pipefail

JAMES_AID="534db2e3-da19-4bb5-b5ea-4cb4c09896c8"
SARAH_AID="cbeca395-1970-45f6-9b32-c2471eda4b43"

newkey() { # slug -> prints hash; writes raw key file once
  local slug=$1 file=/root/.tworing-key-$1
  if [ ! -f "$file" ]; then
    echo "blk_$(openssl rand -base64 24 | tr '+/' '-_' | tr -d '=')" > "$file"
    chmod 600 "$file"
  fi
  printf %s "$(cat "$file")" | sha256sum | cut -d' ' -f1
}
JAMES_HASH=$(newkey james-plumbing)
SARAH_HASH=$(newkey billys-realty)

cat > /tmp/split-demo.sql <<SQL
-- 1. Demo orgs
INSERT INTO "Org" (id, slug, name, tier, timezone, "isDemoOrg", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'james-plumbing', 'James Plumbing Inc', 'OPERATIONS', 'America/Edmonton', true, now()),
  (gen_random_uuid()::text, 'billys-realty', 'Billy''s Realty Company', 'OPERATIONS', 'America/Edmonton', true, now())
ON CONFLICT (slug) DO UPDATE SET "isDemoOrg" = true;

-- 2. Ingest keys (hashes only)
INSERT INTO "IngestKey" (id, "orgId", "keyHash", label)
SELECT gen_random_uuid()::text, o.id, '$JAMES_HASH', 'demo'
FROM "Org" o WHERE o.slug = 'james-plumbing'
ON CONFLICT ("keyHash") DO NOTHING;
INSERT INTO "IngestKey" (id, "orgId", "keyHash", label)
SELECT gen_random_uuid()::text, o.id, '$SARAH_HASH', 'demo'
FROM "Org" o WHERE o.slug = 'billys-realty'
ON CONFLICT ("keyHash") DO NOTHING;

-- 3. Numbers move to their demo company
UPDATE "PhoneNumber" SET "orgId" = (SELECT id FROM "Org" WHERE slug = 'james-plumbing')
WHERE e164 IN ('+16202826163', '+18186079476');
UPDATE "PhoneNumber" SET "orgId" = (SELECT id FROM "Org" WHERE slug = 'billys-realty')
WHERE e164 = '+12899991089';

-- 4. History split by owning assistant (raw end-of-call report carries it)
UPDATE "Call" SET "orgId" = (SELECT id FROM "Org" WHERE slug = 'james-plumbing')
WHERE raw->'call'->>'assistantId' = '$JAMES_AID';
UPDATE "Call" SET "orgId" = (SELECT id FROM "Org" WHERE slug = 'billys-realty')
WHERE raw->'call'->>'assistantId' = '$SARAH_AID';
UPDATE "Lead" l SET "orgId" = c."orgId" FROM "Call" c
WHERE l."callId" = c.id AND l."orgId" <> c."orgId";
UPDATE "Appointment" a SET "orgId" = c."orgId" FROM "Call" c
WHERE a."callId" = c.id AND a."orgId" <> c."orgId";

-- 5. Business hours + calendar settings for both demo companies
INSERT INTO "AvailabilityRule" (id, "orgId", weekday, "startMin", "endMin")
SELECT gen_random_uuid()::text, o.id, wd, 480, 1020
FROM "Org" o, generate_series(1, 5) wd
WHERE o."isDemoOrg" AND NOT EXISTS
  (SELECT 1 FROM "AvailabilityRule" r WHERE r."orgId" = o.id);
INSERT INTO "CalendarSettings" (id, "orgId")
SELECT gen_random_uuid()::text, o.id FROM "Org" o
WHERE o."isDemoOrg"
ON CONFLICT ("orgId") DO NOTHING;

-- 6. Demo user leaves the real org
DELETE FROM "Membership" m USING "User" u, "Org" o
WHERE m."userId" = u.id AND m."orgId" = o.id
  AND u.email = 'demo@tworing.app' AND o.slug = 'bilco';

-- 7. Report
SELECT o.slug, o."isDemoOrg",
  (SELECT count(*) FROM "Call" c WHERE c."orgId" = o.id) AS calls,
  (SELECT count(*) FROM "Lead" l WHERE l."orgId" = o.id) AS leads,
  (SELECT count(*) FROM "PhoneNumber" p WHERE p."orgId" = o.id) AS numbers,
  (SELECT count(*) FROM "AvailabilityRule" r WHERE r."orgId" = o.id) AS hours
FROM "Org" o ORDER BY o.slug;
SQL

echo "== assistantId distribution before split =="
su - postgres <<'PSQL'
psql -d bilco_platform -c "SELECT raw->'call'->>'assistantId' AS assistant, count(*) FROM \"Call\" GROUP BY 1 ORDER BY 2 DESC;"
PSQL

su - postgres -c "psql -d bilco_platform -f /tmp/split-demo.sql"
