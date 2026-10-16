# Pi Kampüs mobil uygulaması (Flutter) için prompt

Aşağıdaki metnin tamamını Flutter uygulamasını yazacak yapay zekâya veya geliştiriciye verin. Bölüm 5'teki mobil API web projesinde hazırdır (`/api/mobil/v1`) ve uçtan uca testlerle doğrulanmıştır (`e2e/mobile-api.spec.ts`, `e2e/mobile-api-extra.spec.ts`).

> Uygulama bu promptla yazıldı: `piakademi-mobil/` (kurulum ve derleme için oradaki `README.md`). Bu dosya API'nin güncel başvuru belgesi olarak tutulur; API'ye eklenen her alan buraya da yazılır.

---

## Görev

“Pi Kampüs” adlı Türk özel ders platformunun **Flutter** ile iOS ve Android mobil uygulamasını yaz. Web sitesi ve tüm iş kuralları hazır (Next.js + PostgreSQL); uygulama yalnızca aşağıdaki JSON API'yi kullanan bir istemcidir. Fiyat, komisyon, iade, uygunluk gibi hiçbir iş kuralı uygulamada hesaplanmaz; hepsi sunucudan gelir. Ekranlarda hangi düğmenin görüneceğine sunucunun döndürdüğü `actions` alanı karar verir.

Arayüz tamamen **Türkçe**, saatler **Europe/Istanbul**, para birimi **TL**. Sunucu tutarları **kuruş** cinsinden tam sayı gönderir (`125050` → “₺1.250,50”), tarihleri ISO 8601 UTC gönderir.

## 1. Ürün özeti

- **Veli / öğrenci:** öğretmen arar (kademe, ders, hizmet türü, online/yüz yüze, il/ilçe, fiyat, puan), profil ve boş saatleri görür, saat seçip randevu alır, kartla öder (PayTR, uygulama içi WebView), öğretmen onaylayınca sanal sınıfa katılır, ders sonrası puan/yorum bırakır.
- **Öğretmen** (hesabı yönetici açar, kullanıcı adıyla girer): talepleri onaylar/reddeder, derslerini görür, sanal sınıfa katılır, haftalık müsaitliğini ve izinlerini düzenler, kazançlarını görür, yorumlara cevap verir. Profil (fotoğraf, ders ve fiyatlar) web panelinden düzenlenir.
- **Yönetici** ve **kurum personeli** mobil uygulamaya giremez (API `ADMIN_NOT_SUPPORTED` / `CENTER_NOT_SUPPORTED` döner); yönetim ve Kurum Paneli yalnızca web'de.
- **Fotoğrafla soru:** öğretmen “Soru Çözüm” hizmetinde soru başı ücret (`questionPrice`) belirlediyse veli sorunun fotoğrafını çekip öder; öğretmen `rules.questionAnswerHours` saat içinde çözümü (yazı, fotoğraf, video) gönderir, ardından kısa bir yazışma açık kalır.
- Kademeler (Okul Öncesi, İlkokul, Ortaokul, Lise, LGS, YKS…), dersler ve hizmet türleri (Özel Ders, Soru Çözüm, Koçluk) sunucudan dinamik gelir.
- Randevu durumları (`status`, Türkçe karşılığı `statusLabel` olarak hazır gelir): `PENDING_PAYMENT`, `PAYMENT_FAILED`, `PENDING_APPROVAL`, `CONFIRMED`, `COMPLETED`, `REJECTED`, `EXPIRED`, `CANCELLED_BY_STUDENT`, `CANCELLED_BY_TEACHER`, `CANCELLED_BY_ADMIN`, `NO_SHOW_STUDENT`, `NO_SHOW_TEACHER`, `DISPUTED`.

## 2. Teknik tercihler

