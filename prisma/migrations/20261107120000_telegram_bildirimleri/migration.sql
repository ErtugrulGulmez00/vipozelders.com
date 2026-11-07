-- Yönetici bildirimlerinin Telegram kopyası: gönderim zamanı (zamanlayıcı kuyruğu).
ALTER TABLE "Notification" ADD COLUMN "telegramSentAt" TIMESTAMP(3);

-- KVKK: Telegram aktarım listesine eklenir. Yönetimden düzenlenip bu parçası değişmiş metne dokunulmaz.
UPDATE "Page" SET "content" = REPLACE("content", $pk$- Yetkili kamu kurumları: yasal zorunluluk hâlinde$pk$, $pk$- Telegram: site yöneticilerine giden iç bildirimler (ad ve işlem özeti)
- Yetkili kamu kurumları: yasal zorunluluk hâlinde$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$kvkk-aydinlatma-metni$pk$ AND "content" LIKE $pk$%- Yetkili kamu kurumları: yasal zorunluluk hâlinde%$pk$;

UPDATE "Page" SET "content" = REPLACE("content", $pk$LiveKit, Google ve Meta sunucuları yurt dışında bulunabilir.$pk$, $pk$LiveKit, Google, Meta ve Telegram sunucuları yurt dışında bulunabilir.$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$kvkk-aydinlatma-metni$pk$ AND "content" LIKE $pk$%LiveKit, Google ve Meta sunucuları yurt dışında bulunabilir.%$pk$;

