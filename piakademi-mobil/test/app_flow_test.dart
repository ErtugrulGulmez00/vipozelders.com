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

  testWidgets('kurum personeli kurum girişinden girer, kurum paneli açılır', (tester) async {
    final api = studentApi();
    final staff = meJson(role: 'CENTER', sides: {'kurum': true, 'ozel': false, 'staff': true, 'portal': false, 'privateActivity': false});
    api.json('POST', '/oturum', {'token': 'tok-kurum', 'user': staff});
    // Testte WebView yok: panel bağlantısı hata döner, ekran hata görünümüyle açılır
    api.json('POST', '/web-oturum', {
      'error': {'code': 'NOT_FOUND', 'message': 'Panel bağlantısı alınamadı.'},
    }, status: 404);
    final store = MemoryKeyValueStore();
    await pumpApp(tester, api, store: store);
    await tester.tap(find.text('Giriş'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Giriş yap'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Kurum girişi'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'E-posta veya kullanıcı adı'), 'kurum@ornek.com');
    await tester.enterText(find.widgetWithText(TextFormField, 'Şifre'), 'Kurum12345');
    await tester.tap(find.widgetWithText(FilledButton, 'Giriş yap'));
    await tester.pumpAndSettle();

    expect(find.text('Kurum paneli'), findsOneWidget);
    expect(find.text('Panel bağlantısı alınamadı.'), findsOneWidget);
    expect(api.calls('POST', '/web-oturum').first.data, {'path': '/kurum'});
    expect(store.values['pk_view'], 'centerPanel');
    // Özel ders alt menüsü yok
    expect(find.text('Keşfet'), findsNothing);
  });

  testWidgets('kurumun açtığı öğrenci hesabı yalnızca kurum tarafını görür; sekmeler pakete göre', (tester) async {
    final api = FakeApi()..withPublicData();
    api.json('GET', '/ben', meJson(sides: {'kurum': true, 'ozel': false, 'staff': false, 'portal': true, 'privateActivity': false}));
    api.json('GET', '/kurum', {'items': [centerLinkJson(studentAccount: true)]});
    api.json('GET', '/kurum/g1', centerChildJson(studentAccount: true));
    final store = MemoryKeyValueStore()..values['pk_session_token'] = 'tok-ogrenci';
    await pumpApp(tester, api, store: store);

    // Kurum portalı alt menüsü; tek bağlantıda doğrudan öğrencinin sayfası
    expect(find.text('Bilgilerim'), findsOneWidget);
    expect(find.text('Kurumum'), findsOneWidget);
    expect(find.text('Keşfet'), findsNothing);
    // Etüt Merkezi paketi, denemeler kapalı: Denemeler ve Ders programı sekmesi yok
    expect(find.text('Ödevler'), findsWidgets);
    expect(find.text('Denemeler'), findsNothing);
    expect(find.text('Ders programı'), findsNothing);

    // Hesap: özel ders tarafına geçiş ve başka öğrenci bağlama yok
    await tester.tap(find.text('Hesap'));
    await tester.pumpAndSettle();
    expect(find.text('Özel ders tarafına geç'), findsNothing);
    expect(find.text('Davet bağlantısıyla öğrenci bağla'), findsNothing);
  });

  testWidgets('iki taraflı veli özel ders tarafından kurum tarafına geçer ve geri döner', (tester) async {
    final api = studentApi();
    api.json('GET', '/ben', meJson(sides: {'kurum': true, 'ozel': true, 'staff': false, 'portal': true, 'privateActivity': true}));
    api.json('GET', '/kurum', {
      'items': [
        centerLinkJson(),
        {...centerLinkJson(), 'id': 'g2', 'student': {'firstName': 'Ece', 'lastName': 'Demirtaş', 'groups': <Object>[]}},
      ],
    });
    final store = MemoryKeyValueStore()..values['pk_session_token'] = 'tok-veli';
    await pumpApp(tester, api, store: store);

    // Varsayılan özel ders tarafı: Kurumum sekmesi yok
    expect(find.text('Keşfet'), findsOneWidget);
    expect(find.text('Kurumum'), findsNothing);
    await tester.tap(find.text('Hesabım'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Kurum tarafına geç'));
    await tester.pumpAndSettle();

    // Kurum portalı: iki öğrenci listelenir, tercih saklanır
    expect(find.text('Ali Demirtaş'), findsOneWidget);
    expect(find.text('Ece Demirtaş'), findsOneWidget);
    expect(find.text('Keşfet'), findsNothing);
    expect(store.values['pk_view'], 'portal');

    // Özel derste işlemi olduğu için "Özel ders tarafına geç" görünür
    await tester.tap(find.text('Hesap'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Özel ders tarafına geç'));
    await tester.pumpAndSettle();
    expect(find.text('Keşfet'), findsOneWidget);
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
