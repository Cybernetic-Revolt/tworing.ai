-- Per-thread throttle stamps so auto-ack and owner-notify each fire at most once
-- per window (claimed atomically via conditional UPDATE).
ALTER TABLE "SmsThread" ADD COLUMN "lastAutoAckAt" TIMESTAMP(3);
ALTER TABLE "SmsThread" ADD COLUMN "lastNotifiedAt" TIMESTAMP(3);
