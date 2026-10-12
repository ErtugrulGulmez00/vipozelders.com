# VIP Özel Ders mobil uygulaması (Flutter) için prompt

Aşağıdaki metnin tamamını Flutter uygulamasını yazacak yapay zekâya veya geliştiriciye verin. Uygulamanın konuşacağı mobil API (bölüm 5) henüz web projesinde yok; önce o eklenmeli (VIP Özel Ders Next.js projesine `/api/mobil/v1` olarak).

---

## Görev

“VIP Özel Ders” adlı Türk özel ders platformunun **Flutter** ile iOS ve Android mobil uygulamasını yaz. Web sitesi ve tüm iş kuralları hazır (Next.js + PostgreSQL); uygulama yalnızca aşağıdaki JSON API'yi kullanan bir istemcidir, iş kuralı (fiyat, komisyon, iade, uygunluk) uygulamada hesaplanmaz, hep sunucudan gelir. Arayüz tamamen **Türkçe**, saatler **Europe/Istanbul**, para birimi **TL** (sunucu tutarları kuruş cinsinden tam sayı gönderir: 125050 → “₺1.250,50”).

## 1. Ürün özeti

- **Veli / öğrenci** öğretmen arar (kademe, ders, hizmet türü, online/yüz yüze, il/ilçe, fiyat, puan), öğretmen profilini ve boş saatlerini görür, saat seçip randevu alır, kartla öder (PayTR), öğretmen onaylayınca derse sanal sınıftan katılır, ders sonrası puan/yorum bırakır.
- **Öğretmen** (hesabı yönetici açar) gelen talepleri onaylar/reddeder, derslerini görür, sanal sınıfa katılır, haftalık müsaitliğini ve izinlerini düzenler, kazançlarını görür, yorumlara cevap verir.
- **Yönetici** paneli mobilde YOK (yalnızca web).
- Kademeler: Okul Öncesi, İlkokul, Ortaokul, Lise, LGS, YKS… (sunucudan dinamik gelir). Hizmetler: Özel Ders, Soru Çözüm, Koçluk.
- Randevu durumları ve Türkçe etiketleri: `PENDING_PAYMENT` Ödeme bekleniyor · `PAYMENT_FAILED` Ödeme başarısız · `PENDING_APPROVAL` Öğretmen onayı bekleniyor · `CONFIRMED` Onaylandı · `COMPLETED` Tamamlandı · `REJECTED` Reddedildi · `EXPIRED` Süresi doldu · `CANCELLED_BY_STUDENT` Öğrenci iptal etti · `CANCELLED_BY_TEACHER` Öğretmen iptal etti · `CANCELLED_BY_ADMIN` Yönetici iptal etti · `NO_SHOW_STUDENT` Öğrenci katılmadı · `NO_SHOW_TEACHER` Öğretmen katılmadı · `DISPUTED` İtiraz inceleniyor.

## 2. Teknik tercihler

