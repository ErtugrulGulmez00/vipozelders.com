-- AlterTable
ALTER TABLE "CenterExam" ADD COLUMN     "enteredByStudent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CenterStudent" ADD COLUMN     "monthlyFee" INTEGER;

-- CreateTable
CREATE TABLE "CenterStudySession" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "subject" TEXT,
    "minutes" INTEGER NOT NULL,
    "byStudent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterStudySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterCoachPayment" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterCoachPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CenterStudySession_studentId_date_idx" ON "CenterStudySession"("studentId", "date");

-- CreateIndex
CREATE INDEX "CenterCoachPayment_centerId_period_idx" ON "CenterCoachPayment"("centerId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "CenterCoachPayment_studentId_period_key" ON "CenterCoachPayment"("studentId", "period");

-- AddForeignKey
ALTER TABLE "CenterStudySession" ADD CONSTRAINT "CenterStudySession_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterStudySession" ADD CONSTRAINT "CenterStudySession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterCoachPayment" ADD CONSTRAINT "CenterCoachPayment_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterCoachPayment" ADD CONSTRAINT "CenterCoachPayment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
