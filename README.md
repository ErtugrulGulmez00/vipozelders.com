# VIP Özel Ders · Sanal Dershane Platformu

Üç panelli özel ders pazaryeri:

- **Vitrin (herkese açık):** öğretmen arama ve filtreleme, öğretmen profilleri, boş/dolu saat takvimi, kategori (SEO) sayfaları, yasal sayfalar
- **Öğrenci/Veli hesabı** (`/hesabim`): randevu, ödeme, sanal sınıfa katılma, iptal, sorun bildirme, değerlendirme, favoriler
- **Öğretmen paneli** (`/ogretmen-paneli`): talepleri onaylama/reddetme, profil, dersler ve fiyatlar, müsaitlik takvimi, kazançlar, yorumlara cevap
- **Yönetim paneli** (`/yonetim`): hızlı öğretmen ekleme (otomatik kullanıcı adı ve geçici şifre), yayın ve doğrulama, randevu ve itiraz yönetimi, finans ve hakediş ödemeleri, yorum moderasyonu, kategoriler, sayfalar, site ayarları, e-posta kutusu, işlem kayıtları

Teknoloji: Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · PostgreSQL 18 + Prisma 7 · LiveKit (sanal sınıf) · iyzico (ödeme).

---

## Hızlı başlangıç (geliştirme)

Gereken tek şey **Node.js 24**. Docker veya ayrı bir PostgreSQL kurulumu gerekmez; veritabanı proje içindeki `.data/postgres` klasöründe çalışır.

```bash
npm install
cp .env.example .env          # sonra APP_SECRET'a uzun rastgele bir değer yazın

# 1. terminal: veritabanı (açık kalmalı)
npm run db

# 2. terminal: tabloları oluştur, başlangıç verilerini yükle, siteyi aç
npx prisma migrate deploy
npm run db:seed
npm run dev                   # http://localhost:3000
```

### Demo hesaplar (yalnızca geliştirme)

| Rol | Giriş | Şifre |
| --- | --- | --- |
| Yönetici | `admin` | `Yonetici123` |
| Öğretmen | `ayse.yilmaz` | `Ogretmen123` |
| Veli | `veli@demo.vipozelders.local` | `Veli12345` |
| Öğrenci | `ogrenci@demo.vipozelders.local` | `Ogrenci123` |

Diğer demo öğretmenlerin şifreleri rastgeledir; yönetim panelinden “Geçici şifre üret” ile giriş bilgisi alabilirsiniz (ilk girişte şifre değiştirme ekranı açılır).

Demo veriler `@demo.vipozelders.local` uzantılı hesaplar ve bunlara bağlı örnek ders ve yorumlardır. Yönetim panelinin özet ekranında, sistemde demo veri kaldığı sürece uyarı görünür.

---

## Komutlar

