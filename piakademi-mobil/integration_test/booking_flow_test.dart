import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:pikampus/app.dart';

import '../test/support/fake_api.dart';
import '../test/support/fixtures.dart';

/// Sahte API ile uçtan uca randevu akışı (gerçek cihazda/emülatörde, gerçek WebView ile):
/// misafir → öğretmen profili → randevu al → giriş → saat seç → öde → ödeme sayfası dönüş adresine
/// gidince kapanır → "ödemeniz kontrol ediliyor" → öğretmen onayı bekleniyor.
///
/// `flutter test integration_test/booking_flow_test.dart -d <cihaz>`
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('giriş → öğretmen bul → saat seç → randevu → ödeme dönüşü → onay bekleniyor', (tester) async {
    final api = FakeApi()..withPublicData();
    api.json('GET', '/rezervasyonlar', {'scope': 'yaklasan', 'items': <Object>[], 'nextPage': null});
    api.json('GET', '/kurum', {'items': <Object>[]});
    api.json('GET', '/ben', meJson());
    api.json('POST', '/oturum', {'token': 'tok-entegrasyon', 'user': meJson()});

    // Ödeme sayfası yerine, açılınca sitenin ödeme sonucu adresine giden küçük bir sayfa.
    final paymentPage = Uri.dataFromString(
      '<html><body><p>Güvenli ödeme</p><script>setTimeout(function(){location.replace("$fakeBase/odeme/sonuc/b1")},300)</script></body></html>',
      mimeType: 'text/html',
      encoding: utf8,
    ).toString();
    api.on('POST', '/rezervasyonlar', (_) => FakeResponse({
          'booking': bookingDetailJson(status: 'PENDING_PAYMENT'),
          'payment': {'url': paymentPage, 'returnUrlPrefix': '$fakeBase/odeme/sonuc/', 'expiresAt': DateTime.now().toUtc().add(const Duration(minutes: 15)).toIso8601String()},
        }, status: 201));
    api.on('GET', '/rezervasyonlar/b1', (_) => FakeResponse(bookingDetailJson(status: 'PENDING_APPROVAL')));

    await tester.pumpWidget(ProviderScope(overrides: fakeOverrides(api), child: const PiKampusApp()));
    await tester.pumpAndSettle();

    // Keşfet → öne çıkan öğretmen → profil
    await tester.scrollUntilVisible(find.text('Ayşe Yılmaz'), 400, scrollable: find.byType(Scrollable).first);
    await tester.tap(find.text('Ayşe Yılmaz').first);
    await tester.pumpAndSettle();
    expect(find.text('Onaylı öğretmen'), findsOneWidget);
    await tester.tap(find.text('Randevu al'));
    await tester.pumpAndSettle();

    // Misafir → giriş ekranı → giriş sonrası randevu ekranına dönülür
    await tester.enterText(find.widgetWithText(TextFormField, 'E-posta veya kullanıcı adı'), 'veli@ornek.com');
    await tester.enterText(find.widgetWithText(TextFormField, 'Şifre'), 'Veli12345');
    await tester.tap(find.widgetWithText(FilledButton, 'Giriş yap'));
    await tester.pumpAndSettle();
    expect(find.text('Randevu al'), findsOneWidget);

    // Boş saat (yarın 11:00), öğrenci adı, sözleşme onayı
    await tester.tap(find.text('11:00'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Seçilen:'), findsOneWidget);
    final learner = find.widgetWithText(TextField, 'Öğrencinin adı');
    await tester.dragUntilVisible(learner, find.byType(ListView).first, const Offset(0, -250));
    await tester.enterText(learner, 'Ali');
    await tester.pumpAndSettle();
    await tester.dragUntilVisible(find.byType(CheckboxListTile), find.byType(ListView).first, const Offset(0, -300));
    await tester.tap(find.byType(CheckboxListTile));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Ödemeye geç'));

    // Ödeme sayfası (WebView) açılır, dönüş adresinde kapanır, sonuç sorgulanır
    var done = false;
    for (var i = 0; i < 60 && !done; i++) {
      await tester.pump(const Duration(milliseconds: 500));
      done = find.text('Ödemeniz alındı').evaluate().isNotEmpty;
    }
    expect(done, isTrue, reason: 'Ödeme sonucu ekranı açılmadı');
    expect(find.text('Dersime git'), findsOneWidget);

    final request = api.calls('POST', '/rezervasyonlar').single.data as Map;
    expect(request['offeringId'], 'o1');
    expect(request['durationMinutes'], 60);
    expect(request['mode'], 'ONLINE');
    expect(request['learnerName'], 'Ali');
    expect(request['consent'], isTrue);
    expect(api.calls('GET', '/rezervasyonlar/b1'), isNotEmpty);
  });
}
