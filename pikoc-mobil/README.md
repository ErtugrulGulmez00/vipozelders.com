# Pi Koç mobil uygulaması

Bireysel koçluk (Pi Koç) için ayrı Flutter uygulaması. Pi Kampüs uygulamasından (`../piakademi-mobil`) bağımsızdır;
aynı hesaplar ve aynı mobil API (`/api/mobil/v1`, Pi Koç uç noktaları `/koc/...`) kullanılır.

- **Öğrenci / veli:** bugünkü görevler, çalışma sayacı (uygulama kapansa da sayar), soru ve süre girişi,
  haftalık program ve koç notları, denemeler ve hedef, bildirimler.
- **Koç:** öğrenci listesi (uyarılarla), öğrenci sayfası (özet, program, kayıtlar, denemeler). Program yazma,
  deneme PDF aktarımı, tahsilat ve veli raporu sitede (`/koc`).
- **Online görüşme:** sitedeki görüşme odasıyla aynı LiveKit odası; uygulama odaya kendisi bağlanır. Ön/arka kamera,
  Android'de ekran paylaşımı (MediaProjection + ön plan hizmeti). iOS'ta ekran paylaşımı için Broadcast Extension gerekir (yok).

## Geliştirme

```bash
flutter pub get
flutter analyze && flutter test
# Yerel sunucuya karşı (emülatörde): adb reverse tcp:3100 tcp:3100
flutter run --dart-define=API_BASE_URL=http://localhost:3100/api/mobil/v1
```

Varsayılan sunucu `https://pikampus.com/api/mobil/v1`. Mağaza imzası `android/key.properties` ile (Git'e eklenmez);
yoksa sürüm APK'sı hata ayıklama anahtarıyla imzalanır (yalnızca elden kurulum için).

Paket kimliği: `com.pikampus.pikoc`. Bildirim (push) henüz yok: Firebase projesi açılınca eklenecek.
