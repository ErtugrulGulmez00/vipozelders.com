-- CreateTable
CREATE TABLE "CenterQuestionLog" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "subject" TEXT NOT NULL,
    "solved" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "wrong" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterQuestionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CenterQuestionLog_studentId_date_idx" ON "CenterQuestionLog"("studentId", "date");

-- CreateIndex
CREATE INDEX "CenterQuestionLog_centerId_date_idx" ON "CenterQuestionLog"("centerId", "date");

-- AddForeignKey
ALTER TABLE "CenterQuestionLog" ADD CONSTRAINT "CenterQuestionLog_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterQuestionLog" ADD CONSTRAINT "CenterQuestionLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
