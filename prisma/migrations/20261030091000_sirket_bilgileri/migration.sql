-- Satıcı bilgileri (vergi dairesi kaydına göre, 30.10.2026): yasal sayfalardaki "[girilmedi]" alanlarını doldurur.
-- Yalnızca boş ya da hiç kaydedilmemiş ayarlar yazılır; Yönetim → Ayarlar'dan girilmiş değere dokunulmaz.

INSERT INTO "SiteSetting" ("key", "value", "updatedAt") VALUES
  ('companyName', to_jsonb($pk$Ümitcan Tutar$pk$::text), NOW()),
  ('companyTaxInfo', to_jsonb($pk$Namık Kemal Vergi Dairesi · VKN 8720776297$pk$::text), NOW()),
  ('companyAddress', to_jsonb($pk$Cumhuriyet Mah. Özel Sk. DMR Evleri 1 Kapı No:6 Daire No:8, Süleymanpaşa / Tekirdağ$pk$::text), NOW())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW()
WHERE "SiteSetting"."value" = to_jsonb(''::text);
