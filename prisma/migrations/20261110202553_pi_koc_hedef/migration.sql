-- CreateTable
CREATE TABLE "CenterStudentGoal" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "kind" "ExamKind" NOT NULL,
    "label" TEXT,
    "sectionNets" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterStudentGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CenterStudentGoal_studentId_kind_key" ON "CenterStudentGoal"("studentId", "kind");

-- AddForeignKey
ALTER TABLE "CenterStudentGoal" ADD CONSTRAINT "CenterStudentGoal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
