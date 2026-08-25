-- Stateless-session revocation: bumping User.sessionEpoch invalidates every
-- token minted before it (password change / privilege change / "log out
-- everywhere"). Default 0 keeps existing tokens (which carry no epoch claim,
-- read as 0) valid, so this migration does not force-log-out current users.
ALTER TABLE "User" ADD COLUMN "sessionEpoch" INTEGER NOT NULL DEFAULT 0;
