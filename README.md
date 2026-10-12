# Pi Kampüs · Sanal Dershane Platformu

Üç panelli özel ders pazaryeri:

- **Vitrin (herkese açık):** öğretmen arama ve filtreleme, öğretmen profilleri, boş/dolu saat takvimi, kategori (SEO) sayfaları, öğretmen başvuru formu (`/ogretmen-ol`), yasal sayfalar
- **Öğrenci/Veli hesabı** (`/hesabim`): randevu, ödeme, sanal sınıfa katılma, takvime ekleme (.ics / Google Takvim), iptal, sorun bildirme, değerlendirme, favoriler, hesap silme talebi
- **Öğretmen paneli** (`/ogretmen-paneli`): talepleri onaylama/reddetme, profil, dersler ve fiyatlar, müsaitlik takvimi, belge yükleme (kimlik, diploma, adli sicil; yalnızca yöneticiler görür), kazançlar, yorumlara cevap
- **Yönetim paneli** (`/yonetim`): hızlı öğretmen ekleme (otomatik kullanıcı adı ve geçici şifre), öğretmen başvurularından tek tıkla hesap açma, belge inceleme, yayın ve doğrulama, randevu ve itiraz yönetimi, ödemesiz **test dersi** (görüntülü görüşme denemesi), finans ve hakediş ödemeleri, Excel/CSV çıktıları, yorum moderasyonu, kategoriler, sayfalar, site ayarları ve bakım modu, bildirimler, e-posta kutusu, işlem kayıtları, iki adımlı doğrulama (Google Authenticator)
- **Kurum paneli** (`/kurum`, personel girişi `/kurum-giris` ya da `kurum.<alan adı>`): etüt merkezi, dershane ve kurslara aylık abonelikle satılan yönetim paneli: öğrenci ve veli kayıtları (Excel’den aktarım), sınıflar ve ders programı, yoklama ve velilere otomatik devamsızlık bildirimi (SMS / e-posta / site), etüt planı, deneme sınavları (LGS, TYT, AYT, YDT şablonları; cevap anahtarı, net, sıralama, ders/konu/soru analizi, karne, eksik konular), muhasebe (ödeme planı, tahsilat, makbuz, gecikenler, otomatik taksit hatırlatma, giderler, gelir-gider raporu), duyurular, ön kayıtlar, personel rolleri, abonelik. Ayrıntılar: [docs/kurum-paneli.md](docs/kurum-paneli.md)
- **Kurumlar için** (`/kurumlar-icin`, `/kurumlar`, `/kurumlar/<kurum>`): tanıtım ve başvuru sayfası, kurum rehberi, kurum vitrin sayfası ve ön kayıt formu
- **Veli portalı** (`/hesabim/kurum`): kurumun davet bağlantısıyla bağlanan veli; devamsızlık, etüt, deneme karnesi, eksik konular (pazaryeri öğretmenlerine yönlendirme), taksitler ve duyuruları görür
- **Sanal sınıf** (`/ders/...`): kamera, mikrofon, ekran paylaşımı, sohbet ve ortak **beyaz tahta**; yoklama otomatik tutulur
- **Mobil API** (`/api/mobil/v1`): Flutter uygulaması için JSON uç noktaları (Bearer oturum, randevu, ödeme ve sınıf için WebView bağlantısı, push bildirimi). Sözleşme ve uygulama promptu: [docs/flutter-uygulama-promptu.md](docs/flutter-uygulama-promptu.md)

Teknoloji: Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · PostgreSQL 18 + Prisma 7 · LiveKit (sanal sınıf) · PayTR (ödeme; iyzico da hazır).

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
| Kurum sahibi (Başarı Etüt Merkezi) | `kurum@demo.vipozelders.local` | `Kurum12345` |
| Kurum öğretmeni | `etut.ogretmen@demo.vipozelders.local` | `Ogretmen123` |
| Kurum muhasebe | `muhasebe@demo.vipozelders.local` | `Muhasebe123` |

