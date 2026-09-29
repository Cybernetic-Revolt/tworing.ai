-- When a self-serve trial ends. Nullable, and null is the safe state: an org without this
-- marker is treated as hand-provisioned and its line is never stopped on entitlement
-- grounds. Every existing org therefore keeps answering exactly as it does today.
ALTER TABLE "Org" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
