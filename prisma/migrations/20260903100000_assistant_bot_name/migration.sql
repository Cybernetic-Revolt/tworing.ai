-- The name the assistant says out loud, which the customer owns and staff do not.
-- Nullable rather than defaulted: an assistant whose prompt spells its name out in full has
-- not chosen a bot name, and inventing one would make #NAME# render something nobody picked.
-- Rendering falls back to the admin label when this is null.
ALTER TABLE "Assistant" ADD COLUMN "botName" TEXT;
