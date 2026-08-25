-- CreateTable
CREATE TABLE "BlockedNumber" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "e164" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedNumber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlockedNumber_orgId_idx" ON "BlockedNumber"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedNumber_orgId_e164_key" ON "BlockedNumber"("orgId", "e164");

-- AddForeignKey
ALTER TABLE "BlockedNumber" ADD CONSTRAINT "BlockedNumber_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
