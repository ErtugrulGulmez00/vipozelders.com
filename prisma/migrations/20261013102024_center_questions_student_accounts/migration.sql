-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('OPEN', 'ANSWERED', 'IN_PERSON');

-- AlterTable
ALTER TABLE "CenterGuardian" ADD COLUMN     "isStudentAccount" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CenterQuestion" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "askedByUserId" TEXT,
    "subject" TEXT NOT NULL,
    "note" TEXT,
    "imageKey" TEXT NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'OPEN',
    "answerText" TEXT,
    "answerImageKey" TEXT,
    "answerVideoKey" TEXT,
    "answeredById" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CenterQuestion_centerId_status_createdAt_idx" ON "CenterQuestion"("centerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CenterQuestion_studentId_idx" ON "CenterQuestion"("studentId");

-- AddForeignKey
ALTER TABLE "CenterQuestion" ADD CONSTRAINT "CenterQuestion_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterQuestion" ADD CONSTRAINT "CenterQuestion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterQuestion" ADD CONSTRAINT "CenterQuestion_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "CenterMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
