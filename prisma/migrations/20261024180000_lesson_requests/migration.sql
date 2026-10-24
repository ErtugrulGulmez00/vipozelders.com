-- CreateEnum
CREATE TYPE "LessonRequestStatus" AS ENUM ('NEW', 'CONTACTED', 'MATCHED', 'CLOSED');

-- CreateTable
CREATE TABLE "LessonRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "levelId" INTEGER,
    "subjectId" INTEGER,
    "levelName" TEXT,
    "subjectName" TEXT,
    "mode" TEXT NOT NULL,
    "cityName" TEXT,
    "preferredTimes" TEXT,
    "note" TEXT,
    "status" "LessonRequestStatus" NOT NULL DEFAULT 'NEW',
    "adminNote" TEXT,
    "notifiedTeachers" INTEGER NOT NULL DEFAULT 0,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonRequest_status_createdAt_idx" ON "LessonRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "LessonRequest" ADD CONSTRAINT "LessonRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
