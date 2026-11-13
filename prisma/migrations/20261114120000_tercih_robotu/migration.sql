-- CreateEnum
CREATE TYPE "PlacementExam" AS ENUM ('LGS', 'YKS');

-- CreateTable
CREATE TABLE "PlacementProgram" (
    "id" TEXT NOT NULL,
    "exam" "PlacementExam" NOT NULL,
    "year" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT,
    "faculty" TEXT,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "scoreType" TEXT NOT NULL,
    "kind" TEXT,
    "details" TEXT,
    "quota" INTEGER,
    "placed" INTEGER,
    "minScore" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION,
    "minRank" INTEGER,
    "percentile" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlacementProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterPlacementList" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "exam" "PlacementExam" NOT NULL,
    "programIds" TEXT[],
    "score" DOUBLE PRECISION,
    "rank" INTEGER,
    "percentile" DOUBLE PRECISION,
    "scoreType" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CenterPlacementList_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlacementProgram_exam_year_scoreType_idx" ON "PlacementProgram"("exam", "year", "scoreType");

-- CreateIndex
CREATE INDEX "PlacementProgram_exam_year_city_idx" ON "PlacementProgram"("exam", "year", "city");

-- CreateIndex
CREATE UNIQUE INDEX "PlacementProgram_exam_year_code_key" ON "PlacementProgram"("exam", "year", "code");

-- CreateIndex
CREATE INDEX "CenterPlacementList_centerId_idx" ON "CenterPlacementList"("centerId");

-- CreateIndex
CREATE UNIQUE INDEX "CenterPlacementList_studentId_exam_key" ON "CenterPlacementList"("studentId", "exam");

-- AddForeignKey
ALTER TABLE "CenterPlacementList" ADD CONSTRAINT "CenterPlacementList_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterPlacementList" ADD CONSTRAINT "CenterPlacementList_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

