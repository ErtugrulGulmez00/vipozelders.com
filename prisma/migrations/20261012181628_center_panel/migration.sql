-- CreateEnum
CREATE TYPE "CenterKind" AS ENUM ('ETUT', 'DERSHANE', 'KURS', 'OTHER');

-- CreateEnum
CREATE TYPE "CenterStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CenterPlan" AS ENUM ('STARTER', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "CenterRole" AS ENUM ('OWNER', 'MANAGER', 'TEACHER', 'ACCOUNTANT');

-- CreateEnum
CREATE TYPE "CenterStudentStatus" AS ENUM ('ACTIVE', 'PASSIVE', 'LEFT');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "EtudStatus" AS ENUM ('PLANNED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExamKind" AS ENUM ('LGS', 'TYT', 'AYT_SAY', 'AYT_EA', 'AYT_SOZ', 'YDT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CenterNoteKind" AS ENUM ('GENERAL', 'GUIDANCE', 'PARENT_MEETING', 'BEHAVIOR');

-- CreateEnum
CREATE TYPE "CenterPaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('RENT', 'SALARY', 'UTILITY', 'SUPPLIES', 'MARKETING', 'TAX', 'OTHER');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'ENROLLED', 'LOST');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'CENTER';

-- CreateTable
CREATE TABLE "Center" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "CenterKind" NOT NULL DEFAULT 'ETUT',
    "status" "CenterStatus" NOT NULL DEFAULT 'TRIAL',
    "plan" "CenterPlan" NOT NULL DEFAULT 'STARTER',
    "studentLimit" INTEGER NOT NULL DEFAULT 100,
    "trialEndsAt" TIMESTAMP(3),
    "paidUntil" TIMESTAMP(3),
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "cityId" INTEGER,
    "districtId" INTEGER,
    "taxOffice" TEXT,
    "taxNumber" TEXT,
    "logoKey" TEXT,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "academicYear" TEXT NOT NULL DEFAULT '2026-2027',
    "notifyAbsence" BOOLEAN NOT NULL DEFAULT true,
    "remindPayments" BOOLEAN NOT NULL DEFAULT true,
    "reminderDaysBefore" INTEGER NOT NULL DEFAULT 3,
    "nextReceiptNo" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Center_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterMember" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CenterRole" NOT NULL,
    "title" TEXT,
    "branch" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterSubscriptionPayment" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "months" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterSubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterStudent" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "studentNumber" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "gender" "Gender" NOT NULL DEFAULT 'UNSPECIFIED',
    "birthDate" DATE,
    "identityNumberEnc" TEXT,
    "schoolName" TEXT,
    "gradeName" TEXT,
    "targetExam" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "status" "CenterStudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CenterStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterGuardian" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notifySms" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT,
    "inviteTokenHash" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "linkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterGuardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterGroup" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gradeName" TEXT,
    "targetExam" TEXT,
    "teacherId" TEXT,
    "room" TEXT,
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterGroupStudent" (
    "groupId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterGroupStudent_pkey" PRIMARY KEY ("groupId","studentId")
);

-- CreateTable
CREATE TABLE "CenterScheduleSlot" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "teacherId" TEXT,
    "room" TEXT,

    CONSTRAINT "CenterScheduleSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterAttendanceSession" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "slotId" TEXT,
    "date" DATE NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "teacherId" TEXT,
    "takenById" TEXT,
    "takenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterAttendanceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterAttendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "note" TEXT,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "CenterAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterEtud" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "teacherId" TEXT,
    "date" DATE NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "topic" TEXT,
    "room" TEXT,
    "status" "EtudStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterEtud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterEtudStudent" (
    "etudId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "attendance" "AttendanceStatus",

    CONSTRAINT "CenterEtudStudent_pkey" PRIMARY KEY ("etudId","studentId")
);

-- CreateTable
CREATE TABLE "CenterExam" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ExamKind" NOT NULL,
    "date" DATE NOT NULL,
    "publisher" TEXT,
    "wrongPenalty" DOUBLE PRECISION NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterExamSection" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "subjectSlug" TEXT,
    "answerKey" TEXT,
    "topics" TEXT[],

    CONSTRAINT "CenterExamSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterExamResult" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "correct" INTEGER NOT NULL,
    "wrong" INTEGER NOT NULL,
    "blank" INTEGER NOT NULL,
    "net" DOUBLE PRECISION NOT NULL,
    "score" DOUBLE PRECISION,
    "rank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterExamResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterExamSectionResult" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "correct" INTEGER NOT NULL,
    "wrong" INTEGER NOT NULL,
    "blank" INTEGER NOT NULL,
    "net" DOUBLE PRECISION NOT NULL,
    "answers" TEXT,

    CONSTRAINT "CenterExamSectionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterNote" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "authorId" TEXT,
    "kind" "CenterNoteKind" NOT NULL DEFAULT 'GENERAL',
    "text" TEXT NOT NULL,
    "visibleToParent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterFeePlan" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "netAmount" INTEGER NOT NULL,
    "note" TEXT,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterFeePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterInstallment" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "remindedAt" TIMESTAMP(3),

    CONSTRAINT "CenterInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterPayment" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "receiptNo" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "CenterPaymentMethod" NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "payerName" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterPaymentAllocation" (
    "paymentId" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "CenterPaymentAllocation_pkey" PRIMARY KEY ("paymentId","installmentId")
);

