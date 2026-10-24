-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'ENDED', 'CANCELLED', 'REFUNDED', 'FAILED', 'EXPIRED');

-- AlterTable
ALTER TABLE "LedgerEntry" ADD COLUMN     "subscriptionId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "subscriptionId" TEXT;

-- AlterTable
ALTER TABLE "PoolQuestion" ADD COLUMN     "subscriptionId" TEXT,
ALTER COLUMN "purchaseId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "QuestionPlan" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "levelId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "dailyLimit" INTEGER NOT NULL DEFAULT 10,
    "answerHours" INTEGER NOT NULL DEFAULT 12,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionSubscription" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "planId" TEXT,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "levelId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "levelName" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "commissionRateBps" INTEGER NOT NULL,
    "commissionAmount" INTEGER NOT NULL,
    "teacherAmount" INTEGER NOT NULL,
    "dailyLimit" INTEGER NOT NULL,
    "answerHours" INTEGER NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 30,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paidAt" TIMESTAMP(3),
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "missedCount" INTEGER NOT NULL DEFAULT 0,
    "refundedAmount" INTEGER NOT NULL DEFAULT 0,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "renewalReminderAt" TIMESTAMP(3),
    "earningsReleaseAt" TIMESTAMP(3),
    "earningsReleasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuestionPlan_teacherId_levelId_subjectId_key" ON "QuestionPlan"("teacherId", "levelId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionSubscription_code_key" ON "QuestionSubscription"("code");

-- CreateIndex
CREATE INDEX "QuestionSubscription_studentId_status_idx" ON "QuestionSubscription"("studentId", "status");

-- CreateIndex
CREATE INDEX "QuestionSubscription_teacherId_status_idx" ON "QuestionSubscription"("teacherId", "status");

-- CreateIndex
CREATE INDEX "QuestionSubscription_status_endsAt_idx" ON "QuestionSubscription"("status", "endsAt");

-- CreateIndex
CREATE INDEX "PoolQuestion_subscriptionId_createdAt_idx" ON "PoolQuestion"("subscriptionId", "createdAt");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "QuestionSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "QuestionSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolQuestion" ADD CONSTRAINT "PoolQuestion_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "QuestionSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionPlan" ADD CONSTRAINT "QuestionPlan_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionPlan" ADD CONSTRAINT "QuestionPlan_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionPlan" ADD CONSTRAINT "QuestionPlan_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSubscription" ADD CONSTRAINT "QuestionSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "QuestionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSubscription" ADD CONSTRAINT "QuestionSubscription_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSubscription" ADD CONSTRAINT "QuestionSubscription_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
