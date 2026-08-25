#!/usr/bin/env bash
# Runs inside LXC 129: create the Joes' Lawn & Snow demo org (Kelly's company),
# its ingest key, business hours, and calendar settings. Idempotent.
set -euo pipefail
KEYFILE=/root/.tworing-key-joes-lawn-snow
if [ ! -f "$KEYFILE" ]; then
  echo "blk_$(openssl rand -base64 24 | tr '+/' '-_' | tr -d '=')" > "$KEYFILE"
  chmod 600 "$KEYFILE"
fi
HASH=$(printf %s "$(cat "$KEYFILE")" | sha256sum | cut -d' ' -f1)

su - postgres <<PSQL
psql -d bilco_platform <<SQL
INSERT INTO "Org" (id, slug, name, tier, timezone, "isDemoOrg", "averageJobValue",
    "googleReviewUrl", "reviewRequests", "updatedAt")
VALUES (gen_random_uuid()::text, 'joes-lawn-snow', 'Joes'' Lawn & Snow', 'OPERATIONS',
    'America/Edmonton', true, 250, 'https://search.google.com/local/writereview?placeid=demo',
    true, now())
ON CONFLICT (slug) DO UPDATE SET "isDemoOrg" = true, tier = 'OPERATIONS';

INSERT INTO "IngestKey" (id, "orgId", "keyHash", label)
SELECT gen_random_uuid()::text, id, '$HASH', 'demo'
FROM "Org" WHERE slug = 'joes-lawn-snow'
ON CONFLICT ("keyHash") DO NOTHING;

-- Lawn/snow hours: Mon–Sat 7:00–19:00 (420–1140)
INSERT INTO "AvailabilityRule" (id, "orgId", weekday, "startMin", "endMin")
SELECT gen_random_uuid()::text, o.id, wd, 420, 1140
FROM "Org" o, generate_series(1,6) wd
WHERE o.slug = 'joes-lawn-snow' AND NOT EXISTS
  (SELECT 1 FROM "AvailabilityRule" r WHERE r."orgId" = o.id);

INSERT INTO "CalendarSettings" (id, "orgId", "slotMinutes", "maxPerDay")
SELECT gen_random_uuid()::text, id, 90, 10 FROM "Org" WHERE slug = 'joes-lawn-snow'
ON CONFLICT ("orgId") DO NOTHING;

SELECT o.slug, o.tier, o."isDemoOrg",
  (SELECT count(*) FROM "IngestKey" k WHERE k."orgId"=o.id) AS keys,
  (SELECT count(*) FROM "AvailabilityRule" r WHERE r."orgId"=o.id) AS hours
FROM "Org" o WHERE o.slug = 'joes-lawn-snow';
SQL
PSQL
