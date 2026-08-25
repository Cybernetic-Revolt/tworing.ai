-- CallAction was created without an org FK; add it (cascade) so its rows are
-- cleaned up with their org and can't orphan. Clear any pre-existing orphans
-- first so the constraint can be created.
DELETE FROM "CallAction" WHERE "orgId" NOT IN (SELECT id FROM "Org");

ALTER TABLE "CallAction"
  ADD CONSTRAINT "CallAction_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
