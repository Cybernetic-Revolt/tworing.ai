-- AlterTable
ALTER TABLE "PhoneNumber" ADD COLUMN     "cnam" TEXT,
ADD COLUMN     "failoverE164" TEXT,
ADD COLUMN     "sipSubaccount" TEXT,
ADD COLUMN     "smsEnabled" BOOLEAN NOT NULL DEFAULT false;
