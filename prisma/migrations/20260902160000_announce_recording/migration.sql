-- Whether the caller is told the call is recorded. Defaults to true so every existing
-- assistant keeps announcing; turning it off is an explicit per-assistant decision.
ALTER TABLE "Assistant" ADD COLUMN "announceRecording" BOOLEAN NOT NULL DEFAULT true;
