-- AlterTable
ALTER TABLE "DirectMessage" ADD COLUMN     "flagReason" TEXT,
ADD COLUMN     "originalBody" TEXT;

-- AlterTable
ALTER TABLE "MessageThread" ADD COLUMN     "flaggedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedAt" TIMESTAMP(3);
