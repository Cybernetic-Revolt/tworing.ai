-- Jobber Client -> Request upgrade: remember the Jobber client created for a
-- lead, and the request created for a booking (idempotency).
ALTER TABLE "Lead" ADD COLUMN "jobberClientId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "jobberRequestId" TEXT;
