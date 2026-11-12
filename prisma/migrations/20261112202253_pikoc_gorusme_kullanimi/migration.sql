-- CreateTable
CREATE TABLE "CoachMeeting" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "free" BOOLEAN NOT NULL DEFAULT false,
    "activeCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "CoachMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachMeeting_centerId_startedAt_idx" ON "CoachMeeting"("centerId", "startedAt");

-- CreateIndex
CREATE INDEX "CoachMeeting_roomName_endedAt_idx" ON "CoachMeeting"("roomName", "endedAt");

-- AddForeignKey
ALTER TABLE "CoachMeeting" ADD CONSTRAINT "CoachMeeting_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;
