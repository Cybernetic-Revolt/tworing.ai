-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "ConsentState" AS ENUM ('UNKNOWN', 'IMPLIED', 'EXPRESS', 'OPTED_OUT');

-- AlterEnum
ALTER TYPE "MessageStatus" ADD VALUE 'RECEIVED';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "direction" "MessageDirection" NOT NULL DEFAULT 'OUTBOUND',
ADD COLUMN     "threadId" TEXT;

-- CreateTable
CREATE TABLE "SmsThread" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "consentState" "ConsentState" NOT NULL DEFAULT 'UNKNOWN',
    "consentAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsThread_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsThread_orgId_lastMessageAt_idx" ON "SmsThread"("orgId", "lastMessageAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SmsThread_orgId_customerPhone_key" ON "SmsThread"("orgId", "customerPhone");

-- CreateIndex
CREATE INDEX "Message_threadId_idx" ON "Message"("threadId");

-- AddForeignKey
ALTER TABLE "SmsThread" ADD CONSTRAINT "SmsThread_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
