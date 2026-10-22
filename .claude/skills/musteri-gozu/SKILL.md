---
name: musteri-gozu
description: Siteyi bir müşterinin (veli, öğretmen adayı, kurum sahibi) gözünden ekran ekran değerlendirme — gerçek ekran görüntüleriyle persona yürüyüşü, puanlar ve öncelikli düzeltme listesi. Yeni ya da değişen bir vitrin sayfasında, ya da kullanıcı "müşteri gözüyle bak", "ilk gelen kişi nerede takılır" dediğinde kullan.
---

# Müşteri gözüyle değerlendirme

Amaç: ilk kez gelen birinin sayfayı anlayıp anlamadığını, güvenip güvenmediğini ve harekete geçip geçmediğini görmek. Bu nitel bir tahmindir, ölçüm değildir; raporda bunu belirt.

## Personalar (Pi Kampüs)

1. **Veli (Ayten, 41):** Telefondan, Google'da "LGS matematik özel ders" aratıp gelir. Kaygısı: para kaptırmak, kötü öğretmen, çocuğunun güvenliği. Güven veren: yorumlar, onaylı öğretmen, iade güvencesi, net fiyat. Akış: giriş sayfası → öğretmen arama → profil → randevu/tanışma (ödeme öncesi durur).
2. **Öğretmen adayı (Murat, 29, matematik):** "Online özel ders vererek para kazanma" aratır. Kaygısı: komisyon, ödemenin ne zaman yattığı, öğrenci bulup bulamayacağı. Akış: "Öğretmen ol" → başvuru formu (gönderilmez).
3. **Kurum sahibi (Selin, 46, etüt merkezi):** Excel ve WhatsApp ile yönetiyor. Kaygısı: fiyat, geçiş zahmeti, personelin kullanabilmesi, verinin güvenliği. Akış: "Kurumlar için" → planlar → başvuru (gönderilmez).

## Yöntem

1. Playwright ile telefon görünümü (390×844, `isMobile`, tr-TR) ve masaüstü (1366×900); **canlı sitede form gönderme, kayıt açma yok** — yalnızca gezin.
2. Her sayfada ilk tam ekran görüntüsünü al, sonra ~750 px kaydırarak her "kat" için görüntü al (`page.screenshot`), görüntüleri oku.
3. **İlk 5 saniye testi:** Bu ne? Bana göre mi? Ne yapmalıyım?
4. Her kat için iki ses:
   - **Persona:** birinci tekil, kısa iç ses ("Fiyat yazmıyor, pahalı mı acaba?").
   - **Analist:** güven, netlik, dikkat dağıtıcılar, harekete geçirici düğmenin görünürlüğü, metin uzunluğu, telefonda okunabilirlik.
5. **Sonuç:** netlik / güven / uygunluk (1-10), "devam eder miydim?" kararı.
6. **Öneriler:** hızlı kazanımlar (metin, sıra, düğme), orta işler, stratejik konular; her biri hangi sayfa ve kat olduğuyla.

## Rapor

Persona başına: akış özeti, en büyük 3 sürtünme noktası (ekran görüntüsü yoluyla), puanlar, öneriler. Sonda personalar arası ortak sorunlar ve öncelik sırası. Kullanıcıya önce özeti, sonra ayrıntıyı ver; düzeltmeleri onayı alınca uygula.
