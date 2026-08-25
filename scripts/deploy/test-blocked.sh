#!/usr/bin/env bash
# Runs inside LXC 129: insert a blocked number for james-plumbing matching a
# real caller, print the call id to verify the badge, then leave it for the
# HTTP check to read. (Caller passed back out for the PS verifier.)
set -euo pipefail
su - postgres <<'PSQL'
psql -At -d bilco_platform <<'SQL'
WITH j AS (SELECT id FROM "Org" WHERE slug = 'james-plumbing'),
     c AS (
       SELECT id, "callerNumber" FROM "Call"
       WHERE "orgId" = (SELECT id FROM j) AND "callerNumber" IS NOT NULL
       ORDER BY "startedAt" DESC LIMIT 1
     )
INSERT INTO "BlockedNumber" (id, "orgId", e164, reason)
SELECT gen_random_uuid()::text, (SELECT id FROM j), c."callerNumber", 'e2e-test'
FROM c
ON CONFLICT ("orgId", e164) DO NOTHING;
SELECT c.id || '|' || c."callerNumber"
FROM "Call" c JOIN "Org" o ON o.id = c."orgId"
WHERE o.slug = 'james-plumbing' AND c."callerNumber" IS NOT NULL
ORDER BY c."startedAt" DESC LIMIT 1;
SQL
PSQL
