-- CreateTable
CREATE TABLE "CenterWeeklyReport" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "note" TEXT,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CenterWeeklyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CenterWeeklyReport_token_key" ON "CenterWeeklyReport"("token");

-- CreateIndex
CREATE INDEX "CenterWeeklyReport_centerId_idx" ON "CenterWeeklyReport"("centerId");

-- CreateIndex
CREATE UNIQUE INDEX "CenterWeeklyReport_studentId_weekStart_key" ON "CenterWeeklyReport"("studentId", "weekStart");

-- AddForeignKey
ALTER TABLE "CenterWeeklyReport" ADD CONSTRAINT "CenterWeeklyReport_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterWeeklyReport" ADD CONSTRAINT "CenterWeeklyReport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
