-- Kurumsal telefon: boş kaydedilmişse doldurulur (yönetimden girilmiş numaraya dokunulmaz).
UPDATE "SiteSetting" SET "value" = '"+90 505 043 47 96"'::jsonb, "updatedAt" = NOW()
WHERE "key" = 'contactPhone' AND "value" = '""'::jsonb;
