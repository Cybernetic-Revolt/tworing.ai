-- Somewhere for an assistant's capture tools to write.
--
-- Ada's prompt has promised capture_note, add_task and set_reminder since it was written,
-- with nothing behind them. An assistant that discusses capturing a note and then does not
-- is worse than one that says it cannot — the caller believes it was recorded.

CREATE TYPE "TaskKind" AS ENUM ('TASK', 'REMINDER');
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'DONE', 'CANCELLED');

CREATE TABLE "Task" (
    "id"           TEXT NOT NULL,
    "orgId"        TEXT NOT NULL,
    "kind"         "TaskKind" NOT NULL DEFAULT 'TASK',
    "title"        TEXT NOT NULL,
    "project"      TEXT,
    -- Null for a task with no stated deadline. A REMINDER with a null dueAt is rejected by
    -- the handler rather than stored, since a reminder that never fires is a silent failure.
    "dueAt"        TIMESTAMP(3),
    "status"       "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "sourceCallId" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Note" (
    "id"           TEXT NOT NULL,
    "orgId"        TEXT NOT NULL,
    "text"         TEXT NOT NULL,
    "project"      TEXT,
    "sourceCallId" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Task_orgId_status_idx" ON "Task"("orgId", "status");
CREATE INDEX "Task_orgId_dueAt_idx"  ON "Task"("orgId", "dueAt");
CREATE INDEX "Note_orgId_createdAt_idx" ON "Note"("orgId", "createdAt");

ALTER TABLE "Task" ADD CONSTRAINT "Task_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
