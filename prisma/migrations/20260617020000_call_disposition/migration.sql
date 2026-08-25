-- Call outcome ("disposition") + per-call action audit trail.
CREATE TYPE "CallDisposition" AS ENUM ('BOOKED','RESCHEDULED','CANCELLED','MESSAGE','INQUIRY','MISSED');

ALTER TABLE "Call" ADD COLUMN "disposition" "CallDisposition";
CREATE INDEX "Call_orgId_disposition_idx" ON "Call"("orgId","disposition");

CREATE TABLE "CallAction" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "vapiCallId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CallAction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CallAction_vapiCallId_idx" ON "CallAction"("vapiCallId");
CREATE INDEX "CallAction_orgId_idx" ON "CallAction"("orgId");
