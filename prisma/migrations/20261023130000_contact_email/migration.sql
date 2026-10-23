-- Kurumsal iletişim adresi: örnek adres hâlâ kayıtlıysa info@pikampus.com yapılır (yönetimden girilmiş başka bir adrese dokunulmaz).
UPDATE "SiteSetting" SET "value" = '"info@pikampus.com"'::jsonb, "updatedAt" = NOW()
WHERE "key" = 'contactEmail' AND "value" = '"destek@example.com"'::jsonb;
