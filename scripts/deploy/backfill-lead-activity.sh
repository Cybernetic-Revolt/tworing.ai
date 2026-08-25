#!/usr/bin/env bash
# Runs inside LXC 129: give every existing lead a "captured" AI activity
# (dated to the lead) so timelines aren't empty in the live demo. One-shot,
# idempotent — only inserts for leads that have no activity yet.
set -euo pipefail
su - postgres <<'PSQL'
psql -d bilco_platform <<'SQL'
INSERT INTO "LeadActivity" (id, "orgId", "leadId", actor, kind, payload, "createdAt")
SELECT gen_random_uuid()::text, l."orgId", l.id, 'AI', 'STATUS_CHANGE',
       jsonb_build_object('from', NULL, 'to', l.status, 'note', 'Captured from call'),
       l."createdAt"
FROM "Lead" l
WHERE NOT EXISTS (SELECT 1 FROM "LeadActivity" a WHERE a."leadId" = l.id);
SELECT o.slug, count(la.*) AS activities
FROM "LeadActivity" la JOIN "Org" o ON o.id = la."orgId"
GROUP BY o.slug ORDER BY o.slug;
SQL
PSQL