| Komut | Ne yapar |
| --- | --- |
| `npm run db` | Gömülü PostgreSQL'i başlatır (port 5433) |
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` / `npm start` | Üretim derlemesi ve sunucusu (derleme sırasında veritabanı açık olmalı) |
| `npm run db:seed` | Başlangıç verileri (tekrar çalıştırılabilir, kayıtları çoğaltmaz) |
| `npm run db:migrate` | Şema değişikliğinden yeni migration üretir |
| `npm run db:reset` | Veritabanını sıfırlar ve yeniden yükler (**tüm veriler silinir**) |
| `npm run worker` | Arka plan görevlerini ayrı süreçte çalıştırır |
| `npm test` | Birim ve entegrasyon testleri (`npm run db` açıkken) |
| `npm run typecheck` | TypeScript kontrolü |

---

## Nasıl çalışır?

**Randevu akışı:** Veli boş bir saati seçer → saat `paymentHoldMinutes` (15 dk) boyunca kilitlenir → ödeme alınır → öğretmen `approvalWindowHours` (12 saat) içinde onaylar veya reddeder → onaylanmazsa veya reddedilirse otomatik tam iade → ders saatinde sanal sınıf açılır → ders bitince “Tamamlandı” → `disputeWindowHours` (48 saat) boyunca sorun bildirilebilir → süre dolunca öğretmen hakedişi serbest kalır.

**Çifte rezervasyon** iki katmanda engellenir: öğretmen bazlı transaction kilidi ve PostgreSQL exclusion constraint (`Booking_teacher_no_overlap`).

**Para:** Tüm tutarlar kuruş cinsinden tam sayıdır. Fiyat, komisyon ve öğretmen payı randevu anında kopyalanır; sonradan fiyat değişse eski randevu etkilenmez. Öğretmen bakiyesi `LedgerEntry` defterinde üç kovada tutulur: bekleyen → ödenebilir → ödendi.

**İptal kuralları** (admin panelinden değişir): dersten 24 saat önce tam iade, 2 saate kadar %50, daha geç veya katılmama halinde iade yok. Öğretmen iptal ederse veya gelmezse tam iade.

**Arka plan görevleri** (dakikada bir): süresi dolan ödeme ve onaylar, biten derslerin tamamlanması (yoklamaya göre “öğrenci/öğretmen katılmadı” tespiti), hakediş serbest bırakma, 24 saat ve 1 saat önce hatırlatmalar, bekleyen iadeler, e-posta kuyruğu. Varsayılan olarak Next sunucusunun içinde çalışır (`src/instrumentation.ts`). Birden çok sunucu kullanacaksanız `DISABLE_INTERNAL_SCHEDULER=true` yapıp `npm run worker` çalıştırın. Yönetim panelinde “Zamanlanmış görevleri şimdi çalıştır” butonu da vardır.

---

## Ödeme (iyzico)

Geliştirmede `PAYMENT_PROVIDER=mock` ile site içindeki **test ödeme sayfası** kullanılır; para çekilmez.

iyzico'ya geçiş:

1. [iyzico sandbox](https://sandbox-merchant.iyzipay.com) hesabı açıp API anahtarlarını alın.
2. `.env`: `PAYMENT_PROVIDER="iyzico"`, `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_BASE_URL="https://sandbox-api.iyzipay.com"`.
3. `APP_URL` iyzico'nun erişebileceği bir adres olmalı (ödeme dönüşü `/api/odeme/iyzico/donus` adresine gelir).
4. **Pazaryeri modu** (önerilen): `IYZICO_MARKETPLACE="true"`. Her öğretmen “Kazançlarım” sayfasında IBAN ve T.C. kimlik numarasını girince iyzico alt üye işyeri olarak kaydedilir; ders tamamlanıp itiraz süresi dolunca hakediş iyzico tarafından öğretmene aktarılır. Pazaryeri kapalıysa hakedişler yönetim panelinde “Finans” bölümünden havale kaydıyla ödenir.

> iyzico bağlantısı resmi `iyzipay` SDK'sıyla yazıldı ve imza doğrulaması yapıyor, ancak sandbox anahtarlarıyla henüz uçtan uca denenmedi. Canlıya geçmeden önce sandbox'ta başarılı ödeme, red sonrası iade ve kısmi iade senaryolarını mutlaka deneyin.

---

## Sanal sınıf (LiveKit)

Online dersler sitenin içinde açılır (kamera, mikrofon, ekran paylaşımı, sohbet). Sınıfa yalnızca o dersin öğretmeni ve öğrencisi, dersten 10 dakika önceden bitişten 15 dakika sonrasına kadar girebilir.

1. [LiveKit Cloud](https://cloud.livekit.io)'da ücretsiz proje açın (veya kendi sunucunuzda `livekit-server` çalıştırın).
2. `.env`: `LIVEKIT_URL="wss://...livekit.cloud"`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
3. Yoklama için LiveKit panelinde webhook adresini `https://ALAN-ADINIZ/api/livekit/webhook` yapın.

Anahtarlar girilmezse ders sayfası “sanal sınıf yapılandırılmadı” mesajı gösterir, uygulamanın geri kalanı çalışmaya devam eder.

---

## E-posta

