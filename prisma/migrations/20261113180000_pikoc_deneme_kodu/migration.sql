-- AlterTable
ALTER TABLE "Center" ADD COLUMN     "overLimitSince" TIMESTAMP(3),
ADD COLUMN     "promoStudents" INTEGER,
ADD COLUMN     "promoUntil" TIMESTAMP(3);
-- CreateTable
CREATE TABLE "CoachPromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "note" TEXT,
    "days" INTEGER NOT NULL DEFAULT 30,
    "students" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemedAt" TIMESTAMP(3),
    "redeemedByUserId" TEXT,
    "centerId" TEXT,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "CoachPromoCode_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "CoachPromoCode_code_key" ON "CoachPromoCode"("code");
-- CreateIndex
CREATE INDEX "CoachPromoCode_redeemedByUserId_idx" ON "CoachPromoCode"("redeemedByUserId");
-- AddForeignKey
ALTER TABLE "CoachPromoCode" ADD CONSTRAINT "CoachPromoCode_redeemedByUserId_fkey" FOREIGN KEY ("redeemedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "CoachPromoCode" ADD CONSTRAINT "CoachPromoCode_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE SET NULL ON UPDATE CASCADE;
