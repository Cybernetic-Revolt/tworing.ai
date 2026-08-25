#!/usr/bin/env bash
# Runs inside LXC 129: point the demo login at the real org (bilco) as MEMBER
# instead of the synthetic Foothills demo org.
set -euo pipefail
su - postgres <<'PSQL'
psql -d bilco_platform \
  -c 'INSERT INTO "Membership" (id, "userId", "orgId", role)
      SELECT gen_random_uuid()::text, u.id, o.id, $$MEMBER$$
      FROM "User" u, "Org" o
      WHERE u.email = $$demo@tworing.app$$ AND o.slug = $$bilco$$
      ON CONFLICT ("userId", "orgId") DO NOTHING;' \
  -c 'DELETE FROM "Membership" m
      USING "User" u, "Org" o
      WHERE m."userId" = u.id AND m."orgId" = o.id
        AND u.email = $$demo@tworing.app$$ AND o.slug = $$demo$$;' \
  -c 'SELECT u.email, o.slug, m.role FROM "Membership" m
      JOIN "User" u ON u.id = m."userId"
      JOIN "Org" o ON o.id = m."orgId"
      WHERE u.email = $$demo@tworing.app$$;'
PSQL
