-- CreateEnum
CREATE TYPE "TeacherInquiryStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- AlterTable
ALTER TABLE "Center" ADD COLUMN     "coachAutoReport" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "coachAutoReportWeek" DATE;

-- CreateTable
CREATE TABLE "TeacherInquiry" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "requesterId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "studentName" TEXT,
    "gradeName" TEXT,
    "offeringId" TEXT,
    "lessonName" TEXT,
    "mode" TEXT NOT NULL,
    "preferredTimes" TEXT,
    "note" TEXT,
    "status" "TeacherInquiryStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "centerStudentId" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherInquiry_teacherId_status_createdAt_idx" ON "TeacherInquiry"("teacherId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherInquiry_requesterId_createdAt_idx" ON "TeacherInquiry"("requesterId", "createdAt");

-- AddForeignKey
ALTER TABLE "TeacherInquiry" ADD CONSTRAINT "TeacherInquiry_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherInquiry" ADD CONSTRAINT "TeacherInquiry_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
