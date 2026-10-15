/*
  Warnings:

  - You are about to drop the `CenterHealthEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CenterStudentHealth` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CenterHealthEvent" DROP CONSTRAINT "CenterHealthEvent_centerId_fkey";

-- DropForeignKey
ALTER TABLE "CenterHealthEvent" DROP CONSTRAINT "CenterHealthEvent_studentId_fkey";

-- DropForeignKey
ALTER TABLE "CenterStudentHealth" DROP CONSTRAINT "CenterStudentHealth_studentId_fkey";

-- DropTable
DROP TABLE "CenterHealthEvent";

-- DropTable
DROP TABLE "CenterStudentHealth";

-- DropEnum
DROP TYPE "HealthEventKind";
