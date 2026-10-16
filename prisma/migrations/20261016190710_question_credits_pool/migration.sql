-- CreateEnum
CREATE TYPE "CreditPurchaseStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "CreditEntryKind" AS ENUM ('PURCHASE', 'SPEND', 'RETURN', 'EXPIRE', 'REFUND');

-- CreateEnum
CREATE TYPE "PoolQuestionStatus" AS ENUM ('OPEN', 'CLAIMED', 'ANSWERED', 'CLOSED', 'EXPIRED', 'REJECTED', 'DISPUTED', 'REFUNDED', 'CANCELLED');

-- AlterTable
ALTER TABLE "LedgerEntry" ADD COLUMN     "poolQuestionId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "creditPurchaseId" TEXT,
ALTER COLUMN "bookingId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN     "answersPool" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "CreditPurchase" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "singlePrice" INTEGER NOT NULL,
    "status" "CreditPurchaseStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paidAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "refundedAmount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedger" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "questionId" TEXT,
    "kind" "CreditEntryKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoolQuestion" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "levelId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "levelName" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "note" TEXT,
    "imageKey" TEXT NOT NULL,
    "status" "PoolQuestionStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedById" TEXT,
    "claimedAt" TIMESTAMP(3),
    "claimExpiresAt" TIMESTAMP(3),
    "answerText" TEXT,
    "answerImageKey" TEXT,
    "answerVideoKey" TEXT,
    "answeredAt" TIMESTAMP(3),
    "followUpText" TEXT,
    "followUpAt" TIMESTAMP(3),
    "followUpAnswer" TEXT,
    "followUpAnsweredAt" TIMESTAMP(3),
    "rating" INTEGER,
    "ratedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "disputeReason" TEXT,
    "disputedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "teacherFee" INTEGER NOT NULL,
    "disputeUntil" TIMESTAMP(3),
    "releaseAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoolQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditPurchase_code_key" ON "CreditPurchase"("code");

-- CreateIndex
CREATE INDEX "CreditPurchase_studentId_status_idx" ON "CreditPurchase"("studentId", "status");

-- CreateIndex
CREATE INDEX "CreditLedger_studentId_idx" ON "CreditLedger"("studentId");

-- CreateIndex
CREATE INDEX "CreditLedger_purchaseId_idx" ON "CreditLedger"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "PoolQuestion_code_key" ON "PoolQuestion"("code");

-- CreateIndex
CREATE INDEX "PoolQuestion_status_levelId_subjectId_idx" ON "PoolQuestion"("status", "levelId", "subjectId");

-- CreateIndex
CREATE INDEX "PoolQuestion_studentId_idx" ON "PoolQuestion"("studentId");

-- CreateIndex
CREATE INDEX "PoolQuestion_claimedById_status_idx" ON "PoolQuestion"("claimedById", "status");

-- CreateIndex
CREATE INDEX "Payment_creditPurchaseId_idx" ON "Payment"("creditPurchaseId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_creditPurchaseId_fkey" FOREIGN KEY ("creditPurchaseId") REFERENCES "CreditPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_poolQuestionId_fkey" FOREIGN KEY ("poolQuestionId") REFERENCES "PoolQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditPurchase" ADD CONSTRAINT "CreditPurchase_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "CreditPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "PoolQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolQuestion" ADD CONSTRAINT "PoolQuestion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolQuestion" ADD CONSTRAINT "PoolQuestion_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "CreditPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolQuestion" ADD CONSTRAINT "PoolQuestion_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolQuestion" ADD CONSTRAINT "PoolQuestion_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolQuestion" ADD CONSTRAINT "PoolQuestion_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "TeacherProfile"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
