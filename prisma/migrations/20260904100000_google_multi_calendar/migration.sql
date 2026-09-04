-- Multi-account / multi-calendar Google sync.
--
-- Before: GoogleConnection had orgId UNIQUE (one account per org) and a single calendarId,
-- and Appointment.googleEventId tracked the one event on that one calendar. After: an org
-- may connect several accounts, each syncing several calendars, and a booking fans out to one
-- event per calendar.
--
-- The migration is additive and backfills the existing single connection losslessly BEFORE it
-- drops the old column, so an org that is connected today keeps syncing with no manual step.

-- 1. The set of calendars an account syncs.
CREATE TABLE "GoogleCalendar" (
  "id"           TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "googleId"     TEXT NOT NULL,
  "summary"      TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoogleCalendar_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GoogleCalendar_connectionId_googleId_key" ON "GoogleCalendar"("connectionId","googleId");
CREATE INDEX "GoogleCalendar_connectionId_idx" ON "GoogleCalendar"("connectionId");
ALTER TABLE "GoogleCalendar"
  ADD CONSTRAINT "GoogleCalendar_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "GoogleConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. The event a booking created on ONE calendar (one row per synced calendar per appointment).
CREATE TABLE "AppointmentGoogleEvent" (
  "id"            TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "calendarId"    TEXT NOT NULL,
  "eventId"       TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppointmentGoogleEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AppointmentGoogleEvent_appointmentId_calendarId_key" ON "AppointmentGoogleEvent"("appointmentId","calendarId");
CREATE INDEX "AppointmentGoogleEvent_appointmentId_idx" ON "AppointmentGoogleEvent"("appointmentId");
CREATE INDEX "AppointmentGoogleEvent_calendarId_idx" ON "AppointmentGoogleEvent"("calendarId");
ALTER TABLE "AppointmentGoogleEvent"
  ADD CONSTRAINT "AppointmentGoogleEvent_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentGoogleEvent"
  ADD CONSTRAINT "AppointmentGoogleEvent_calendarId_fkey"
  FOREIGN KEY ("calendarId") REFERENCES "GoogleCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Backfill the existing chosen calendar into GoogleCalendar (deterministic id from the
--    connection id, so re-running is a no-op against the unique index).
INSERT INTO "GoogleCalendar" ("id","connectionId","googleId","summary","createdAt")
SELECT 'gcal_' || "id", "id", "calendarId", NULL, CURRENT_TIMESTAMP
FROM "GoogleConnection"
WHERE "calendarId" IS NOT NULL;

-- 4. Backfill each appointment's existing event onto that calendar, so edits/cancels still
--    reach it through the new table.
INSERT INTO "AppointmentGoogleEvent" ("id","appointmentId","calendarId","eventId","createdAt","updatedAt")
SELECT 'gce_' || a."id", a."id", gc."id", a."googleEventId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Appointment" a
JOIN "GoogleConnection" conn ON conn."orgId" = a."orgId" AND conn."calendarId" IS NOT NULL
JOIN "GoogleCalendar"   gc   ON gc."connectionId" = conn."id" AND gc."googleId" = conn."calendarId"
WHERE a."googleEventId" IS NOT NULL;

-- 5. Relax connection uniqueness: one row per (org, account) instead of one per org.
DROP INDEX "GoogleConnection_orgId_key";
CREATE UNIQUE INDEX "GoogleConnection_orgId_email_key" ON "GoogleConnection"("orgId","email");
CREATE INDEX "GoogleConnection_orgId_idx" ON "GoogleConnection"("orgId");

-- 6. Drop the now-migrated single-calendar column.
ALTER TABLE "GoogleConnection" DROP COLUMN "calendarId";
