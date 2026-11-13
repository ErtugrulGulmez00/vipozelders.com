-- Yorum ders talebine de bağlanabilir (yeni model); görüşmede aynı anda bulunan en yüksek kişi sayısı
ALTER TABLE "Review" ALTER COLUMN "bookingId" DROP NOT NULL;
ALTER TABLE "Review" ADD COLUMN "inquiryId" TEXT;
CREATE UNIQUE INDEX "Review_inquiryId_key" ON "Review"("inquiryId");
ALTER TABLE "Review" ADD CONSTRAINT "Review_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "TeacherInquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CoachMeeting" ADD COLUMN "peakCount" INTEGER NOT NULL DEFAULT 1;
