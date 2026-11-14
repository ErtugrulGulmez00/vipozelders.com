-- AlterTable
ALTER TABLE "CenterStudent" ADD COLUMN     "inactiveNudgedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CenterStudentGoal" ADD COLUMN     "targetCode" TEXT,
ADD COLUMN     "targetExam" "PlacementExam";

