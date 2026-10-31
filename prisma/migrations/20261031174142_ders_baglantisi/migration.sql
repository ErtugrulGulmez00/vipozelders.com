-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN     "freeLessonLinks" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LessonLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "serviceTypeId" INTEGER NOT NULL,
    "levelId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "serviceName" TEXT NOT NULL,
    "levelName" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "note" TEXT,
    "sourceBookingId" TEXT,
    "bookingId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LessonLink_token_key" ON "LessonLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "LessonLink_bookingId_key" ON "LessonLink"("bookingId");

-- CreateIndex
CREATE INDEX "LessonLink_teacherId_startAt_idx" ON "LessonLink"("teacherId", "startAt");

-- CreateIndex
CREATE INDEX "LessonLink_sourceBookingId_idx" ON "LessonLink"("sourceBookingId");

-- AddForeignKey
ALTER TABLE "LessonLink" ADD CONSTRAINT "LessonLink_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonLink" ADD CONSTRAINT "LessonLink_sourceBookingId_fkey" FOREIGN KEY ("sourceBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonLink" ADD CONSTRAINT "LessonLink_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
