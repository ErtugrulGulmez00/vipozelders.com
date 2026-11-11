-- AlterTable
ALTER TABLE "Center" ADD COLUMN     "coachDigestOn" DATE;

-- AlterTable
ALTER TABLE "CenterStudent" ADD COLUMN     "planNudgedWeek" DATE;

-- CreateTable
CREATE TABLE "CenterPlanTemplate" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterPlanTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CenterPlanTemplate_centerId_idx" ON "CenterPlanTemplate"("centerId");

-- AddForeignKey
ALTER TABLE "CenterPlanTemplate" ADD CONSTRAINT "CenterPlanTemplate_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;