- Flutter (güncel kararlı sürüm), Dart null safety; **Riverpod** (durum), **go_router** (yönlendirme + derin bağlantı), **dio** (HTTP, `Authorization: Bearer` ekleyen interceptor, 401'de girişe dönüş), **freezed + json_serializable** (modeller), **flutter_secure_storage** (oturum anahtarı), **intl** (tr_TR tarih/para biçimi), **webview_flutter** (ödeme ve sanal sınıf), **firebase_messaging** (bildirim), **cached_network_image**.
- Klasör yapısı: `lib/core` (api, tema, yönlendirme, hata), `lib/features/<ozellik>/{data,domain,presentation}`.
- Tema: ana renk indigo `#4F46E5` (koyu `#312E81`, en koyu `#1E1B4B`), vurgu altın `#FBBF24`, yazı tipi Plus Jakarta Sans; açık tema öncelikli, karanlık tema desteği.
- Her ekranda yükleniyor / boş / hata durumları; çevrimdışıyken anlaşılır uyarı; tüm API hataları sunucunun döndürdüğü Türkçe `message` ile gösterilir.
- Erişilebilirlik: büyük dokunma alanları, ekran okuyucu etiketleri, sistem yazı boyutuna uyum.

## 3. Ekranlar

**Ortak:** açılış (oturum kontrolü) → giriş (e-posta veya kullanıcı adı + şifre; gerekiyorsa 6 haneli iki adımlı doğrulama kodu) → kayıt (veli/öğrenci; KVKK ve kullanım şartları onayı zorunlu, metinler sunucudan) → şifremi unuttum → ilk girişte şifre değiştirme zorunluluğu (`mustChangePassword`) → bildirimler → hesap ayarları (profil, şifre, **hesabı silme talebi**, çıkış).

**Veli / öğrenci (alt menü: Keşfet · Derslerim · Favoriler · Hesabım):**

1. Keşfet: arama kutusu, kademe kısayolları, öne çıkan öğretmenler.
2. Öğretmen listesi: filtre sayfası (kademe, ders, hizmet, online/yüz yüze, il/ilçe, fiyat aralığı, puan, cinsiyet, onaylı öğretmen) ve sıralama; sonsuz kaydırma.
3. Öğretmen profili: fotoğraf, onaylı rozeti, puan, deneyim, hakkında, tanıtım videosu (YouTube), ders ve ücret listesi, yorumlar, favori düğmesi, “Randevu al”.
4. Randevu: ders/hizmet seçimi → süre (30/45/60/90 dk, öğretmenin sunduğu) → online/yüz yüze (yüz yüzede ilçe, adres) → gün şeridi + boş saatler (dolu saatler gri) → ders kimin için (öğrenci adı, sınıfı), not → özet ve tutar (“KDV dahil, öğretmen onaylamazsa tamamı iade”) → ödeme.
5. Ödeme: sunucunun verdiği PayTR adresi WebView'da açılır (bölüm 6). Dönüşte “Ödemeniz kontrol ediliyor” ekranı randevu durumunu birkaç saniyede bir sorgular.
6. Derslerim: yaklaşan / geçmiş sekmeleri; ders kartında durum etiketi.
7. Ders ayrıntısı: bilgiler, ödeme ve iadeler, durum geçmişi, “Derse katıl” (yalnızca sunucu `canJoin: true` dediğinde; sınıf 10 dk önce açılır), takvime ekle, iptal (sunucunun hesapladığı iade tutarını gösterip onay ister), sorun bildir, değerlendirme (1–5 yıldız + yorum; yalnızca `canReview: true` iken).
8. Favoriler.

**Öğretmen (alt menü: Özet · Talepler · Derslerim · Takvim · Hesabım):**

1. Özet: bekleyen talep sayısı, yaklaşan dersler, puan, bakiye.
2. Talepler: her talepte kalan yanıt süresi; Onayla / Reddet (gerekçe seçimi).
3. Derslerim ve ders ayrıntısı (veli telefonu ve adres yalnızca onaydan sonra), “Derse katıl”, dersi iptal.
4. Takvim: haftalık müsaitlik aralıkları (gün başına birden çok aralık), izin/ek saat ekleme, dersler arası tampon süre.
5. Kazançlar: bekleyen / ödenebilir / ödenen; IBAN bilgisi.
6. Yorumlar: yorumlara herkese açık cevap.

## 4. Kimlik doğrulama

- `POST /oturum` başarılıysa uzun ömürlü bir **mobil oturum anahtarı** döner; `flutter_secure_storage`'da saklanır ve her istekte `Authorization: Bearer <anahtar>` olarak gönderilir.
- Yanıt `twoFactorRequired: true` ise kod ekranı açılır ve `POST /oturum/dogrulama` ile tamamlanır.
- 401 yanıtında anahtar silinir, giriş ekranına dönülür. Çıkışta `DELETE /oturum` çağrılır.

## 5. Mobil API sözleşmesi (`https://ALAN-ADI/api/mobil/v1`)

Tüm yanıtlar JSON; hata biçimi `{ "error": { "code": "...", "message": "Türkçe açıklama", "fields": { "alan": "hata" } } }`. Tarihler ISO 8601 (UTC), tutarlar kuruş. Sayfalı listeler `{ "items": [...], "nextCursor": "..." }`.

| Yöntem ve yol | Açıklama |
| --- | --- |
| `POST /oturum` | `{identifier, password, deviceName}` → `{token, user}` veya `{twoFactorRequired, challenge}` |
| `POST /oturum/dogrulama` | `{challenge, code}` → `{token, user}` |
| `DELETE /oturum` | Çıkış |
| `POST /kayit` | Veli/öğrenci kaydı → `{token, user}` |
| `POST /sifremi-unuttum` | E-postaya sıfırlama bağlantısı |
| `GET /ben` · `PATCH /ben` | Kullanıcı, rol, okunmamış bildirim sayısı; profil güncelleme |
| `POST /ben/sifre` | Şifre değiştirme |
| `POST /ben/silme-talebi` | Hesap silme talebi (App Store / Google Play zorunluluğu) |
| `GET /katalog` | Kademeler, dersler, hizmet türleri, iller, site ayarları (iptal kuralları, sınıf açılış süresi) |
| `GET /iller/{id}/ilceler` | İlçeler |
| `GET /ogretmenler` | Filtre ve sıralama parametreleriyle liste |
| `GET /ogretmenler/{slug}` | Profil, dersler/ücretler, yorumlar |
| `GET /ogretmenler/{id}/saatler?sure=60&baslangic=2026-10-14&gun=7` | Boş/dolu saatler |
| `POST /rezervasyonlar` | `{offeringId, startAt, durationMinutes, mode, districtId?, address?, learnerName, learnerGrade?, note?}` → `{booking, payment: {paymentUrl, returnUrlPrefix}}` |
| `GET /rezervasyonlar?kapsam=yaklasan\|gecmis` | Kendi randevuları (veli veya öğretmen) |
| `GET /rezervasyonlar/{id}` | Ayrıntı + `canJoin`, `canCancel`, `cancelPreview`, `canReview`, `canDispute` |
| `POST /rezervasyonlar/{id}/odeme` | Ödemeyi yeniden dene → yeni `paymentUrl` |
| `POST /rezervasyonlar/{id}/iptal` | `{reason}` |
| `POST /rezervasyonlar/{id}/sorun` | `{reason}` (ders sonrası itiraz) |
| `POST /rezervasyonlar/{id}/degerlendirme` | `{rating, comment}` |
| `POST /rezervasyonlar/{id}/onay` · `POST /rezervasyonlar/{id}/red` | Öğretmen: onay / `{reason}` ile red |
| `GET /rezervasyonlar/{id}/sinif` | Sanal sınıf için tek kullanımlık giriş adresi `{classroomUrl, expiresAt}` |
| `GET /rezervasyonlar/{id}/takvim.ics` | Takvim dosyası |
| `GET /favoriler` · `POST /favoriler/{teacherId}` · `DELETE /favoriler/{teacherId}` | Favoriler |
| `GET /bildirimler` · `POST /bildirimler/okundu` | Bildirimler |
| `POST /cihazlar` · `DELETE /cihazlar/{token}` | `{fcmToken, platform}` push kaydı |
| `GET /ogretmen/ozet` · `GET /ogretmen/kazanclar` | Öğretmen özeti ve kazançları |
| `GET /ogretmen/takvim` · `PUT /ogretmen/takvim` | Haftalık müsaitlik ve tampon süre |
| `POST /ogretmen/izinler` · `DELETE /ogretmen/izinler/{id}` | İzin / ek saat |
| `POST /yorumlar/{id}/cevap` | Öğretmenin yoruma cevabı |

## 6. Ödeme (PayTR)

- `paymentUrl`, PayTR'nin 3D Secure ödeme formunu açan bir adrestir; WebView'da tam ekran açılır. Kart bilgisi uygulamada **hiçbir zaman** alınmaz veya saklanmaz.
- WebView, `returnUrlPrefix` ile başlayan bir adrese yönlendiğinde kapatılır ve “Ödemeniz kontrol ediliyor” ekranında `GET /rezervasyonlar/{id}` her 3 saniyede bir (en çok 3 dakika) sorgulanır: `PENDING_APPROVAL` → başarı, `PENDING_PAYMENT` + başarısız ödeme → “Tekrar dene”, `EXPIRED` → “Yeni saat seç”.
- Bu dersler canlı ve birebir (person-to-person) hizmet olduğu için App Store kuralı 3.1.3(d) gereği uygulama içi satın alma (IAP) yerine PayTR kullanılabilir; mağaza incelemesine bu açıklama yazılmalıdır.

## 7. Sanal sınıf

- İlk sürümde “Derse katıl”, `GET /rezervasyonlar/{id}/sinif` adresini **tam ekran WebView**'da açar. Sitedeki sınıf sayfası kamera, mikrofon, sohbet ve **ortak beyaz tahtayı** (Excalidraw) zaten içerir; böylece mobil ve web aynı sınıfta buluşur.
- WebView ayarları: JavaScript açık, medya otomatik oynatma, kamera/mikrofon izni (Android `onPermissionRequest`, iOS `NSCameraUsageDescription` / `NSMicrophoneUsageDescription`, WKWebView `allowsInlineMediaPlayback`); ekran kapanmasını engelle (wakelock); “Dersten çık” sınıfın kendi düğmesiyle veya geri tuşuyla onay sorarak.
- Telefonda ekran paylaşımı yok (tarayıcı desteklemiyor); bilgisayardan katılan öğretmen ekran paylaşabilir.
- İleride performans için LiveKit Flutter SDK'ya (`livekit_client`) geçilebilir; o zaman beyaz tahta yine WebView'da kalır.

## 8. Bildirimler

- Firebase Cloud Messaging; girişten sonra `POST /cihazlar`.
- Türler: yeni ders talebi (öğretmen), ders onaylandı/reddedildi, ödeme alındı/iade, 24 saat ve 1 saat kala hatırlatma, yeni yorum. Bildirime dokununca ilgili ekran açılır (`vipozelders://ders/{id}` ve `https://ALAN-ADI/hesabim/derslerim/{id}` derin bağlantıları).

## 9. Mağaza ve yasal

- KVKK aydınlatma metni, gizlilik politikası ve kullanım şartları uygulamadan erişilebilir olmalı (`/sayfa/...` adresleri WebView veya tarayıcıda).
- Uygulama içinden hesap silme talebi zorunlu.
- Uygulama adı, ikon ve renkler sitedeki marka ile aynı; ekran görüntüleri Türkçe.

## 10. Teslim

- Çalışan kaynak kod, `README` (kurulum, ortam değişkeni olarak API adresi: `--dart-define=API_BASE_URL=...`), Android ve iOS derleme talimatı.
- Birim testleri (modeller, para/tarih biçimlendirme, durum etiketleri) ve en az giriş → öğretmen bul → randevu → ödeme dönüşü akışı için widget/integration testi (API sahte sunucuyla).
