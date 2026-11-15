-- CreateTable
CREATE TABLE "CenterReadingBook" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "totalPages" INTEGER,
    "pagesRead" INTEGER NOT NULL DEFAULT 0,
    "startedOn" DATE,
    "finishedOn" DATE,
    "addedByStudent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CenterReadingBook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CenterReadingBook_studentId_idx" ON "CenterReadingBook"("studentId");

-- CreateIndex
CREATE INDEX "CenterReadingBook_centerId_idx" ON "CenterReadingBook"("centerId");

-- AddForeignKey
ALTER TABLE "CenterReadingBook" ADD CONSTRAINT "CenterReadingBook_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterReadingBook" ADD CONSTRAINT "CenterReadingBook_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "CenterStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