Demo veli hesabı, demo kurumdaki “Ali Demirtaş”a bağlıdır (Hesabım → Kurumum).

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
| `npm run admin:2fa-kapat -- <kullanıcı>` | Telefonunu kaybeden yöneticinin iki adımlı doğrulamasını kapatır |
| `npm run test:e2e` | Uçtan uca tarayıcı testleri (`npm run db` ve `npm run dev` açıkken) |
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

## Kurum paneli (etüt merkezi / dershane)

Kurumu Pi Kampüs yöneticisi açar (**Yönetim → Kurumlar**; “Kurumlar için” sayfasından gelen başvurudan tek tıkla). Kurum sahibine kullanıcı adı ve geçici şifre verilir, deneme süresi başlar. Kurum sahibi personelini (müdür, öğretmen, muhasebe) kendisi ekler; her rol yalnızca yetkili olduğu bölümleri görür.

- **Abonelik:** planların fiyatı, öğrenci sınırı ve deneme süresi site ayarlarından değişir. Havale/EFT ile gelen ödemeyi yönetici kurum sayfasına kaydeder, süre uzar. Süre dolunca 7 gün ek süre verilir, sonra panel salt okunur olur (veriler silinmez); askıya alınan kurumun personeli giriş yapamaz.
- **Bildirimler:** devamsızlık, etüt devamsızlığı, taksit hatırlatma (vadeden N gün önce ve vade geçince bir kez, 10:00-20:00 arası), tahsilat bilgisi, deneme sonucu ve duyurular velilere SMS (Netgsm), e-posta ve veli portalı bildirimi olarak gider. Tümü kurumun “SMS / e-posta geçmişi” ekranında izlenir.
- **Giriş:** kurum personeli aynı hesap sistemini kullanır ama kendi giriş sayfasından girer (`/kurum-giris?kurum=<kurum>` kurumun adı ve logosuyla açılır). Velilerin tek hesabı vardır; hem özel ders tarafını hem veli portalını aynı hesapla kullanır.
- **Öğretmen önerileri:** veli portalı ve karnedeki “eksik konu için özel ders öğretmenleri” önerisini kurum, Kurum ayarları → Veli portalı bölümünden kapatabilir.
- **Veli portalı:** öğrenci kartındaki “Veli portalı daveti” ile veliye SMS/e-posta ya da WhatsApp ile paylaşılan bağlantı gider; veli ücretsiz hesabıyla bağlanır.
- **Excel:** öğrenci listesi ve deneme sonuçları .xlsx/.csv olarak içe aktarılır (şablonlar indirilebilir); öğrenci, tahsilat, borç, gider, devamsızlık ve deneme listeleri CSV olarak dışa aktarılır.
- **Mobil API:** veli portalı `/api/mobil/v1/kurum` uç noktalarıyla Flutter uygulamasında da kullanılabilir.

---

## Ödeme (PayTR)

Geliştirmede `PAYMENT_PROVIDER=mock` ile site içindeki **test ödeme sayfası** kullanılır; para çekilmez.

PayTR'ye geçiş (iFrame API):

