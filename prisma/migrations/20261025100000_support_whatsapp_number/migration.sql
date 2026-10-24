-- WhatsApp destek düğmesi işletmenin WhatsApp numarasına (0850) yönlendirilir; yönetimden girilmiş başka numaraya dokunulmaz.
UPDATE "SiteSetting" SET "value" = '"+90 850 308 84 43"'::jsonb, "updatedAt" = NOW()
WHERE "key" = 'supportWhatsapp' AND "value" = '"+90 505 043 47 96"'::jsonb;