-- CreateTable
CREATE TABLE "CenterExpense" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "paidTo" TEXT,
    "memberId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterAnnouncement" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "groupId" TEXT,
    "sendEmail" BOOLEAN NOT NULL DEFAULT false,
    "sendSms" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterMessage" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "studentId" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "providerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "CenterMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterLead" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "parentName" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "gradeName" TEXT,
    "message" TEXT,
    "source" TEXT NOT NULL DEFAULT 'web',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterApplication" (
    "id" TEXT NOT NULL,
    "centerName" TEXT NOT NULL,
    "kind" "CenterKind" NOT NULL DEFAULT 'ETUT',
    "contactName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cityId" INTEGER,
    "studentCount" TEXT,
    "message" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'NEW',
    "centerId" TEXT,
    "note" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Center_slug_key" ON "Center"("slug");

-- CreateIndex
CREATE INDEX "Center_status_idx" ON "Center"("status");

-- CreateIndex
CREATE INDEX "CenterMember_userId_idx" ON "CenterMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CenterMember_centerId_userId_key" ON "CenterMember"("centerId", "userId");

-- CreateIndex
CREATE INDEX "CenterSubscriptionPayment_centerId_idx" ON "CenterSubscriptionPayment"("centerId");

-- CreateIndex
CREATE INDEX "CenterStudent_centerId_status_idx" ON "CenterStudent"("centerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CenterStudent_centerId_studentNumber_key" ON "CenterStudent"("centerId", "studentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CenterGuardian_inviteTokenHash_key" ON "CenterGuardian"("inviteTokenHash");

-- CreateIndex
CREATE INDEX "CenterGuardian_centerId_idx" ON "CenterGuardian"("centerId");

-- CreateIndex
CREATE INDEX "CenterGuardian_studentId_idx" ON "CenterGuardian"("studentId");

-- CreateIndex
CREATE INDEX "CenterGuardian_userId_idx" ON "CenterGuardian"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CenterGroup_centerId_name_key" ON "CenterGroup"("centerId", "name");

-- CreateIndex
CREATE INDEX "CenterGroupStudent_studentId_idx" ON "CenterGroupStudent"("studentId");

-- CreateIndex
CREATE INDEX "CenterScheduleSlot_centerId_weekday_idx" ON "CenterScheduleSlot"("centerId", "weekday");

-- CreateIndex
CREATE INDEX "CenterScheduleSlot_groupId_idx" ON "CenterScheduleSlot"("groupId");

-- CreateIndex
CREATE INDEX "CenterAttendanceSession_centerId_date_idx" ON "CenterAttendanceSession"("centerId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CenterAttendanceSession_groupId_date_startMinute_key" ON "CenterAttendanceSession"("groupId", "date", "startMinute");

-- CreateIndex
CREATE INDEX "CenterAttendance_studentId_idx" ON "CenterAttendance"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CenterAttendance_sessionId_studentId_key" ON "CenterAttendance"("sessionId", "studentId");

-- CreateIndex
CREATE INDEX "CenterEtud_centerId_date_idx" ON "CenterEtud"("centerId", "date");

-- CreateIndex
CREATE INDEX "CenterEtudStudent_studentId_idx" ON "CenterEtudStudent"("studentId");

-- CreateIndex
CREATE INDEX "CenterExam_centerId_date_idx" ON "CenterExam"("centerId", "date");

-- CreateIndex
CREATE INDEX "CenterExamResult_studentId_idx" ON "CenterExamResult"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CenterExamResult_examId_studentId_key" ON "CenterExamResult"("examId", "studentId");

-- CreateIndex
CREATE INDEX "CenterExamSectionResult_sectionId_idx" ON "CenterExamSectionResult"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "CenterExamSectionResult_resultId_sectionId_key" ON "CenterExamSectionResult"("resultId", "sectionId");

-- CreateIndex
CREATE INDEX "CenterNote_studentId_idx" ON "CenterNote"("studentId");

-- CreateIndex
CREATE INDEX "CenterFeePlan_centerId_idx" ON "CenterFeePlan"("centerId");

-- CreateIndex
CREATE INDEX "CenterFeePlan_studentId_idx" ON "CenterFeePlan"("studentId");

-- CreateIndex
CREATE INDEX "CenterInstallment_centerId_dueDate_idx" ON "CenterInstallment"("centerId", "dueDate");

-- CreateIndex
CREATE INDEX "CenterInstallment_studentId_idx" ON "CenterInstallment"("studentId");

-- CreateIndex
CREATE INDEX "CenterPayment_centerId_paidAt_idx" ON "CenterPayment"("centerId", "paidAt");

-- CreateIndex
CREATE INDEX "CenterPayment_studentId_idx" ON "CenterPayment"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CenterPayment_centerId_receiptNo_key" ON "CenterPayment"("centerId", "receiptNo");

-- CreateIndex
CREATE INDEX "CenterExpense_centerId_date_idx" ON "CenterExpense"("centerId", "date");

-- CreateIndex
CREATE INDEX "CenterAnnouncement_centerId_createdAt_idx" ON "CenterAnnouncement"("centerId", "createdAt");

-- CreateIndex
CREATE INDEX "CenterMessage_centerId_createdAt_idx" ON "CenterMessage"("centerId", "createdAt");

-- CreateIndex
CREATE INDEX "CenterMessage_status_createdAt_idx" ON "CenterMessage"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CenterLead_centerId_status_idx" ON "CenterLead"("centerId", "status");

-- CreateIndex
CREATE INDEX "CenterApplication_status_createdAt_idx" ON "CenterApplication"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Center" ADD CONSTRAINT "Center_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Center" ADD CONSTRAINT "Center_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterMember" ADD CONSTRAINT "CenterMember_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterMember" ADD CONSTRAINT "CenterMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterSubscriptionPayment" ADD CONSTRAINT "CenterSubscriptionPayment_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterStudent" ADD CONSTRAINT "CenterStudent_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterGuardian" ADD CONSTRAINT "CenterGuardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterGuardian" ADD CONSTRAINT "CenterGuardian_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterGroup" ADD CONSTRAINT "CenterGroup_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterGroup" ADD CONSTRAINT "CenterGroup_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "CenterMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterGroupStudent" ADD CONSTRAINT "CenterGroupStudent_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CenterGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterGroupStudent" ADD CONSTRAINT "CenterGroupStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterScheduleSlot" ADD CONSTRAINT "CenterScheduleSlot_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CenterGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterScheduleSlot" ADD CONSTRAINT "CenterScheduleSlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "CenterMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterAttendanceSession" ADD CONSTRAINT "CenterAttendanceSession_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CenterGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterAttendance" ADD CONSTRAINT "CenterAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CenterAttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterAttendance" ADD CONSTRAINT "CenterAttendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterEtud" ADD CONSTRAINT "CenterEtud_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterEtud" ADD CONSTRAINT "CenterEtud_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "CenterMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterEtudStudent" ADD CONSTRAINT "CenterEtudStudent_etudId_fkey" FOREIGN KEY ("etudId") REFERENCES "CenterEtud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterEtudStudent" ADD CONSTRAINT "CenterEtudStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterExam" ADD CONSTRAINT "CenterExam_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterExamSection" ADD CONSTRAINT "CenterExamSection_examId_fkey" FOREIGN KEY ("examId") REFERENCES "CenterExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterExamResult" ADD CONSTRAINT "CenterExamResult_examId_fkey" FOREIGN KEY ("examId") REFERENCES "CenterExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterExamResult" ADD CONSTRAINT "CenterExamResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterExamSectionResult" ADD CONSTRAINT "CenterExamSectionResult_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "CenterExamResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterExamSectionResult" ADD CONSTRAINT "CenterExamSectionResult_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CenterExamSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterNote" ADD CONSTRAINT "CenterNote_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterNote" ADD CONSTRAINT "CenterNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "CenterMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterFeePlan" ADD CONSTRAINT "CenterFeePlan_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterFeePlan" ADD CONSTRAINT "CenterFeePlan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterInstallment" ADD CONSTRAINT "CenterInstallment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CenterFeePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterInstallment" ADD CONSTRAINT "CenterInstallment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterPayment" ADD CONSTRAINT "CenterPayment_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterPayment" ADD CONSTRAINT "CenterPayment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterPaymentAllocation" ADD CONSTRAINT "CenterPaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CenterPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterPaymentAllocation" ADD CONSTRAINT "CenterPaymentAllocation_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "CenterInstallment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterExpense" ADD CONSTRAINT "CenterExpense_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterExpense" ADD CONSTRAINT "CenterExpense_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CenterMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterAnnouncement" ADD CONSTRAINT "CenterAnnouncement_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterAnnouncement" ADD CONSTRAINT "CenterAnnouncement_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CenterGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterMessage" ADD CONSTRAINT "CenterMessage_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterLead" ADD CONSTRAINT "CenterLead_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterApplication" ADD CONSTRAINT "CenterApplication_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