SMTP tanımlı değilse e-postalar yalnızca veritabanına yazılır ve **Yönetim → E-posta kutusu**'ndan okunur (geliştirme için idealdir). Canlıda `.env` içine `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` girin.

---

## Testler

```bash
npm run db      # ayrı terminalde açık olmalı
npm test
```

Testler her çalıştırmada ayrı bir `vipozelders_test` veritabanı oluşturur; geliştirme verilerine dokunmaz. Kapsam:

- boş saat üretimi (şablon, izin, ek saat, tampon, en erken ve en geç sınırlar)
- fiyat, komisyon, iptal ve kısmi iade hesapları
- uçtan uca randevu: ödeme → onay → tamamlama → yorum → hakediş
- aynı saate eşzamanlı üç talepten yalnızca birinin kabul edilmesi ve veritabanı kısıtı
- red, süre aşımı, geç iptal, öğretmen iptali ve itiraz çözümü

---

## Canlıya çıkış kontrol listesi

**Kod dışı (sizin tarafınız):**

- [ ] Şirket kuruluşu ve iyzico üye işyeri başvurusu (pazaryeri modeli)
- [ ] Yasal metinler: `Yönetim → Sayfalar`'daki şablonları avukata kontrol ettirin, “TASLAK METİN” satırlarını silin
- [ ] Site ayarlarına ticari unvan, adres, vergi/MERSİS bilgisi
- [ ] ETBİS kaydı (gerekiyorsa VERBİS); fatura ve vergi modeli için mali müşavir
- [ ] Alan adı, SSL, LiveKit projesi, SMTP hesabı

**Teknik:**

- [ ] Demo veriler olmadan temiz veritabanı: `SEED_DEMO=false npm run db:reset`
- [ ] Yönetici hesabı: `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` ortam değişkenleriyle seed (canlıda ilk girişte şifre değiştirme istenir)
- [ ] Uzun ve rastgele `APP_SECRET` (T.C. kimlik numaraları bununla şifrelenir; değişirse eski kayıtlar çözülemez)
- [ ] Yönetilen bir PostgreSQL (veritabanı saat dilimi **UTC** olmalı: `ALTER DATABASE ... SET timezone TO 'UTC'`), düzenli yedekleme
- [ ] Yüklenen dosyalar için kalıcı disk (`STORAGE_DIR`) veya S3 uyumlu depolama
- [ ] KVKK açısından sunucu ve veritabanının Türkiye'de olması en sorunsuz seçenektir

---

## Klasör yapısı

```text
prisma/              şema, migration'lar, seed, yasal sayfa şablonları, il/ilçe verisi
scripts/             gömülü veritabanı ve arka plan işçisi
src/app/(site)/      vitrin: ana sayfa, öğretmenler, profil, rezervasyon, ödeme, sayfalar
src/app/(auth)/      giriş, kayıt, şifre işlemleri
src/app/hesabim/     öğrenci/veli paneli
src/app/ogretmen-paneli/
src/app/yonetim/     admin paneli
src/app/ders/        sanal sınıf
src/app/api/         saatler, ilçeler, dosyalar, ödeme dönüşü, LiveKit webhook
src/actions/         Server Action'lar (her biri yetkiyi sunucuda yeniden kontrol eder)
src/server/          iş mantığı: bookings, availability, pricing, ledger, payments, video, reviews, scheduler
src/components/      arayüz bileşenleri
tests/               Vitest testleri
```

İl ve ilçe verisi [turkey-neighbourhoods](https://www.npmjs.com/package/turkey-neighbourhoods) paketinden alınmıştır (MIT, `prisma/data/LICENSE-turkey-neighbourhoods.txt`).

## Sonraki aşamalar (Faz 2–3)

Mesajlaşma (iletişim bilgisi maskeleme), paketler ve deneme dersi, kupon, SMS bildirimleri, erteleme ve tekrarlayan ders, ders notu/ödev ve veli raporu, beyaz tahta, öğretmen başvuru formu ve belge yükleme, il/ilçe SEO sayfaları ve blog, asenkron soru çözüm, koçluk araçları, grup dersleri, mobil uygulama.
