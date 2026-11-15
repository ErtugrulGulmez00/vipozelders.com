-- CreateTable
CREATE TABLE "CenterFile" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "groupId" TEXT,
    "studentId" TEXT,
    "title" TEXT NOT NULL,
    "subject" TEXT,
    "note" TEXT,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CenterFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CenterFile_centerId_createdAt_idx" ON "CenterFile"("centerId", "createdAt");

-- AddForeignKey
ALTER TABLE "CenterFile" ADD CONSTRAINT "CenterFile_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterFile" ADD CONSTRAINT "CenterFile_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CenterGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterFile" ADD CONSTRAINT "CenterFile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
