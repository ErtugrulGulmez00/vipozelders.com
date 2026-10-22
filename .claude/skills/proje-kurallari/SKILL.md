---
name: proje-kurallari
description: Pi Kampüs kod kuralları ve tuzakları — Next.js 16, Prisma 7, para/tarih/ayar kuralları, Türkçe arayüz, git ve Windows tuzakları. Bu projede kod yazmadan ya da değiştirmeden önce kullan.
---

# Pi Kampüs kuralları

Üç ürün tek uygulamada: özel ders pazaryeri, soru kredisi + soru havuzu, kurum paneli (etüt/dershane SaaS). Mobil uygulama `piakademi-mobil/` (Flutter) ayrı projedir; API sözleşmesi `docs/flutter-uygulama-promptu.md`. Ayrıntılı özellik listesi `README.md` ve `docs/kurum-paneli.md`.

## Next.js 16 (eğitim verindeki Next.js değil)

- Kod yazmadan önce ilgili belgeyi `node_modules/next/dist/docs/` altında oku (AGENTS.md).
- Yeni sayfa ekledikten sonra `npx next typegen` (`PageProps<"/yol">`, `RouteContext` tipleri).
- Cache Components açık: istek başına hesaplanan sayfada `new Date()` kullanılıyorsa önce `await connection()` (aksi hâlde önceden hazırlama hatası).
- Düzen (layout) içinde `usePathname` kullanan istemci bileşeni `<Suspense>` içinde olmalı.
- Form işlemleri Server Actions; sonra `refresh()`, önbellek etiketi için `updateTag(...)`.

## Prisma 7

- Şema değişikliği: `npx prisma migrate dev --name <ad>` → `npx prisma generate`. Uygulanmış göç dosyası düzenlenmez; yeni göç yazılır. Veri düzeltmesi için `--create-only` ile SQL göçü.
- Canlıda göçler `update.sh` içinde `migrate deploy` ile uygulanır. `migrate reset`/`db push` canlıda asla.

## İş kuralları

- **Para kuruş cinsinden tam sayı** (`125000` = 1.250 ₺); gösterim `formatMoney`. Fiyat, komisyon ve öğretmen payı randevuya kopyalanır.
- **Tarih UTC saklanır**, gösterim İstanbul: `src/lib/dates.ts` yardımcıları (`toLocalDateString`, `zonedDateTime`, `formatDateTime`).
- **Değişebilecek kurallar site ayarıdır**: `src/server/settings.ts` şeması + `src/app/yonetim/ayarlar/settings-form.tsx`. Sabit kodlama yapma.
- Hakediş defteri `LedgerEntry` (PENDING → AVAILABLE → PAID); serbest kalma `settledReleaseAt` (itiraz süresi ve ödeme kuruluşu aktarım süresi).
- Kullanıcı metninde iletişim bilgisi gizleme: `maskContacts` (`src/lib/text.ts`); platform dışı yönlendirme algılama: `offPlatformReason` (`src/server/messages.ts`).
- Ödeme sağlayıcıları `src/server/payments/` (garanti, paytr, iyzico, mock); satış kapalıyken `salesOpen()`.
- Arka plan görevleri `src/server/scheduler.ts` (dakikada bir).
- Sunucu hataları otomatik kaydedilir (Yönetim → Hatalar).

## Arayüz

- Tüm metinler Türkçe; kullanıcıya "siz" diye hitap edilir. Kod tanımlayıcıları İngilizce, yorumlar Türkçe ve kısa.
- Bileşenler `src/components/ui/primitives.tsx`, formlar `ActionForm` / `SubmitButton`. Telefon genişliğinde (390 px) taşma olmamalı.
- Gizlilik: öğretmen velinin soyadını yalnızca baş harfle görür; öğrenciye ait soru fotoğrafları özel depoda.

## Git

- **`git add -A` / `git add .` asla.** Depo herkese açık; kullanıcı klasöre özel ekran görüntüleri koyuyor (`ornekfotolar/` yok sayılır). Dosyaları tek tek ekle.
- Köşeli parantezli yollar için: `git add -- ':(literal)src/app/ders/[bookingId]/page.tsx'`.
- `.env` hiçbir zaman commit'lenmez; sır değerleri ekrana yazdırılmaz.
- Çalışma dalı `paytr-ve-iyilestirmeler`. `main`'e aktarma ve zorla push kullanıcının işi.

## Windows tuzakları

- Çok satırlı ya da tırnaklı düzenlemeleri `node -e` ile değil, geçici `.cjs` betiğiyle (düz metin değiştirme, eşleşme sayısını kontrol ederek) yap.
- `git checkout` dosyayı CRLF ile geri getirebilir; LF bekleyen düzenlemeden önce `sed -i 's/\r$//'`.
- PowerShell 5.1 `Set-Content` BOM ekler; sunucuya gönderilen betiklerde BOM ve `\r` temizlenir.
- Projede Prettier ayarı yok; `prettier --write` çalıştırma (bütün dosyayı yeniden biçimlendirir).
