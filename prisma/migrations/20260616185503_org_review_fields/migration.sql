-- AlterTable
ALTER TABLE "Org" ADD COLUMN     "googleReviewUrl" TEXT,
ADD COLUMN     "reviewRequests" BOOLEAN NOT NULL DEFAULT false;
