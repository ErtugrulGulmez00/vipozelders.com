/*
  Warnings:

  - You are about to drop the column `succeeded` on the `Refund` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- AlterTable
ALTER TABLE "Refund" DROP COLUMN "succeeded",
ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "status" "RefundStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "JobLock" (
    "name" TEXT NOT NULL,
    "holder" TEXT NOT NULL,
    "lockedUntil" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobLock_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "Refund"("status");
