-- CreateEnum
CREATE TYPE "HealthEventKind" AS ENUM ('INCIDENT', 'ILLNESS', 'MEDICATION', 'VACCINE', 'OTHER');

-- AlterTable
ALTER TABLE "CenterAttendanceSession" ADD COLUMN     "topic" TEXT;

-- AlterTable
ALTER TABLE "CenterStudent" ADD COLUMN     "coachId" TEXT,
ADD COLUMN     "coachMinute" INTEGER,
ADD COLUMN     "coachWeekday" INTEGER;

-- CreateTable
CREATE TABLE "CenterCoachingSession" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "coachId" TEXT,
    "date" DATE NOT NULL,
    "held" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL,
    "priorityTopics" TEXT[],
    "nextGoal" TEXT,
    "visibleToParent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterCoachingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterStudyHall" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "periods" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterStudyHall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterHallStudent" (
    "hallId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "deskNo" TEXT,

    CONSTRAINT "CenterHallStudent_pkey" PRIMARY KEY ("hallId","studentId")
);

-- CreateTable
CREATE TABLE "CenterHallDay" (
    "hallId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "marks" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CenterHallDay_pkey" PRIMARY KEY ("hallId","studentId","date")
);

-- CreateTable
CREATE TABLE "CenterOpticTemplate" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "numberStart" INTEGER NOT NULL,
    "numberLength" INTEGER NOT NULL,
    "nameStart" INTEGER,
    "nameLength" INTEGER,
    "sections" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterOpticTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterStudentHealth" (
    "studentId" TEXT NOT NULL,
    "bloodType" TEXT,
    "allergiesEnc" TEXT,
    "chronicEnc" TEXT,
    "medicationsEnc" TEXT,
    "notesEnc" TEXT,
    "alertEnc" TEXT,
    "emergencyName" TEXT,
    "emergencyPhone" TEXT,
    "consentAt" TIMESTAMP(3),
    "consentBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CenterStudentHealth_pkey" PRIMARY KEY ("studentId")
);

-- CreateTable
CREATE TABLE "CenterHealthEvent" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "kind" "HealthEventKind" NOT NULL,
    "date" DATE NOT NULL,
    "descriptionEnc" TEXT NOT NULL,
    "actionEnc" TEXT,
    "parentNotified" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterHealthEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CenterCoachingSession_centerId_date_idx" ON "CenterCoachingSession"("centerId", "date");

-- CreateIndex
CREATE INDEX "CenterCoachingSession_studentId_date_idx" ON "CenterCoachingSession"("studentId", "date");

-- CreateIndex
CREATE INDEX "CenterStudyHall_centerId_idx" ON "CenterStudyHall"("centerId");

-- CreateIndex
CREATE INDEX "CenterHallStudent_studentId_idx" ON "CenterHallStudent"("studentId");

-- CreateIndex
CREATE INDEX "CenterHallDay_studentId_date_idx" ON "CenterHallDay"("studentId", "date");

-- CreateIndex
CREATE INDEX "CenterOpticTemplate_centerId_idx" ON "CenterOpticTemplate"("centerId");

-- CreateIndex
CREATE INDEX "CenterHealthEvent_centerId_date_idx" ON "CenterHealthEvent"("centerId", "date");

-- CreateIndex
CREATE INDEX "CenterHealthEvent_studentId_idx" ON "CenterHealthEvent"("studentId");

-- AddForeignKey
ALTER TABLE "CenterStudent" ADD CONSTRAINT "CenterStudent_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CenterMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterCoachingSession" ADD CONSTRAINT "CenterCoachingSession_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterCoachingSession" ADD CONSTRAINT "CenterCoachingSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterCoachingSession" ADD CONSTRAINT "CenterCoachingSession_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CenterMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterStudyHall" ADD CONSTRAINT "CenterStudyHall_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterHallStudent" ADD CONSTRAINT "CenterHallStudent_hallId_fkey" FOREIGN KEY ("hallId") REFERENCES "CenterStudyHall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterHallStudent" ADD CONSTRAINT "CenterHallStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterHallDay" ADD CONSTRAINT "CenterHallDay_hallId_fkey" FOREIGN KEY ("hallId") REFERENCES "CenterStudyHall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterHallDay" ADD CONSTRAINT "CenterHallDay_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterOpticTemplate" ADD CONSTRAINT "CenterOpticTemplate_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterStudentHealth" ADD CONSTRAINT "CenterStudentHealth_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterHealthEvent" ADD CONSTRAINT "CenterHealthEvent_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterHealthEvent" ADD CONSTRAINT "CenterHealthEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
