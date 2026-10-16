-- Öğretmene özel fotoğrafla soru kaldırıldı (tek soru çözümü artık soru kredisi + soru havuzu ile).
-- Sütun eski randevular ve geriye dönük uyumluluk için kalır; yeni soru alınmaz.
UPDATE "TeacherOffering" SET "questionPrice" = NULL WHERE "questionPrice" IS NOT NULL;
