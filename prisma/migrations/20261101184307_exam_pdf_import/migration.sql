-- AlterTable
ALTER TABLE "CenterExamResult" ADD COLUMN     "externalRanks" JSONB;

-- CreateTable
CREATE TABLE "CenterExamImport" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterExamImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterExamAlias" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CenterExamAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CenterExamImport_centerId_createdAt_idx" ON "CenterExamImport"("centerId", "createdAt");

-- CreateIndex
CREATE INDEX "CenterExamAlias_studentId_idx" ON "CenterExamAlias"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CenterExamAlias_centerId_key_key" ON "CenterExamAlias"("centerId", "key");

-- AddForeignKey
ALTER TABLE "CenterExamImport" ADD CONSTRAINT "CenterExamImport_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterExamAlias" ADD CONSTRAINT "CenterExamAlias_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterExamAlias" ADD CONSTRAINT "CenterExamAlias_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
