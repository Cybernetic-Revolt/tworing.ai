-- CreateEnum
CREATE TYPE "ApptStatus" AS ENUM ('CONFIRMED', 'PENDING', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ApptSource" AS ENUM ('AI', 'PORTAL', 'JOBBER');

-- CreateEnum
CREATE TYPE "BookingPolicy" AS ENUM ('FIRM', 'CONFIRM_FIRST');

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "leadId" TEXT,
    "callId" TEXT,
    "vapiCallId" TEXT,
    "title" TEXT NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "address" TEXT,
    "jobType" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "ApptStatus" NOT NULL DEFAULT 'CONFIRMED',
    "source" "ApptSource" NOT NULL DEFAULT 'PORTAL',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarSettings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "slotMinutes" INTEGER NOT NULL DEFAULT 120,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 30,
    "maxPerDay" INTEGER NOT NULL DEFAULT 6,
    "emergencyOverride" BOOLEAN NOT NULL DEFAULT true,
    "bookingPolicy" "BookingPolicy" NOT NULL DEFAULT 'FIRM',

    CONSTRAINT "CalendarSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Appointment_orgId_startsAt_idx" ON "Appointment"("orgId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_vapiCallId_idx" ON "Appointment"("vapiCallId");

-- CreateIndex
CREATE INDEX "AvailabilityRule_orgId_idx" ON "AvailabilityRule"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarSettings_orgId_key" ON "CalendarSettings"("orgId");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSettings" ADD CONSTRAINT "CalendarSettings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
