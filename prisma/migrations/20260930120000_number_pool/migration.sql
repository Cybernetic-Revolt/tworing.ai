-- Spare DIDs held ready for self-serve signups. Purely additive: nothing reads this table
-- until the provisioner ships, and an empty pool simply means no number is assigned.
CREATE TABLE "NumberPool" (
    "id" TEXT NOT NULL,
    "e164" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'voipms',
    "sipSubaccount" TEXT,
    "claimedByOrgId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NumberPool_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NumberPool_e164_key" ON "NumberPool"("e164");
CREATE INDEX "NumberPool_claimedByOrgId_idx" ON "NumberPool"("claimedByOrgId");