- Flutter (güncel kararlı sürüm), Dart null safety.
- **Riverpod** (durum), **go_router** (yönlendirme + derin bağlantı), **dio** (HTTP; `Authorization: Bearer` ekleyen ve 401'de girişe döndüren interceptor), **freezed + json_serializable** (modeller), **flutter_secure_storage** (oturum anahtarı), **intl** (tr_TR tarih ve para biçimi), **webview_flutter** (ödeme ve sanal sınıf), **firebase_messaging** + **flutter_local_notifications** (bildirim), **cached_network_image**, **url_launcher** (yasal sayfalar, takvim dosyası).
- API adresi derleme anında verilir: `--dart-define=API_BASE_URL=https://alanadi.com/api/mobil/v1`.
- Klasör yapısı: `lib/core` (api, hata, tema, yönlendirme, biçimlendirme), `lib/features/<özellik>/{data,domain,presentation}`.
- Tema: ana renk indigo `#4F46E5` (koyu `#312E81`, en koyu `#1E1B4B`), vurgu altın `#FBBF24`, yazı tipi Plus Jakarta Sans; açık tema öncelikli, karanlık tema desteği.
- Her ekranda yükleniyor / boş / hata durumları; çevrimdışıyken anlaşılır uyarı; API hatalarında sunucunun Türkçe `message` metni gösterilir, `fields` varsa ilgili form alanının altına yazılır.
- Erişilebilirlik: büyük dokunma alanları, ekran okuyucu etiketleri, sistem yazı boyutuna uyum.

## 3. Ekranlar

**Ortak:** açılış (anahtar varsa `GET /ben`) → giriş (e-posta veya kullanıcı adı + şifre) → kayıt (veli/öğrenci; KVKK ve kullanım şartları onayı zorunlu, metinler `katalog.pages` adreslerinden) → şifremi unuttum → `mustChangePassword: true` ise kapatılamayan şifre değiştirme ekranı → bildirimler → hesap (profil, şifre, **hesabı silme talebi**, çıkış).

`GET /katalog` yanıtında `maintenance.on` true ise üstte bakım uyarısı gösterilir; kayıt ve randevu düğmeleri kapatılır.

**Veli / öğrenci (alt menü: Keşfet · Derslerim · Favoriler · Hesabım):**

1. **Keşfet:** arama kutusu, kademe kısayolları, öne çıkan öğretmenler (`GET /ogretmenler?sort=onerilen`).
2. **Öğretmen listesi:** filtre sayfası (kademe, ders, hizmet, online/yüz yüze, il/ilçe, fiyat aralığı, puan, cinsiyet, müsaitlik zamanı, onaylı öğretmen) ve sıralama (`katalog.sortOptions`); sayfalı yükleme.
3. **Öğretmen profili:** fotoğraf, onaylı rozeti, puan, deneyim, hakkında, tanıtım videosu (YouTube), dersler ve süreye göre fiyatlar, yorumlar, favori düğmesi, “Randevu al”.
4. **Randevu:** ders seçimi (`offerings`) → süre (`durations`, fiyatıyla) → online/yüz yüze (yüz yüzede yer: öğrencinin adresi → ilçe + adres; öğretmenin yeri) → gün şeridi + boş saatler (`available: false` olanlar gri, seçilemez) → ders kimin için (ad, sınıf), not → özet: tutar, “KDV dahil; öğretmen onaylamazsa ücretin tamamı iade edilir”, ön bilgilendirme formu ve mesafeli satış sözleşmesi onay kutusu (`consent: true`) → ödeme.
5. **Ödeme:** bölüm 6.
6. **Derslerim:** sekmeler `yaklasan` · `gecmis` · `iptal`; kartta durum etiketi, tarih, öğretmen.
7. **Ders ayrıntısı:** bilgiler, ödemeler ve iadeler, durum geçmişi (`events`), düğmeler `actions`'a göre: “Ödemeyi tamamla” (`canPay`), “Derse katıl” (`canJoin`), “İptal et” (`canCancel`; önce `cancelPreview.refundAmount` ile iade tutarını gösterip onay ister), “Değerlendir” (`canReview`; mevcut `review` varsa düzenleme), “Sorun bildir” (`canDispute`), “Takvime ekle”. Sınıf henüz açılmadıysa `classroom.opensAt` ile geri sayım.
8. **Favoriler.**
9. **Kurumum (veli portalı):** çocuğu Pi Kampüs kullanan bir etüt merkezine/dershaneye kayıtlıysa (`GET /kurum` boş değilse) Hesabım'da “Kurumum” girişi görünür. Öğrenci seçilince sekmeler: Özet (devam oranı, son deneme neti ve sırası, kalan/geciken ödeme, eksik konular), Devam ve etüt, Denemeler (net gelişim grafiği, deneme → karne ekranı: ders bazında D/Y/B/net, kurum ortalaması, konu analizi, eksikler ve “özel ders öğretmenleri” bağlantısı), Ödemeler (taksitler ve durumları, yapılan ödemeler), Ödevler, Soru sor (kamerayla fotoğraf çekip gönderme; çözüm fotoğrafı/videosu bildirimle gelir), Ders programı, Duyurular ve öğretmen notları. Kurumun açtığı öğrenci hesabı da aynı ekranları kullanır. Kurumun gönderdiği davet bağlantısı (`https://alanadi.com/kurum-davet/<kod>`) uygulamada açılırsa giriş sonrası `POST /kurum/davet` ile bağlanır.

**Öğretmen (alt menü: Özet · Talepler · Derslerim · Takvim · Hesabım):**

1. **Özet** (`GET /ogretmen/ozet`): bekleyen talepler, yaklaşan dersler, puan, bakiye, profil eksikleri (`checklist`).
2. **Talepler** (`kapsam=talepler`): kalan yanıt süresi (`approvalDeadline`), Onayla / Reddet (gerekçe zorunlu; hazır seçenekler: “O saatte müsait değilim”, “Bu konu/seviye için uygun değilim”, “Diğer”).
3. **Derslerim** (`yaklasan` · `gecmis`) ve ders ayrıntısı: veli adı ve telefonu, yüz yüze adres yalnızca onaydan sonra gelir; “Derse katıl”, “Dersi iptal et” (öğrenciye tam iade yapılır).
4. **Takvim:** haftanın her günü için birden çok saat aralığı, dersler arası tampon süre (`bufferOptions`), izin/ek saat ekleme ve silme.
5. **Kazançlar:** bekleyen / ödenebilir / ödenen, son hareketler, havaleler, maskeli IBAN.
6. **Yorumlar:** gelen yorumlar ve herkese açık cevap.

## 4. Oturum

- `POST /oturum` ve `POST /kayit` yanıtındaki `token` `flutter_secure_storage`'a yazılır, her istekte `Authorization: Bearer <token>` olarak gönderilir. Anahtar 90 gün geçerlidir.
- **401** → anahtar silinir, giriş ekranı açılır. **403 `PASSWORD_CHANGE_REQUIRED`** → şifre değiştirme ekranı. **403 `ADMIN_NOT_SUPPORTED`** / **`CENTER_NOT_SUPPORTED`** → sunucunun mesajı ve web panelini açan düğme.
- Özel dosyalar (`/api/dosya/…`: soru ve çözüm fotoğrafları, videolar) uygulamada aynı `Authorization: Bearer` başlığıyla istenir; başlıksız istek 403 döner.
- Siteden WebView'da açılan sayfalar (ödeme, sanal sınıf, yasal metinler) user-agent'a `PiKampusApp/1.0` eklenirse “uygulama modu”nda açılır: sitenin üst menüsü, alt bilgisi ve çerez uyarısı gizlenir.
- Çıkış: `DELETE /oturum?cihaz=<fcmToken>` (anahtarı ve bu cihazın push kaydını siler).

## 5. Mobil API (`{API_BASE_URL}` = `https://alanadi.com/api/mobil/v1`)

**Hata biçimi** (her uç noktada aynı):

```json
{ "error": { "code": "VALIDATION", "message": "Lütfen işaretli alanları kontrol edin.", "fields": { "consent": "Ön bilgilendirme formunu ve mesafeli satış sözleşmesini onaylayın." } } }
```

| Kod | HTTP | Anlamı |
| --- | --- | --- |
| `UNAUTHENTICATED` | 401 | Anahtar yok, geçersiz veya süresi dolmuş |
| `INVALID_CREDENTIALS` | 401 | Hatalı kullanıcı adı/şifre |
| `ACCOUNT_SUSPENDED`, `ADMIN_NOT_SUPPORTED`, `CENTER_NOT_SUPPORTED`, `PASSWORD_CHANGE_REQUIRED`, `FORBIDDEN` | 403 | Hesap durumu veya rol uygun değil |
| `NOT_FOUND` | 404 | Kayıt yok veya kullanıcıya ait değil |
| `EMAIL_TAKEN` | 409 | Bu e-postayla hesap var |
| `CLASSROOM_CLOSED` | 409 | Sınıf açık değil; varsa `opensAt` alanı da döner |
| `NOT_CONFIRMED` | 409 | Takvim yalnızca onaylı derste |
| `VALIDATION` | 422 | Alan hataları `fields` içinde |
| `RULE_VIOLATION` | 422 | İş kuralı (ör. “Bu saat az önce doldu”) — `message` olduğu gibi gösterilir |
| `TOO_MANY_ATTEMPTS` | 429 | Çok fazla deneme |
| `MAINTENANCE` | 503 | Site bakımda (kayıt ve randevu kapalı) |
| `INTERNAL` | 500 | Beklenmeyen hata |

Sayfalı listelerde `?sayfa=N` gönderilir; yanıttaki `nextPage` null ise son sayfadır.

### Oturum ve hesap

| İstek | Gövde | Yanıt |
| --- | --- | --- |
| `POST /oturum` | `{identifier, password, deviceName?}` | `{token, user: Me}` |
| `DELETE /oturum?cihaz=<fcmToken>` | — | 204 |
| `POST /kayit` | `{firstName, lastName, email, phone?, password, accountType: "PARENT"\|"STUDENT", kvkk: true, terms: true, marketing?, deviceName?}` | 201 `{token, user: Me}` |
| `POST /sifremi-unuttum` | `{email}` | `{message}` (bağlantı e-postayla gelir, web'de açılır) |
| `GET /ben` | — | `Me` |
| `PATCH /ben` | `{firstName?, lastName?, phone?, accountType?, cityId?, marketingConsent?}` (öğretmen yalnızca `phone`) | `Me` |
| `POST /ben/sifre` | `{currentPassword, newPassword}` (en az 8 karakter, harf ve rakam) | `{message}` |
| `POST /ben/silme-talebi` | `{reason?}` | 202 `{message}` |

`Me` örneği:

```json
{ "id": "cmv47…", "role": "STUDENT", "firstName": "Fatma", "lastName": "Demirtaş", "email": "veli@ornek.com", "username": null, "phone": "05321112233",
  "emailVerified": true, "mustChangePassword": false, "unreadNotifications": 3,
  "student": { "accountType": "PARENT", "city": { "id": 34, "name": "İstanbul" }, "marketingConsent": false },
  "teacher": null }
```

Öğretmende `student` null, `teacher` `{slug, status, verified, photoUrl}` olur.

### Herkese açık (anahtar gerekmez)

| İstek | Yanıt |
| --- | --- |
| `GET /katalog` | `{site, maintenance: {on, message}, rules (… , questionAnswerHours), levels: [{id, name, slug, group, grades: [{id, name}], subjectIds}], subjects, services, cities, sortOptions, timeOptions, pages: [{slug, title, url}], paymentReturnPrefix}` |
| `GET /iller/{ilId}/ilceler` | `{items: [{id, name, slug}]}` |
| `GET /ogretmenler?level=&subject=&service=&mode=online\|yuz-yuze&city=&district=&minPrice=&maxPrice=&rating=4&gender=kadin\|erkek&time=hafta-ici-gunduz\|hafta-ici-aksam\|hafta-sonu&verified=1&q=&sort=&page=` (kademe, ders, hizmet, il, ilçe **slug**; fiyatlar **TL**) | `{items: TeacherCard[], total, page, pageCount}` |
| `GET /ogretmenler/{slug}` (anahtar gönderilirse `isFavorite` dolu gelir) | `TeacherProfile` |
| `GET /ogretmenler/{slug}/saatler?duration=60&start=2026-10-14` | 7 günlük takvim |

`TeacherCard`:

```json
{ "userId": "cmv47…", "slug": "mehmet-demir", "name": "Mehmet D.", "headline": "Fizik öğretmeni ve YKS koçu", "photoUrl": "https://…/api/dosya/…",
  "ratingAvg": 5, "ratingCount": 2, "completedLessons": 2, "experienceYears": 8, "cityName": "Ankara", "offersOnline": true, "offersInPerson": false,
  "verified": true, "featured": false, "minHourlyPrice": 95000, "subjects": ["Fizik"], "avgResponseMinutes": 60 }
```

`TeacherProfile` (özet):

```json
{ "userId": "…", "slug": "ayse-yilmaz", "name": "Ayşe Y.", "headline": "…", "bio": "…", "photoUrl": null, "videoUrl": null, "education": "…",
  "experienceYears": 12, "gender": "FEMALE", "verified": true, "ratingAvg": 4.67, "ratingCount": 3, "completedLessons": 3, "avgResponseMinutes": 45,
  "offersOnline": true, "offersInPerson": true, "inPersonAtStudentHome": true, "inPersonAtTeacherPlace": false,
  "city": { "id": 34, "name": "İstanbul" }, "district": { "id": 444, "name": "Kadıköy" },
  "serviceDistricts": [{ "id": 444, "name": "Kadıköy", "cityId": 34, "cityName": "İstanbul" }],
  "offerings": [{ "id": "cmv47…", "level": { "id": 3, "name": "Ortaokul", "slug": "ortaokul" }, "subject": { "id": 5, "name": "Matematik", "slug": "matematik" },
    "service": { "id": 1, "name": "Özel Ders", "slug": "ozel-ders" }, "hourlyPrice": 80000,
    "durations": [{ "minutes": 45, "price": 60000 }, { "minutes": 60, "price": 80000 }, { "minutes": 90, "price": 120000 }],
    "questionPrice": null }],
  "reviews": [{ "id": "…", "rating": 5, "comment": "…", "studentName": "Hülya K.", "lesson": "Ortaokul Matematik", "teacherReply": null, "teacherRepliedAt": null, "createdAt": "…" }],
  "isFavorite": false }
```

`questionPrice` (kuruş): öğretmen bu derste fotoğrafla soru kabul ediyorsa soru başı ücret, etmiyorsa null. Profilde “Fotoğrafla soru sor” düğmesi yalnızca `questionPrice` dolu bir ders varsa görünür.

Saatler:

```json
{ "startDate": "2026-10-12", "durationMinutes": 60,
  "days": [{ "date": "2026-10-13", "weekday": "Sal", "day": "13 Eki",
    "slots": [{ "startAt": "2026-10-13T13:00:00.000Z", "endAt": "2026-10-13T14:00:00.000Z", "time": "16:00", "available": true }] }] }
```

### Randevular (anahtar gerekir)

| İstek | Gövde | Yanıt |
| --- | --- | --- |
| `GET /rezervasyonlar?kapsam=…&sayfa=` | veli: `yaklasan`, `gecmis`, `iptal` · öğretmen: `yaklasan`, `talepler`, `gecmis` | `{scope, items: BookingSummary[], nextPage}` |
| `POST /rezervasyonlar` (veli) | `{offeringId, startAt, durationMinutes, mode: "ONLINE"\|"IN_PERSON", learnerName, learnerGrade?, inPersonPlace?: "STUDENT_HOME"\|"TEACHER_PLACE", districtId?, address?, note?, consent: true}` | 201 `{booking: BookingDetail, payment}` |
| `GET /rezervasyonlar/{id}` | — | `BookingDetail` |
| `POST /rezervasyonlar/{id}/odeme` (veli) | — | `{payment}` |
| `POST /rezervasyonlar/{id}/iptal` | `{reason}` | `BookingDetail` |
| `POST /rezervasyonlar/{id}/sorun` (veli) | `{reason}` (en az 10 karakter) | `BookingDetail` |
| `POST /rezervasyonlar/{id}/degerlendirme` (veli) | `{rating: 1-5, comment?}` | `BookingDetail` |
| `POST /rezervasyonlar/{id}/onay` (öğretmen) | — | `BookingDetail` |
| `POST /rezervasyonlar/{id}/red` (öğretmen) | `{reason}` | `BookingDetail` |
| `POST /rezervasyonlar/soru` (veli) | multipart/form-data: `image` (sorunun fotoğrafı), `offeringId`, `learnerName`, `learnerGrade?`, `note?`, `consent=true` | 201 `{booking: BookingDetail, payment}` (ödeme bölüm 6 ile aynı) |
| `POST /rezervasyonlar/{id}/mesajlar` | multipart/form-data: `body?`, `image?`, `video?` (yalnızca öğretmen), `isSolution=true` (öğretmenin çözümü; soru “Tamamlandı” olur) | `BookingDetail` |
| `GET /rezervasyonlar/{id}/sinif` | — | `{url, opensAt, closesAt}` veya 409 `CLASSROOM_CLOSED` |
| `GET /rezervasyonlar/{id}/takvim` | — | `text/calendar` (.ics) |

`payment` = `{ "url": "https://…/api/mobil/v1/web-giris?t=…&next=…", "returnUrlPrefix": "https://…/odeme/sonuc/", "expiresAt": "…" }` (bölüm 6).

`BookingSummary` (öğretmende `amount` öğretmenin kazancıdır, `counterpart` veli olur):

```json
{ "id": "cmv47…", "code": "VD-ASWG3S", "status": "CONFIRMED", "statusLabel": "Onaylandı", "startAt": "…", "endAt": "…", "durationMinutes": 60,
  "levelName": "Lise", "subjectName": "Matematik", "serviceName": "Özel Ders", "mode": "ONLINE", "learnerName": "Deniz",
  "amount": 90000, "approvalDeadline": null, "isTest": false,
  "counterpart": { "name": "Ayşe Y.", "photoUrl": null, "teacherSlug": "ayse-yilmaz" } }
```

`BookingDetail` = `BookingSummary` alanları ve ek olarak:

```json
{ "learnerGrade": "8. Sınıf", "inPersonPlace": null, "note": null, "price": 90000, "refundedAmount": 0, "holdExpiresAt": null,
  "rejectionReason": null, "cancelReason": null, "disputeReason": null,
  "location": null,
  "classroom": { "opensAt": "…", "closesAt": "…", "open": false },
  "events": [{ "status": "PENDING_APPROVAL", "statusLabel": "Öğretmen onayı bekleniyor", "note": "Ödeme alındı", "createdAt": "…" }],
  "payments": [{ "id": "…", "provider": "paytr", "amount": 90000, "refundedAmount": 0, "status": "SUCCEEDED", "statusLabel": "Ödendi", "failureReason": null, "createdAt": "…",
    "refunds": [{ "amount": 45000, "status": "SUCCEEDED", "statusLabel": "İade edildi", "reason": "…", "createdAt": "…", "processedAt": "…" }] }],
  "review": null,
  "actions": { "canPay": false, "canJoin": false, "canCancel": true,
    "cancelPreview": { "refundAmount": 90000, "refundPercent": 100, "reason": null }, "canReview": false, "canDispute": false } }
```

Öğretmen görünümünde `payments`, `review` ve veli `actions` yerine şunlar gelir: `parent: {name, phone}` (telefon onaydan sonra), `teacherAmount`, `actions: {canJoin, canApprove, canReject, canCancel, canSolve, canMessage}`. Yüz yüze derste `location: {place, address, districtName, cityName}` (öğretmene onaydan sonra).

Her iki görünümde `createdAt` ve `question` alanı bulunur. `question` yalnızca fotoğrafla soruda (`mode: "QUESTION"`) doludur, diğer derslerde null:

```json
{ "answerDeadline": "…", "answeredAt": null, "threadOpen": true,
  "messages": [{ "id": "…", "mine": true, "fromTeacher": false, "authorName": "Fatma D.", "body": "Türev sorusu", "imageUrl": "https://…/api/dosya/…", "videoUrl": null, "isSolution": false, "createdAt": "…" }] }
```

Fotoğrafla soruda öğretmen onaylamaz (`canApprove` false): `canSolve` iken çözümü `isSolution=true` ile gönderir ya da reddeder (veliye tam iade). `canMessage` (veli ve öğretmen) yazışmanın açık olduğunu gösterir; video yalnızca öğretmen mesajında kabul edilir. `answerDeadline` geçerse soru süresi dolar ve ücret iade edilir.

### Favoriler, bildirimler, cihazlar

| İstek | Gövde | Yanıt |
| --- | --- | --- |
| `GET /favoriler` (veli) | — | `{items: [{userId, slug, name, headline, photoUrl, ratingAvg, ratingCount, verified, minHourlyPrice, subjects}]}` |
| `POST /favoriler/{teacherUserId}` · `DELETE /favoriler/{teacherUserId}` | — | `{isFavorite}` |
| `GET /bildirimler?sayfa=` | — | `{items: [{id, type, title, body, link, target, readAt, createdAt}], unread, nextPage}` |
| `POST /bildirimler/okundu` | `{ids?}` (yoksa hepsi) | `{unread}` |
| `POST /cihazlar` | `{token, platform: "android"\|"ios"}` | 201 |
| `DELETE /cihazlar/{token}` | — | 204 |

### Kurum (veli portalı)

| İstek | Gövde | Yanıt |
| --- | --- | --- |
| `GET /kurum` (veli) | — | `{items: [{id, relation, student: {firstName, lastName, gradeName, groups}, center: {name, phone, logoUrl}}]}` (`id` bağlantı kimliğidir) |
| `GET /kurum/{id}` | — | `{id, student, center, balance: {total, paid, remaining, overdue}, attendance: [{date, startMinute, subject, group, status}], etuds: [{id, date, startMinute, endMinute, subject, topic, teacher, status, attendance}], exams: [{examId, name, kind, date, net, correct, wrong, blank, rank, participants, sections: [{name, questionCount, net}]}], trend: [{name, date, net, average}], weakTopics: [{topic, section, rate, questions, teachersUrl}], installments: [{title, order, dueDate, amount, paidAmount, state}], payments: [{receiptNo, amount, method, paidAt}], announcements: [{id, title, body, group, createdAt}], notes: [{kind, text, author, createdAt}], homeworks: [{id, subject, title, description, assignedOn, dueDate, status, note}], questions: [{id, subject, note, imageUrl, status, answerText, answerImageUrl, answerVideoUrl, answeredBy, answeredAt, createdAt, mine}], questionSubjects: [string], schedule: [{weekday, startMinute, endMinute, subject, group, room, teacher}], hallDays: [{date, hall, periods, marks, present, marked}]}` |
| `DELETE /kurum/{id}` | — | 204; veli bu öğrenciyle bağlantısını kaldırır (kurumun kaydı silinmez) |
| `GET /kurum/{id}/calisma?hafta=YYYY-MM-DD` | — (haftanın herhangi bir günü; yoksa bu hafta) | `{weekStart, weekEnd, today, items: [{id, date, subject, topic, resource, targetQuestions, note, done}], resources: [{id, name, subject, publisher, topicCount, doneCount, completion, solved, accuracy, topics: [{topic, solved, correct, wrong, done, accuracy}]}], coaching: {coach, weekday, minute, sessions: [{id, date, coach, held, notes, priorityTopics, nextGoal}]}}` |
| `POST /kurum/{id}/calisma/{itemId}` | `{done}` | `{ok, done}`; çalışma programındaki maddeyi işaretler |
| `PUT /kurum/{id}/kaynaklar/{resourceId}` | `{rows: [{topic, solved, correct, wrong, done}]}` (`resourceId` = `resources[].id`) | `{ok: true}`; yalnızca kaynağın kendi konuları kaydedilir |
| `DELETE /kurum/{id}/sorular/{questionId}` | — | 204; cevaplanmamış ve bu hesabın sorduğu (`mine`) soru geri çekilir |
| `GET /kurum/{id}/deneme/{examId}` | — | `{exam, result: {net, correct, wrong, blank, score, rank, participants}, average, sections: [{name, questionCount, correct, wrong, blank, net, averageNet, topics: [{topic, questions, correct, rate}]}], weakTopics, trend}` |
| `POST /kurum/{id}/sorular` | multipart/form-data: `image` (fotoğraf, en fazla 8 MB), `subject`, `note?` | 201 `{id}`; öğrenci/veli fotoğrafla soru gönderir (soru durumu `OPEN`, `ANSWERED`, `IN_PERSON`) |
| `POST /kurum/davet` | `{token}` (davet bağlantısının son kısmı) | `{id}`; geçersiz/süresi dolmuş davette 422 `INVITE_INVALID` |

Çalışma salonunda `marks` periyot başına `G` (geldi), `Y` (gelmedi), `-` (işaretlenmedi) içerir; `completion` ve `accuracy` 0-1 arasıdır; koç görüşmelerinde `weekday` 1 = Pazartesi, `minute` gün başından dakikadır. Devam durumu `PRESENT` (Geldi), `ABSENT` (Gelmedi), `LATE` (Geç), `EXCUSED` (İzinli); taksit durumu `paid`, `partial`, `overdue`, `due`, `upcoming`; ödev durumu `PENDING` (kontrol edilmedi), `DONE`, `PARTIAL`, `MISSING`; `rate` 0-1 arası doğru oranıdır. Yalnızca kurumun yayınladığı denemeler döner. Kurum bildirimleri (`type` `center.` ile başlar) `link` olarak `/hesabim/kurum/<id>` taşır; uygulama bunu Kurumum → öğrenci ekranına yönlendirmelidir.

`target` uygulamada açılacak ekrandır: `{screen: "booking", id}`, `{screen: "requests"}`, `{screen: "reviews"}`, `{screen: "earnings"}`, `{screen: "teacher", id: slug}`, `{screen: "centerStudent", id}` (Kurumum → öğrenci), `{screen: "center"}` (Kurumum listesi) veya null.

### Öğretmen

| İstek | Gövde | Yanıt |
| --- | --- | --- |
| `GET /ogretmen/ozet` | — | `{profileStatus, checklist: [{key, label, done}], ratingAvg, ratingCount, completedLessons, balances: {pending, available, paid}, pendingRequests: BookingSummary[], upcoming: BookingSummary[]}` |
| `GET /ogretmen/kazanclar` | — | `{balances, payoutAccount: {legalName, ibanMasked} \| null, entries: [{id, bucket, bucketLabel, amount, description, bookingId, bookingCode, createdAt}], payouts: [{id, amount, method, reference, createdAt}]}` |
| `GET /ogretmen/takvim` | — | `{bufferMinutes, bufferOptions, rules: [{weekday, start, end}], exceptions: [{id, date, kind, start, end, note}]}` (`weekday` 1 = Pazartesi … 7 = Pazar, saatler `"HH:MM"`) |
| `PUT /ogretmen/takvim` | `{rules, bufferMinutes}` (şablonu tümüyle değiştirir) | takvim |
| `POST /ogretmen/izinler` | `{date: "YYYY-MM-DD", kind: "BLOCKED_DAY"\|"BLOCKED"\|"EXTRA", start?, end?, note?}` | 201 |
| `DELETE /ogretmen/izinler/{id}` | — | 204 |
| `GET /ogretmen/yorumlar` | — | `{items: [{id, rating, comment, studentName, lesson, status, teacherReply, teacherRepliedAt, createdAt}]}` |
| `POST /yorumlar/{id}/cevap` | `{reply}` (boş metin cevabı kaldırır) | `{ok: true}` |

## 6. Ödeme (PayTR, WebView)

1. `POST /rezervasyonlar` (veya `POST /rezervasyonlar/{id}/odeme`) yanıtındaki `payment.url` tam ekran WebView'da açılır. Bu tek kullanımlık bağlantı WebView'da oturum açar ve sitedeki güvenli ödeme sayfasını (PayTR 3D Secure formu) gösterir. Kart bilgisi uygulamada **hiçbir zaman** alınmaz veya saklanmaz.
2. WebView, `payment.returnUrlPrefix` ile başlayan bir adrese geçtiğinde WebView kapatılır. Hem `NavigationDelegate.onNavigationRequest` (tam sayfa geçişleri) hem `onUrlChange` (sitenin kendi içindeki geçişleri) dinlenmelidir.
3. “Ödemeniz kontrol ediliyor” ekranında `GET /rezervasyonlar/{id}` 3 saniyede bir (en çok 3 dakika) sorgulanır: `PENDING_APPROVAL` → başarı ekranı; hâlâ `PENDING_PAYMENT` ve son ödeme `FAILED` → hata mesajı (`failureReason`) + “Tekrar dene” (`POST …/odeme`); `EXPIRED` → “Yeni saat seç”.
4. Kullanıcı ödeme sayfasını geri tuşuyla kapatırsa aynı sorgulama yapılır; saat `expiresAt`'e kadar ayrılı kalır.
5. Bu dersler canlı ve birebir (person-to-person) hizmet olduğu için App Store kuralı 3.1.3(d) gereği uygulama içi satın alma (IAP) yerine PayTR kullanılabilir; mağaza incelemesine bu açıklama yazılmalıdır.

## 7. Sanal sınıf

- “Derse katıl” → `GET /rezervasyonlar/{id}/sinif` → dönen `url` **tam ekran WebView**'da açılır (5 dakika içinde kullanılmalı; her girişte yeni adres alınır). Sitedeki sınıf sayfası kamera, mikrofon, sohbet ve **ortak beyaz tahtayı** içerir; telefonda düğmeler simgeli ve tek satırdır.
- 409 `CLASSROOM_CLOSED` gelirse `message` gösterilir; `opensAt` varsa geri sayım yapılır.
- WebView ayarları: JavaScript açık, `mediaPlaybackRequiresUserGesture: false`, iOS'ta `allowsInlineMediaPlayback`, Android'de `onPermissionRequest` ile kamera/mikrofon izni (uygulama izinleri `permission_handler` ile önceden istenir; `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, Android `CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`). Ders boyunca ekran kapanmaz (`wakelock_plus`).
- Sınıftaki “Dersten çık” WebView'ı `/hesabim/derslerim/{id}` veya `/ogretmen-paneli/dersler/{id}` adresine götürür; uygulama bunu `onUrlChange` ile yakalayıp WebView'ı kapatır ve ders ayrıntısını yeniler. Geri tuşunda onay sorulur.
- Telefonda ekran paylaşımı yoktur (mobil tarayıcılar desteklemez); bilgisayardan katılan taraf paylaşabilir.

## 8. Bildirimler

- Firebase Cloud Messaging. Girişten sonra ve anahtar yenilendiğinde `POST /cihazlar`; çıkışta `DELETE /oturum?cihaz=…`.
- Sunucunun gönderdiği push'ta `notification.title/body` ve `data: {notificationId, type, link, screen, targetId}` bulunur; dokununca `screen`/`targetId`'ye göre ekran açılır (`booking` → ders ayrıntısı, `requests` → talepler, `earnings` → kazançlar, `reviews` → yorumlar, `teacher` → profil).
- Türler: yeni ders talebi (öğretmen), ders onaylandı/reddedildi, ödeme alındı / iade, 24 saat ve 1 saat kala hatırlatma, yeni yorum, hakediş.
- Derin bağlantı: `https://alanadi.com/hesabim/derslerim/{id}` ve `https://alanadi.com/ogretmen-paneli/dersler/{id}` adresleri uygulamada ders ayrıntısını açar (App Links / Universal Links).

## 9. Mağaza ve yasal

- KVKK aydınlatma metni, gizlilik politikası, kullanım şartları, mesafeli satış sözleşmesi uygulamadan erişilebilir olmalı (`katalog.pages` adresleri tarayıcıda açılır).
- Hesap silme talebi uygulama içinden yapılabilmeli (`POST /ben/silme-talebi`); mağaza formuna bu adım yazılır.
- Uygulama adı, ikon ve renkler sitedeki marka ile aynı; ekran görüntüleri Türkçe.

## 10. Teslim

- Çalışan kaynak kod ve `README` (kurulum, `API_BASE_URL`, Firebase dosyaları `google-services.json` / `GoogleService-Info.plist`, Android ve iOS derleme adımları).
- Birim testleri (modeller, para ve tarih biçimlendirme, hata eşleme) ve en az şu akış için entegrasyon testi (sahte API ile): giriş → öğretmen bul → saat seç → randevu → ödeme WebView'ının dönüşte kapanması → “ödemeniz kontrol ediliyor” → onay bekleniyor.
