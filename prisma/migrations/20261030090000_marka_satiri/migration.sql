-- Hakkımızda ve İletişim: "Pi Kampüs" markasını yasal kişiye bağlayan satır (Meta işletme doğrulaması, WhatsApp görünen ad).
-- Yönetimden düzenlenip unvan satırı değiştirilmiş sayfalara dokunulmaz; satır zaten varsa tekrar eklenmez.

UPDATE "Page" SET "content" = REPLACE("content", $pk$Unvan: {companyName}
Adres: {companyAddress}$pk$, $pk$Unvan: {companyName}
Marka: {siteName} markası {companyName} tarafından işletilmektedir.
Adres: {companyAddress}$pk$), "updatedAt" = NOW()
WHERE "slug" = $pk$hakkimizda$pk$ AND "content" NOT LIKE $pk$%Marka: {siteName}%$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$- Unvan: {companyName}
- Adres: {companyAddress}$pk$, $pk$- Unvan: {companyName}
- Marka: {siteName} markası {companyName} tarafından işletilmektedir.
- Adres: {companyAddress}$pk$), "updatedAt" = NOW()
WHERE "slug" = $pk$iletisim$pk$ AND "content" NOT LIKE $pk$%Marka: {siteName}%$pk$;