1. PayTR mağaza panelinde **Destek & Kurulum → Entegrasyon Bilgileri** sayfasından Mağaza No, Mağaza Parola (key) ve Mağaza Gizli Anahtar (salt) bilgilerini alın.
2. `.env`: `PAYMENT_PROVIDER="paytr"`, `PAYTR_MERCHANT_ID`, `PAYTR_MERCHANT_KEY`, `PAYTR_MERCHANT_SALT`, denemeler için `PAYTR_TEST_MODE="1"` (canlıda `"0"`).
3. PayTR panelinde **Destek & Kurulum → Ayarlar → Bildirim URL** alanına `https://ALAN-ADINIZ/api/odeme/paytr/bildirim` yazın. Ödemenin onayı yalnızca bu adrese gelen imzalı bildirimle yapılır; bu yüzden site internetten erişilebilir olmalı (localhost'a bildirim gelmez; dönüş sayfası bu durumda PayTR durum sorgusuyla kontrol eder).
4. `APP_URL` sitenin gerçek adresi olmalı (ör. `https://vipozelders.com`); ödeme formundan dönüş `/api/odeme/paytr/donus` adresine yapılır.
5. Test modunda PayTR panelindeki test kartlarıyla başarılı ve başarısız ödeme, öğretmen reddi sonrası tam iade ve geç iptalde kısmi iade senaryolarını deneyin.

Nasıl çalışır: veli ödeme adımında sitenin içinde PayTR'nin 3D Secure formunu görür (`/odeme/paytr/...`), kart bilgisi bizim sunucumuza hiç gelmez. Taksit kapalıdır; tahsil edilen tutar ders ücretine eşittir. İadeler (red, süre aşımı, iptal) PayTR iade servisiyle otomatik yapılır, başarısız olursa arka plan görevi 5 kez yeniden dener. PayTR ile hakedişler öğretmenlere yönetim panelindeki **Finans** bölümünden havale kaydıyla ödenir.

> PayTR bağlantısı resmi dokümana göre yazıldı ve imza/iade hesapları otomatik testlerle doğrulandı, ancak gerçek PayTR test hesabıyla henüz denenmedi. Canlıya geçmeden önce test modunda yukarıdaki senaryoları mutlaka deneyin.

### iyzico (alternatif)

iyzico'ya geçiş:

1. [iyzico sandbox](https://sandbox-merchant.iyzipay.com) hesabı açıp API anahtarlarını alın.
2. `.env`: `PAYMENT_PROVIDER="iyzico"`, `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_BASE_URL="https://sandbox-api.iyzipay.com"`.
3. `APP_URL` iyzico'nun erişebileceği bir adres olmalı (ödeme dönüşü `/api/odeme/iyzico/donus` adresine gelir).
4. **Pazaryeri modu** (önerilen): `IYZICO_MARKETPLACE="true"`. Her öğretmen “Kazançlarım” sayfasında IBAN ve T.C. kimlik numarasını girince iyzico alt üye işyeri olarak kaydedilir; ders tamamlanıp itiraz süresi dolunca hakediş iyzico tarafından öğretmene aktarılır. Pazaryeri kapalıysa hakedişler yönetim panelinde “Finans” bölümünden havale kaydıyla ödenir.

> iyzico bağlantısı resmi `iyzipay` SDK'sıyla yazıldı ve imza doğrulaması yapıyor, ancak sandbox anahtarlarıyla henüz uçtan uca denenmedi. Canlıya geçmeden önce sandbox'ta başarılı ödeme, red sonrası iade ve kısmi iade senaryolarını mutlaka deneyin.

---

## Sanal sınıf (LiveKit)

Online dersler sitenin içinde açılır (kamera, mikrofon, ekran paylaşımı, sohbet ve iki tarafın da çizebildiği beyaz tahta). Sınıfa yalnızca o dersin öğretmeni ve öğrencisi, dersten 10 dakika önceden bitişten 15 dakika sonrasına kadar girebilir.

1. [LiveKit Cloud](https://cloud.livekit.io)'da ücretsiz proje açın (veya kendi sunucunuzda `livekit-server` çalıştırın).
2. `.env`: `LIVEKIT_URL="wss://...livekit.cloud"`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
3. Yoklama için LiveKit panelinde webhook adresini `https://ALAN-ADINIZ/api/livekit/webhook` yapın.

Anahtarlar girilmezse ders sayfası “sanal sınıf yapılandırılmadı” mesajı gösterir, uygulamanın geri kalanı çalışmaya devam eder.

**Görüntülü dersi denemek için:** Yönetim → Randevular → “Test dersi oluştur” ile bir öğretmen ve bir veli/öğrenci hesabı arasında ödemesiz, hemen başlayan bir ders açın; iki taraf da ders sayfasından “Derse katıl”a basar. Test dersleri yorum, puan, hakediş ve istatistiklere sayılmaz. Arkadaşınızla internet üzerinden denemek için [DEPLOY.md](DEPLOY.md) → “Hızlı deneme”.

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
- PayTR: imza hesapları, bildirim doğrulama, tekrar gelen bildirim, durum sorgusu, iade ve mükerrer ödeme iadesi
- iki adımlı doğrulama (RFC 6238 test vektörleri), takvim dosyası
- mobil API: Bearer oturumu, tek kullanımlık WebView girişi, push (imzalı JWT, ölü cihaz temizliği) ve uçtan uca kayıt → randevu → ödeme → onay → iptal akışı (`e2e/mobile-api.spec.ts`)
- öğretmen başvurusu → hesap açma → belge yükleme ve onay, özel belgelerin yabancılara kapalı olması (`e2e/teacher-onboarding.spec.ts`)
- kurum paneli: deneme şablonları ve net hesabı (LGS 1/3, YKS 1/4), cevap anahtarıyla okuma, konu dağılımı, sıralama, taksit planı, tahsilatın taksitlere dağıtılması, yazıyla tutar, yetki matrisi, abonelik durumu, Excel/CSV öğrenci aktarımı
- kurum başvurusu → kurum açma → ilk girişte şifre → sınıf/program → öğrenci ve veli → yoklama ve veli bildirimi → deneme → ödeme planı ve makbuz → veli daveti ve portal (`e2e/center-panel.spec.ts`)
- aynı saate eşzamanlı üç talepten yalnızca birinin kabul edilmesi ve veritabanı kısıtı
- red, süre aşımı, geç iptal, öğretmen iptali ve itiraz çözümü

---

## Canlıya çıkış kontrol listesi

Adım adım sunucu kurulumu (VPS, HTTPS, servis, yedekleme) ve sunucusuz hızlı deneme: **[DEPLOY.md](DEPLOY.md)**.

**Kod dışı (sizin tarafınız):**

- [ ] Şirket kuruluşu ve PayTR üye işyeri başvurusu
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
src/app/kurum/       kurum paneli (etüt merkezi / dershane)
src/app/ders/        sanal sınıf
src/app/api/         saatler, ilçeler, dosyalar, ödeme dönüşü, LiveKit webhook
src/actions/         Server Action'lar (her biri yetkiyi sunucuda yeniden kontrol eder)
src/server/          iş mantığı: bookings, availability, pricing, ledger, payments, video, reviews, scheduler
src/server/center/   kurum paneli: öğrenciler, sınıflar, yoklama, etüt, denemeler, muhasebe, mesajlar (SMS), personel, abonelik
src/components/      arayüz bileşenleri
tests/               Vitest testleri
```

İl ve ilçe verisi [turkey-neighbourhoods](https://www.npmjs.com/package/turkey-neighbourhoods) paketinden alınmıştır (MIT, `prisma/data/LICENSE-turkey-neighbourhoods.txt`).

## Sonraki aşamalar (Faz 2–3)

Mesajlaşma (iletişim bilgisi maskeleme), paketler ve deneme dersi, kupon, pazaryeri için SMS bildirimleri, erteleme ve tekrarlayan ders, ders notu/ödev ve veli raporu, il/ilçe SEO sayfaları ve blog, asenkron soru çözüm, koçluk araçları, grup dersleri, Flutter mobil uygulaması (sunucu tarafı API hazır). Kurum paneli için: online etüt (sanal sınıfla), optik okuyucu dosyası (TXT/DAT) aktarımı, ödev takibi, öğrenci girişi, kartla abonelik ödemesi, kuruma özel SMS başlığı.
