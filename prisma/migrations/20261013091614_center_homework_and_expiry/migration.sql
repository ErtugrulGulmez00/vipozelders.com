-- CreateEnum
CREATE TYPE "HomeworkStatus" AS ENUM ('PENDING', 'DONE', 'PARTIAL', 'MISSING');

-- AlterTable
ALTER TABLE "Center" ADD COLUMN     "expiryNoticeDays" INTEGER;

-- CreateTable
CREATE TABLE "CenterHomework" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "groupId" TEXT,
    "teacherId" TEXT,
    "subject" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignedOn" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterHomework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterHomeworkStudent" (
    "homeworkId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "HomeworkStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "CenterHomeworkStudent_pkey" PRIMARY KEY ("homeworkId","studentId")
);

-- CreateIndex
CREATE INDEX "CenterHomework_centerId_dueDate_idx" ON "CenterHomework"("centerId", "dueDate");

-- CreateIndex
CREATE INDEX "CenterHomeworkStudent_studentId_idx" ON "CenterHomeworkStudent"("studentId");

-- AddForeignKey
ALTER TABLE "CenterHomework" ADD CONSTRAINT "CenterHomework_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterHomework" ADD CONSTRAINT "CenterHomework_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CenterGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterHomework" ADD CONSTRAINT "CenterHomework_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "CenterMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterHomeworkStudent" ADD CONSTRAINT "CenterHomeworkStudent_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "CenterHomework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterHomeworkStudent" ADD CONSTRAINT "CenterHomeworkStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
