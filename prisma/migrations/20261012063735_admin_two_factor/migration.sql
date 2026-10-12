-- AlterEnum
ALTER TYPE "UserTokenType" ADD VALUE 'TWO_FACTOR_LOGIN';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN     "totpLastStep" INTEGER,
ADD COLUMN     "totpSecretEnc" TEXT;
