import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pikampus/app.dart';
import 'package:pikampus/core/auth/token_store.dart';

import 'support/fake_api.dart';
import 'support/fixtures.dart';

Future<void> pumpApp(WidgetTester tester, FakeApi api, {MemoryKeyValueStore? store}) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 2.625;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(overrides: fakeOverrides(api, store: store), child: const PiKampusApp()));
  await tester.pumpAndSettle();
}

FakeApi studentApi() {
  final api = FakeApi()..withPublicData();
  api.json('GET', '/rezervasyonlar', {'scope': 'yaklasan', 'items': <Object>[], 'nextPage': null});
  api.json('GET', '/kurum', {'items': <Object>[]});
  api.json('GET', '/ben', meJson());
  return api;
}

void main() {
  testWidgets('misafir keşfet ekranını görür, giriş yapınca selamlanır ve oturum anahtarı saklanır', (tester) async {
    final api = studentApi();
    api.json('POST', '/oturum', {'token': 'tok-123', 'user': meJson()});
    final store = MemoryKeyValueStore();
    await pumpApp(tester, api, store: store);

    // Keşfet: misafir alt menüsü ve (aşağı kaydırınca) öne çıkan öğretmen
    expect(find.text('Giriş'), findsOneWidget);
    expect(find.text('Kurumum'), findsNothing);
    await tester.scrollUntilVisible(find.text('Ayşe Yılmaz'), 400, scrollable: find.byType(Scrollable).first);
    expect(find.text('Ayşe Yılmaz'), findsWidgets);
    expect(find.text('Öne çıkan öğretmenler'), findsOneWidget);

    // Hesabım (misafir) → Giriş yap
    await tester.tap(find.text('Giriş'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Giriş yap'));
    await tester.pumpAndSettle();
    expect(find.text('Şifremi unuttum'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextFormField, 'E-posta veya kullanıcı adı'), 'veli@ornek.com');
    await tester.enterText(find.widgetWithText(TextFormField, 'Şifre'), 'Veli12345');
    await tester.tap(find.widgetWithText(FilledButton, 'Giriş yap'));
    await tester.pumpAndSettle();

    // Keşfet'e dönülür (sekme kaydırma konumu korunduğu için başa kaydırılır)
    expect(find.text('Hesabım'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Merhaba Fatma 👋'), -400, scrollable: find.byType(Scrollable).first);
    expect(find.text('Merhaba Fatma 👋'), findsOneWidget);
    expect(store.values['pk_session_token'], 'tok-123');
    final login = api.calls('POST', '/oturum').single;
    expect(login.data, containsPair('identifier', 'veli@ornek.com'));
  });

  testWidgets('hatalı şifrede sunucunun Türkçe mesajı gösterilir', (tester) async {
    final api = studentApi();
    api.json('POST', '/oturum', {
      'error': {'code': 'INVALID_CREDENTIALS', 'message': 'Kullanıcı adı/e-posta veya şifre hatalı.'},
    }, status: 401);
    await pumpApp(tester, api);
    await tester.tap(find.text('Giriş'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Giriş yap'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'E-posta veya kullanıcı adı'), 'veli@ornek.com');
    await tester.enterText(find.widgetWithText(TextFormField, 'Şifre'), 'yanlis');
    await tester.tap(find.widgetWithText(FilledButton, 'Giriş yap'));
    await tester.pumpAndSettle();
    expect(find.text('Kullanıcı adı/e-posta veya şifre hatalı.'), findsOneWidget);
  });

  testWidgets('kurum personeli hesabı web paneline yönlendirilir', (tester) async {
    final api = studentApi();
    api.json('POST', '/oturum', {
      'error': {'code': 'CENTER_NOT_SUPPORTED', 'message': 'Kurum paneli hesabı mobil uygulamada henüz kullanılamıyor; web panelini kullanın.'},
    }, status: 403);
    await pumpApp(tester, api);
    await tester.tap(find.text('Giriş'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Giriş yap'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'E-posta veya kullanıcı adı'), 'kurum@ornek.com');
    await tester.enterText(find.widgetWithText(TextFormField, 'Şifre'), 'Kurum12345');
    await tester.tap(find.widgetWithText(FilledButton, 'Giriş yap'));
    await tester.pumpAndSettle();
    expect(find.text('Bu hesap web panelinde kullanılır'), findsOneWidget);
    expect(find.text('Web panelini aç'), findsOneWidget);
  });

  testWidgets('geçici şifreyle giren öğretmen önce şifresini değiştirir, sonra paneline geçer', (tester) async {
    final api = FakeApi()..withPublicData();
    api.json('GET', '/ben', meJson(role: 'TEACHER', mustChangePassword: true));
    api.json('POST', '/ben/sifre', {'message': 'Şifreniz değiştirildi. Diğer cihazlardaki oturumlarınız kapatıldı.'});
    api.json('GET', '/ogretmen/ozet', {
      'profileStatus': 'PUBLISHED',
      'checklist': <Object>[],
      'ratingAvg': 4.67,
      'ratingCount': 3,
      'completedLessons': 9,
      'balances': {'pending': 0, 'available': 0, 'paid': 0},
      'pendingRequests': <Object>[],
      'upcoming': <Object>[],
    });
    final store = MemoryKeyValueStore()..values['pk_session_token'] = 'tok-teacher';
    await pumpApp(tester, api, store: store);
    expect(find.text('Yeni şifrenizi belirleyin'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextFormField, 'Geçici şifre'), 'Gecici123');
    await tester.enterText(find.widgetWithText(TextFormField, 'Yeni şifre'), 'YeniSifre2026');
    await tester.enterText(find.widgetWithText(TextFormField, 'Yeni şifre (tekrar)'), 'YeniSifre2026');
    await tester.tap(find.widgetWithText(FilledButton, 'Şifreyi kaydet'));
    await tester.pumpAndSettle();

    expect(api.calls('POST', '/ben/sifre').single.data, {'currentPassword': 'Gecici123', 'newPassword': 'YeniSifre2026'});
    expect(find.text('Merhaba Ayşe'), findsOneWidget);
    expect(find.text('Talepler'), findsOneWidget);
  });

  testWidgets('süresi dolan oturumda anahtar silinir ve misafir görünümüne dönülür', (tester) async {
    final api = FakeApi()..withPublicData();
    api.json('GET', '/ben', {
      'error': {'code': 'UNAUTHENTICATED', 'message': 'Oturumunuzun süresi doldu. Lütfen yeniden giriş yapın.'},
    }, status: 401);
    final store = MemoryKeyValueStore()..values['pk_session_token'] = 'eski';
    await pumpApp(tester, api, store: store);
    expect(store.values.containsKey('pk_session_token'), isFalse);
    expect(find.text('Giriş'), findsOneWidget);
  });
}
