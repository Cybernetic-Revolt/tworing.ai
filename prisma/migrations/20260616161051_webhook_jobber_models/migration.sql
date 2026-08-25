-- CreateTable
CREATE TABLE "JobberConnection" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accountId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'REQUESTS',
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobberConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgWebhook" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastStatus" INTEGER,
    "lastFiredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobberConnection_orgId_key" ON "JobberConnection"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgWebhook_orgId_key" ON "OrgWebhook"("orgId");

-- AddForeignKey
ALTER TABLE "JobberConnection" ADD CONSTRAINT "JobberConnection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgWebhook" ADD CONSTRAINT "OrgWebhook_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
