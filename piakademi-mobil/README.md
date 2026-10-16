# Pi Kampüs mobil uygulaması (Flutter)

Pi Kampüs web sitesinin Android ve iOS uygulaması. Uygulama yalnızca sitenin mobil API'sini (`/api/mobil/v1`) kullanan bir istemcidir: fiyat, komisyon, iade, uygunluk gibi hiçbir iş kuralı uygulamada hesaplanmaz, ekranlarda hangi düğmenin görüneceğine sunucunun döndürdüğü `actions` alanı karar verir. API sözleşmesi: [../docs/flutter-uygulama-promptu.md](../docs/flutter-uygulama-promptu.md).

## Neler var?

- **Veli / öğrenci:** keşfet, öğretmen arama ve filtreler, öğretmen profili (tanıtım videosu, yorumlar, favori), saat seçip randevu, PayTR ödemesi (sitenin güvenli ödeme sayfası uygulama içinde açılır), derslerim, ders ayrıntısı (iptal ve iade önizlemesi, değerlendirme, sorun bildirme, takvime ekleme), sanal sınıf, **fotoğrafla soru** (kamera/galeri, çözüm ve yazışma), favoriler, bildirimler, profil, şifre, hesap silme talebi.
- **Kurumum (veli portalı):** kurum davet bağlantısıyla bağlanma; özet, devam ve etüt, çalışma salonu, çalışma programı ve kaynak ilerlemesi, koçluk görüşmeleri, denemeler (net grafiği, karne), ödemeler, ödevler, kuruma fotoğrafla soru, ders programı, duyurular.
- **Öğretmen:** özet, talepler (onay/red), fotoğrafla soruya çözüm gönderme, dersler, haftalık müsaitlik ve izinler, kazançlar, yorumlara cevap.
- **Ortak:** push bildirimleri (Firebase), bildirime dokununca ilgili ekran, site bağlantılarının uygulamada açılması, çevrimdışı uyarısı, bakım modu uyarısı.

Yönetici ve kurum personeli hesapları uygulamaya giremez (sunucu `ADMIN_NOT_SUPPORTED` / `CENTER_NOT_SUPPORTED` döner); uygulama bu durumda web panelini açan bir düğme gösterir.

## Gereksinimler

- Flutter 3.41 veya üstü (Dart 3.11)
- Android: Android SDK (compileSdk 36, minSdk 24 = Android 7.0), JDK 17. Android Studio kurmak en kolayıdır.
- iOS: macOS, Xcode 16+, CocoaPods (iOS 15 ve üstü). iOS derlemesi Windows'ta yapılamaz.

```bash
flutter pub get
flutter doctor        # eksikleri gösterir
```

## Çalıştırma

### Canlı siteyle

```bash
flutter run
```

Adres verilmezse uygulama `https://pikampus.com/api/mobil/v1` adresini kullanır.

### Bilgisayardaki geliştirme sitesiyle (Android emülatör veya USB'li telefon)

Web projesinde `npm run db` ve `npm run dev` açıkken:

```bash
adb reverse tcp:3000 tcp:3000
flutter run --dart-define=API_BASE_URL=http://localhost:3000/api/mobil/v1
```

`adb reverse`, cihazın `localhost:3000` adresini bilgisayara yönlendirir. Sunucunun ürettiği ödeme ve sanal sınıf bağlantıları da `APP_URL` (`http://localhost:3000`) ile başladığı için `10.0.2.2` yerine bu yöntem önerilir. Şifresiz `http` yalnızca debug derlemesinde açıktır (`android/app/src/debug/AndroidManifest.xml`).

Demo hesaplar web projesinin README'sindedir (ör. veli `veli@demo.vipozelders.local` / `Veli12345`, öğretmen `ayse.yilmaz` / `Ogretmen123`). Demo veli, demo kurumdaki öğrenciye bağlıdır (Hesabım → Kurumum).

## Derleme ayarları (`--dart-define`)

| Ad | Açıklama |
| --- | --- |
| `API_BASE_URL` | Mobil API adresi. Varsayılan `https://pikampus.com/api/mobil/v1`. Sitenin kök adresi de buradan çıkarılır. |
| `FIREBASE_API_KEY`, `FIREBASE_SENDER_ID`, `FIREBASE_PROJECT_ID` | Push bildirimleri. Boşsa uygulama bildirimsiz çalışır. |
| `FIREBASE_APP_ID_ANDROID`, `FIREBASE_APP_ID_IOS` | Firebase'deki Android ve iOS uygulama kimlikleri. |

