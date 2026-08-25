-- Move the call<->lead link onto Call (many calls -> one lead) and dedupe
-- leads by (orgId, phone). Lead becomes one-per-caller within an org.

-- 1. New FK column on Call, backfilled from the old Lead.callId link.
ALTER TABLE "Call" ADD COLUMN "leadId" TEXT;
UPDATE "Call" c SET "leadId" = l.id FROM "Lead" l WHERE l."callId" = c.id;

-- 2. Drop the old one-to-one link from Lead.
ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_callId_fkey";
ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_callId_key";
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "callId";

-- 3. Wire up the new relation + indexes.
CREATE INDEX "Call_leadId_idx" ON "Call"("leadId");
ALTER TABLE "Call" ADD CONSTRAINT "Call_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. One lead per caller within an org.
CREATE UNIQUE INDEX "Lead_orgId_phone_key" ON "Lead"("orgId", "phone");
