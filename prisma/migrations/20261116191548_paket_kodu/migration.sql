-- CreateEnum
CREATE TYPE "PromoCodeKind" AS ENUM ('TRIAL', 'PACKAGE');

-- AlterTable
ALTER TABLE "Center" ADD COLUMN     "limitMailAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CoachPromoCode" ADD COLUMN     "amount" INTEGER,
ADD COLUMN     "kind" "PromoCodeKind" NOT NULL DEFAULT 'TRIAL',
ADD COLUMN     "months" INTEGER;
