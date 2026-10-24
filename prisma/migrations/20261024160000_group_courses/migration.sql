-- CreateEnum
CREATE TYPE "GroupCourseStatus" AS ENUM ('OPEN', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "GroupSessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'TEACHER_NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GroupEnrollmentStatus" AS ENUM ('INVITED', 'PENDING_PAYMENT', 'PAID', 'CANCELLED', 'EXPIRED', 'FAILED');

-- AlterTable
ALTER TABLE "LedgerEntry" ADD COLUMN     "groupEnrollmentId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "groupEnrollmentId" TEXT;

-- CreateTable
CREATE TABLE "GroupCourse" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "levelId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "levelName" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "commissionRateBps" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "minParticipants" INTEGER NOT NULL,
    "enrollDeadline" TIMESTAMP(3) NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "status" "GroupCourseStatus" NOT NULL DEFAULT 'OPEN',
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupSession" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "GroupSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "videoRoomName" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "earningsReleaseAt" TIMESTAMP(3),
    "earningsReleasedAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),

    CONSTRAINT "GroupSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupAttendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "GroupAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupEnrollment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "learnerName" TEXT,
    "status" "GroupEnrollmentStatus" NOT NULL,
    "price" INTEGER NOT NULL,
    "commissionAmount" INTEGER NOT NULL,
    "teacherAmount" INTEGER NOT NULL,
    "holdExpiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "refundedAmount" INTEGER NOT NULL DEFAULT 0,
    "invitedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupCourse_code_key" ON "GroupCourse"("code");

-- CreateIndex
CREATE INDEX "GroupCourse_status_enrollDeadline_idx" ON "GroupCourse"("status", "enrollDeadline");

-- CreateIndex
CREATE INDEX "GroupCourse_teacherId_status_idx" ON "GroupCourse"("teacherId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GroupSession_videoRoomName_key" ON "GroupSession"("videoRoomName");

-- CreateIndex
CREATE INDEX "GroupSession_status_endAt_idx" ON "GroupSession"("status", "endAt");

-- CreateIndex
CREATE INDEX "GroupSession_startAt_idx" ON "GroupSession"("startAt");

-- CreateIndex
CREATE UNIQUE INDEX "GroupSession_courseId_index_key" ON "GroupSession"("courseId", "index");

-- CreateIndex
CREATE INDEX "GroupAttendance_sessionId_userId_idx" ON "GroupAttendance"("sessionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupEnrollment_code_key" ON "GroupEnrollment"("code");

-- CreateIndex
CREATE INDEX "GroupEnrollment_studentId_status_idx" ON "GroupEnrollment"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GroupEnrollment_courseId_studentId_key" ON "GroupEnrollment"("courseId", "studentId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_groupEnrollmentId_fkey" FOREIGN KEY ("groupEnrollmentId") REFERENCES "GroupEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_groupEnrollmentId_fkey" FOREIGN KEY ("groupEnrollmentId") REFERENCES "GroupEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupCourse" ADD CONSTRAINT "GroupCourse_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupCourse" ADD CONSTRAINT "GroupCourse_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupCourse" ADD CONSTRAINT "GroupCourse_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSession" ADD CONSTRAINT "GroupSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "GroupCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupAttendance" ADD CONSTRAINT "GroupAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GroupSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupEnrollment" ADD CONSTRAINT "GroupEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "GroupCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupEnrollment" ADD CONSTRAINT "GroupEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
