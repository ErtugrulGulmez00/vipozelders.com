-- CreateTable
CREATE TABLE "CenterResource" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "publisher" TEXT,
    "topics" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterStudentResource" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterStudentResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterResourceProgress" (
    "id" TEXT NOT NULL,
    "studentResourceId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "solved" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "wrong" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CenterResourceProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterStudyPlanItem" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "subject" TEXT NOT NULL,
    "topic" TEXT,
    "resourceId" TEXT,
    "targetQuestions" INTEGER,
    "note" TEXT,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterStudyPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CenterResource_centerId_idx" ON "CenterResource"("centerId");

-- CreateIndex
CREATE INDEX "CenterStudentResource_resourceId_idx" ON "CenterStudentResource"("resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "CenterStudentResource_studentId_resourceId_key" ON "CenterStudentResource"("studentId", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "CenterResourceProgress_studentResourceId_topic_key" ON "CenterResourceProgress"("studentResourceId", "topic");

-- CreateIndex
CREATE INDEX "CenterStudyPlanItem_studentId_date_idx" ON "CenterStudyPlanItem"("studentId", "date");

-- AddForeignKey
ALTER TABLE "CenterResource" ADD CONSTRAINT "CenterResource_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterStudentResource" ADD CONSTRAINT "CenterStudentResource_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterStudentResource" ADD CONSTRAINT "CenterStudentResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "CenterResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterResourceProgress" ADD CONSTRAINT "CenterResourceProgress_studentResourceId_fkey" FOREIGN KEY ("studentResourceId") REFERENCES "CenterStudentResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterStudyPlanItem" ADD CONSTRAINT "CenterStudyPlanItem_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterStudyPlanItem" ADD CONSTRAINT "CenterStudyPlanItem_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterStudyPlanItem" ADD CONSTRAINT "CenterStudyPlanItem_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "CenterResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
