-- Pi Koç yeni paketleri (2026-11-12): 3 öğrenciye kadar ücretsiz; ücretli kademeler 5/10/20/50 öğrenci.
-- Ayar daha önce yönetimden kaydedildiyse eski kademeler veritabanında durur; yenisiyle değiştirilir.
UPDATE "SiteSetting" SET "value" = '"5:349,10:599,20:999,50:2000"'::jsonb, "updatedAt" = now() WHERE "key" = 'piKocTiers';
