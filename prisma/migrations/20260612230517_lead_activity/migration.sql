-- CreateEnum
CREATE TYPE "ActorKind" AS ENUM ('AI', 'USER', 'SYSTEM', 'JOBBER');

-- CreateEnum
CREATE TYPE "ActivityKind" AS ENUM ('STATUS_CHANGE', 'NOTE', 'EMAIL', 'SMS', 'APPOINTMENT', 'SYNC');

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "actor" "ActorKind" NOT NULL,
    "kind" "ActivityKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
