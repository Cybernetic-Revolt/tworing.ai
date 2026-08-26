-- The voice engine is one trusted service that answers for every tenant, not a tenant
-- itself. Before this, it authenticated with a single org's ingest key, and the tool
-- endpoint derived the tenant from that key — so every client's bookings would have been
-- written into whichever org owned the key. Scope separates "who is calling the API" from
-- "whose data is this".
CREATE TYPE "IngestKeyScope" AS ENUM ('TENANT', 'ENGINE');

-- TENANT by default: an existing key must not widen its reach by being migrated.
ALTER TABLE "IngestKey"
  ADD COLUMN "scope" "IngestKeyScope" NOT NULL DEFAULT 'TENANT';