Ayarları bir dosyada tutmak için `config/canli.json` gibi bir dosya oluşturup (Git'e eklemeyin) `--dart-define-from-file=config/canli.json` kullanabilirsiniz:

```json
{
  "API_BASE_URL": "https://pikampus.com/api/mobil/v1",
  "FIREBASE_API_KEY": "…",
  "FIREBASE_SENDER_ID": "…",
  "FIREBASE_PROJECT_ID": "…",
  "FIREBASE_APP_ID_ANDROID": "1:…:android:…",
  "FIREBASE_APP_ID_IOS": "1:…:ios:…"
}
```

## Push bildirimleri (Firebase)

1. [Firebase konsolunda](https://console.firebase.google.com) bir proje açın; Android uygulaması (`com.pikampus.app`) ve iOS uygulaması (`com.pikampus.app`) ekleyin.
2. İndirilen `google-services.json` / `GoogleService-Info.plist` dosyalarını projeye koymanız gerekmez; içlerindeki değerleri yukarıdaki `--dart-define` ayarlarına yazın (`api_key` / `API_KEY`, `project_number` / `GCM_SENDER_ID`, `project_id`, `mobilesdk_app_id` / `GOOGLE_APP_ID`).
3. Sunucu tarafı: Firebase → Proje ayarları → Hizmet hesapları → yeni özel anahtar. JSON dosyasını sunucuya koyup web projesinin `.env` dosyasında `FCM_SERVICE_ACCOUNT_FILE` ile gösterin.
4. iOS: Apple Developer'da bir APNs anahtarı (.p8) oluşturup Firebase → Cloud Messaging'e yükleyin; Xcode'da Runner hedefine **Push Notifications** yeteneğini ekleyin (Background Modes → Remote notifications zaten açık).

Android bildirim kanalı `pikampus_genel`, bildirim simgesi `@drawable/ic_stat_pikampus`. Bildirimin `data` alanındaki `screen` / `targetId` ile ilgili ekran açılır.

## Android sürüm derlemesi

```bash
flutter build apk --release                 # telefona doğrudan kurulacak APK
flutter build appbundle --release           # Google Play için .aab
```

Çıktılar: `build/app/outputs/flutter-apk/app-release.apk`, `build/app/outputs/bundle/release/app-release.aab`.

**İmza:** `android/key.properties` yoksa sürüm derlemesi debug anahtarıyla imzalanır; bu yalnızca deneme içindir, Play Store kabul etmez. Mağaza için bir kez yükleme anahtarı oluşturun ve **yedekleyin**:

```bash
keytool -genkey -v -keystore pikampus-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

`android/key.properties`:

```properties
storePassword=…
keyPassword=…
keyAlias=upload
storeFile=C:/yol/pikampus-upload.jks
```

`key.properties`, `*.jks` ve `*.keystore` Git'e eklenmez (`android/.gitignore`). Play Console'da “Play Uygulama İmzalama” açık kalsın; yükleme anahtarı kaybolursa Google'dan sıfırlanabilir.

Sürüm numarası `pubspec.yaml` içindeki `version: 1.0.0+1` satırıdır (`+` sonrası her yüklemede artmalı).

## iOS derlemesi (macOS)

```bash
cd ios && pod install && cd ..
open ios/Runner.xcworkspace     # Signing & Capabilities: Team seçin, Bundle ID com.pikampus.app
flutter build ipa --release --dart-define-from-file=config/canli.json
```

Kamera, mikrofon ve fotoğraf izin metinleri `ios/Runner/Info.plist` içindedir.

## Site bağlantılarının uygulamada açılması

- `pikampus://kurum-davet/<kod>`, `pikampus://ders/<id>` gibi bağlantılar her zaman çalışır.
- `https://pikampus.com/kurum-davet/…`, `/ogretmen/…`, `/hesabim/derslerim/…`, `/hesabim/kurum…`, `/ogretmen-paneli/dersler/…` bağlantıları doğrulama yapılınca tarayıcı yerine uygulamada açılır:
  - **Android:** web sunucusunun `.env` dosyasına `ANDROID_APP_SHA256` olarak imza sertifikasının SHA-256 parmak izini yazın (Play'den dağıtımda Play Console → Uygulama bütünlüğü → Uygulama imzalama anahtarı; elle kurulan APK için `keytool -list -v -keystore pikampus-upload.jks`). Birden fazlaysa virgülle ayırın. Site `/.well-known/assetlinks.json` adresini kendisi üretir.
  - **iOS:** `.env` dosyasına `IOS_APP_ID=<TeamID>.com.pikampus.app` yazın (site `/.well-known/apple-app-site-association` üretir) ve Xcode'da **Associated Domains** yeteneğine `applinks:pikampus.com` ekleyin.
- Yol listesi değişirse `android/app/src/main/AndroidManifest.xml` ile web projesindeki `src/lib/mobile-app.ts` birlikte güncellenir.

## Site sayfaları uygulamanın içinde

Ödeme, sanal sınıf ve yasal metinler sitenin sayfalarıdır ve WebView'da açılır. Uygulama user-agent'a `PiKampusApp/1.0` ekler; site bunu görünce üst menüyü, alt bilgiyi ve çerez uyarısını gizler (`pk-app` sınıfı). Ödeme için sunucunun verdiği tek kullanımlık `web-giris` bağlantısı WebView'da oturum açar; adres `returnUrlPrefix` ile başlayınca WebView kapanır ve randevu 3 saniyede bir sorgulanır. Kart bilgisi uygulamaya hiç gelmez.

## Simge ve açılış ekranı

Kaynak görseller `assets/branding/` içindedir. Değiştirdikten sonra:

```bash
dart run flutter_launcher_icons
dart run flutter_native_splash:create
```

## Testler

```bash
flutter analyze
flutter test                                              # birim ve ekran akışı testleri (sahte API)
flutter test integration_test/booking_flow_test.dart -d <cihaz>   # emülatörde/telefonda randevu → ödeme akışı
```

- `test/format_test.dart`, `test/models_test.dart`: para, tarih (Europe/Istanbul) biçimleri ve JSON modelleri
- `test/routing_test.dart`: site adreslerinin ve bildirim hedeflerinin uygulama ekranlarına eşlenmesi
- `test/app_flow_test.dart`: giriş, hatalı şifre, kurum hesabı uyarısı, zorunlu şifre değişikliği, süresi dolan oturum
- `integration_test/booking_flow_test.dart`: misafir → öğretmen profili → giriş → saat seçimi → ödeme WebView'ı → “Ödemeniz alındı”
- Sahte API: `test/support/fake_api.dart` (Dio adaptörü), örnek veriler `test/support/fixtures.dart`

Sunucu tarafındaki uçlar web projesinde `e2e/mobile-api.spec.ts` ve `e2e/mobile-api-extra.spec.ts` ile test edilir.

## Klasör yapısı

```text
lib/main.dart, lib/app.dart   giriş noktası, tema, yönlendirici
lib/core/api/                 Dio istemcisi (Bearer, hata eşleme), PiApi uç noktaları
lib/core/auth/                oturum (Riverpod) ve güvenli anahtar deposu
lib/core/models/              API modelleri
lib/core/router/              go_router ekranları, yönlendirmeler, site adresi → ekran eşlemesi
lib/core/push/                Firebase ve yerel bildirimler
lib/core/format/              para (kuruş → ₺), tarih ve metin biçimleri
lib/core/widgets/             ortak bileşenler (kartlar, durumlar, WebView, medya, fotoğraf seçici)
lib/features/<özellik>/       ekranlar: auth, explore, teachers, booking, lessons, classroom, center, teacher, account …
assets/branding, assets/fonts simge, açılış görselleri, Plus Jakarta Sans (OFL)
```

## Mağaza notları

- Dersler canlı ve birebir hizmet olduğu için App Store kuralı 3.1.3(d) gereği uygulama içi satın alma yerine PayTR kullanılır; incelemeye bu açıklama yazılmalıdır.
- Hesap silme talebi uygulama içinden yapılabilir (Hesabım → Hesabımı sil); mağaza formlarına bu adım yazılır.
- Yasal metinler (KVKK, gizlilik, kullanım şartları, mesafeli satış) uygulamadan açılabilir.
