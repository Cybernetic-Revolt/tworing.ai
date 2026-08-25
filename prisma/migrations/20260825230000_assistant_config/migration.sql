-- Assistant configuration moves into the product.
--
-- Every column below previously lived either in Vapi's dashboard or as literal text inside a
-- prompt. That is the problem this migration exists to fix: the product's most important data
-- sat in a third party that is being switched off, and could not be read, versioned or edited
-- from the product itself.

CREATE TYPE "AssistantStatus" AS ENUM ('PRODUCTION', 'TEMPLATE', 'RETIRED');
CREATE TYPE "ContactRelation" AS ENUM ('PRINCIPAL', 'FAMILY', 'WORK', 'KNOWN', 'BLOCKED');

CREATE TABLE "Assistant" (
    "id"                    TEXT NOT NULL,
    "orgId"                 TEXT NOT NULL,
    "key"                   TEXT NOT NULL,
    "name"                  TEXT NOT NULL,
    "status"                "AssistantStatus" NOT NULL DEFAULT 'TEMPLATE',
    "greeting"              TEXT NOT NULL,
    "systemPrompt"          TEXT NOT NULL,
    "recordingNotice"       TEXT,
    "recordsCall"           BOOLEAN NOT NULL DEFAULT true,
    "voiceProvider"         TEXT NOT NULL DEFAULT 'elevenlabs',
    "voiceId"               TEXT,
    "endCallPhrases"        TEXT[],
    "endCallMessage"        TEXT,
    "transferTo"            TEXT,
    "transferMessage"       TEXT,
    -- Nullable on purpose: NULL means no limit was ever set, which is not the same as the
    -- default. Defaulting these would record our assumptions rather than what actually ran.
    "silenceTimeoutSeconds" INTEGER,
    "maxDurationSeconds"    INTEGER,
    "tools"                 TEXT[],
    "vapiAssistantId"       TEXT,
    "vapiModel"             TEXT,
    "vapiVoice"             TEXT,
    "notes"                 TEXT,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assistant_pkey" PRIMARY KEY ("id")
);

-- Recognising a caller has to be a lookup against data. Ada's prompt carried a "Known People"
-- block full of literal [add number] placeholders, so identification could never fire — and
-- the principal's own number was one of them, meaning the owner was screened by his own
-- assistant.
CREATE TABLE "AssistantContact" (
    "id"          TEXT NOT NULL,
    "assistantId" TEXT NOT NULL,
    "e164"        TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "relation"    "ContactRelation" NOT NULL DEFAULT 'KNOWN',
    "note"        TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantContact_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PhoneNumber" ADD COLUMN "assistantId" TEXT;

CREATE UNIQUE INDEX "Assistant_key_key" ON "Assistant"("key");
CREATE INDEX "Assistant_orgId_idx" ON "Assistant"("orgId");
CREATE INDEX "Assistant_status_idx" ON "Assistant"("status");
CREATE INDEX "AssistantContact_assistantId_idx" ON "AssistantContact"("assistantId");
-- One row per number per assistant: duplicates would make which name gets greeted depend on
-- row order.
CREATE UNIQUE INDEX "AssistantContact_assistantId_e164_key" ON "AssistantContact"("assistantId", "e164");
CREATE INDEX "PhoneNumber_assistantId_idx" ON "PhoneNumber"("assistantId");

ALTER TABLE "Assistant" ADD CONSTRAINT "Assistant_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantContact" ADD CONSTRAINT "AssistantContact_assistantId_fkey"
    FOREIGN KEY ("assistantId") REFERENCES "Assistant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- SET NULL rather than CASCADE: deleting an assistant must never delete a phone number. The
-- number is a leased asset; the assistant is a configuration.
ALTER TABLE "PhoneNumber" ADD CONSTRAINT "PhoneNumber_assistantId_fkey"
    FOREIGN KEY ("assistantId") REFERENCES "Assistant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
