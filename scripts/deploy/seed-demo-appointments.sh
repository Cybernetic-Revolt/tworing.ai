#!/usr/bin/env bash
# Runs inside LXC 129: give each demo org a few AI-booked appointments dated
# this month, linked to existing leads, so the Found Money Report shows a
# real recovered-revenue figure. Idempotent (keyed on synthetic vapiCallId).
set -euo pipefail
su - postgres <<'PSQL'
psql -d bilco_platform <<'SQL'
-- James Plumbing: 3 AI-booked jobs (× $450)
INSERT INTO "Appointment" (id, "orgId", "leadId", title, "customerName", "customerPhone",
    "jobType", "startsAt", "endsAt", status, source, "vapiCallId", "updatedAt")
SELECT gen_random_uuid()::text, l."orgId", l.id,
    COALESCE(l."jobType", 'Service call') || ' — ' || COALESCE(l.name, 'Customer'),
    l.name, l.phone, l."jobType",
    date_trunc('month', now()) + (row_number() OVER () || ' days')::interval + interval '9 hours',
    date_trunc('month', now()) + (row_number() OVER () || ' days')::interval + interval '11 hours',
    (ARRAY['COMPLETED','CONFIRMED','COMPLETED'])[row_number() OVER ()]::"ApptStatus",
    'AI', 'demo-appt-james-' || row_number() OVER (), now()
FROM "Lead" l JOIN "Org" o ON o.id = l."orgId"
WHERE o.slug = 'james-plumbing'
  AND NOT EXISTS (SELECT 1 FROM "Appointment" a WHERE a."vapiCallId" LIKE 'demo-appt-james-%')
ORDER BY l."createdAt" LIMIT 3;

-- Billy's Realty: 2 AI-booked appointments (× $12,000 commission)
INSERT INTO "Appointment" (id, "orgId", "leadId", title, "customerName", "customerPhone",
    "jobType", "startsAt", "endsAt", status, source, "vapiCallId", "updatedAt")
SELECT gen_random_uuid()::text, l."orgId", l.id,
    'Showing — ' || COALESCE(l.name, 'Client'),
    l.name, l.phone, 'Showing',
    date_trunc('month', now()) + (row_number() OVER () || ' days')::interval + interval '14 hours',
    date_trunc('month', now()) + (row_number() OVER () || ' days')::interval + interval '15 hours',
    (ARRAY['COMPLETED','CONFIRMED'])[row_number() OVER ()]::"ApptStatus",
    'AI', 'demo-appt-realty-' || row_number() OVER (), now()
FROM "Lead" l JOIN "Org" o ON o.id = l."orgId"
WHERE o.slug = 'billys-realty'
  AND NOT EXISTS (SELECT 1 FROM "Appointment" a WHERE a."vapiCallId" LIKE 'demo-appt-realty-%')
ORDER BY l."createdAt" LIMIT 2;

SELECT o.slug, count(a.*) AS ai_appts, o."averageJobValue",
       count(a.*) * o."averageJobValue" AS recovered
FROM "Appointment" a JOIN "Org" o ON o.id = a."orgId"
WHERE a.source = 'AI' AND o."isDemoOrg"
GROUP BY o.slug, o."averageJobValue" ORDER BY o.slug;
SQL
PSQL
