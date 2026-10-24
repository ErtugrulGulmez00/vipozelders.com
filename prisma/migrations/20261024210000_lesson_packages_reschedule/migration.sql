-- CreateEnum
CREATE TYPE "LessonPackageStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'CLOSED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RescheduleStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "packageId" TEXT,
ADD COLUMN     "rescheduleCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "packageId" TEXT;

-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN     "packageDiscounts" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "LessonPackage" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "offeringId" TEXT,
    "serviceName" TEXT NOT NULL,
    "levelName" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "lessonCount" INTEGER NOT NULL,
    "listUnitPrice" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "commissionRateBps" INTEGER NOT NULL,
    "status" "LessonPackageStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paidAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "refundedAmount" INTEGER NOT NULL DEFAULT 0,
    "recurringStartAt" TIMESTAMP(3),
    "recurring" JSONB,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RescheduleRequest" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "newStartAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "status" "RescheduleStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RescheduleRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LessonPackage_code_key" ON "LessonPackage"("code");

-- CreateIndex
CREATE INDEX "LessonPackage_studentId_status_idx" ON "LessonPackage"("studentId", "status");

-- CreateIndex
CREATE INDEX "LessonPackage_status_expiresAt_idx" ON "LessonPackage"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "RescheduleRequest_bookingId_status_idx" ON "RescheduleRequest"("bookingId", "status");

-- CreateIndex
CREATE INDEX "RescheduleRequest_status_createdAt_idx" ON "RescheduleRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "LessonPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "LessonPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPackage" ADD CONSTRAINT "LessonPackage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPackage" ADD CONSTRAINT "LessonPackage_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonPackage" ADD CONSTRAINT "LessonPackage_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "TeacherOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RescheduleRequest" ADD CONSTRAINT "RescheduleRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

