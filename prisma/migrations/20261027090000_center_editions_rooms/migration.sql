-- CreateEnum
CREATE TYPE "CenterEdition" AS ENUM ('ETUT', 'DERSHANE');

-- AlterEnum
ALTER TYPE "CenterPlan" ADD VALUE 'BUSINESS' BEFORE 'ENTERPRISE';

-- AlterTable
ALTER TABLE "Center" ADD COLUMN     "edition" "CenterEdition" NOT NULL DEFAULT 'DERSHANE';

-- AlterTable
ALTER TABLE "CenterApplication" ADD COLUMN     "edition" "CenterEdition";

-- CreateTable
CREATE TABLE "CenterRoom" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterRoom_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CenterRoom_centerId_name_key" ON "CenterRoom"("centerId", "name");

-- AddForeignKey
ALTER TABLE "CenterRoom" ADD CONSTRAINT "CenterRoom_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

