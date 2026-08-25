-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "vapiCallId" TEXT;

-- CreateIndex
CREATE INDEX "Lead_vapiCallId_idx" ON "Lead"("vapiCallId");
