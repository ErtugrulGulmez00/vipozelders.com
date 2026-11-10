-- İndirim kodu kaldırıldı: SSS'deki anlatım davet indirimine çevrilir ve var olan kodlar pasife alınır.
UPDATE "Page" SET "content" = REPLACE("content", $pk$## İndirim kodumu nereye yazarım?
Ödeme adımındaki "İndirim kodum var" bağlantısına tıklayıp kodu yazın ve "Uygula"ya basın. Arkadaşınızın davet bağlantısıyla kayıt olduysanız ilk siparişinizde indirim kendiliğinden uygulanır.$pk$, $pk$## Davet indirimi nasıl uygulanır?
Arkadaşınızın davet bağlantısıyla kayıt olduysanız ilk siparişinizde indirim kendiliğinden uygulanır.$pk$), "updatedAt" = NOW() WHERE "slug" = $pk$sss$pk$;
UPDATE "Coupon" SET "isActive" = false;
