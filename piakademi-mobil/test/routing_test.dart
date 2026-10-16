import 'package:flutter_test/flutter_test.dart';
import 'package:pikampus/core/deep_links.dart';
import 'package:pikampus/core/router/app_router.dart';
import 'package:pikampus/features/center/invite_screen.dart';

void main() {
  group('sitenin adresleri uygulama ekranlarına çevrilir', () {
    test('ders, kurum, öğretmen paneli', () {
      expect(mapWebPath(Uri.parse('/hesabim/derslerim/cmv47abc')), '/ders/cmv47abc');
      expect(mapWebPath(Uri.parse('/ogretmen-paneli/dersler/cmv47abc')), '/ders/cmv47abc');
      expect(mapWebPath(Uri.parse('/odeme/sonuc/cmv47abc')), '/ders/cmv47abc');
      expect(mapWebPath(Uri.parse('/hesabim/kurum/g1')), '/kurum/g1');
      expect(mapWebPath(Uri.parse('/hesabim/kurum/g1/deneme/e1')), '/kurum/g1/deneme/e1');
      expect(mapWebPath(Uri.parse('/hesabim/kurum')), '/kurumum');
      expect(mapWebPath(Uri.parse('/ogretmen-paneli/talepler')), '/panel/talepler');
      expect(mapWebPath(Uri.parse('/ogretmen-paneli')), '/panel');
      expect(mapWebPath(Uri.parse('/ozel-ders/lgs/matematik')), '/ogretmenler?level=lgs&subject=matematik');
      expect(mapWebPath(Uri.parse('/ogretmen/ayse-yilmaz')), isNull);
      expect(mapWebPath(Uri.parse('/kesfet')), isNull);
    });

    test('pikampus:// ve site bağlantıları', () {
      expect(DeepLinks.locationFor(Uri.parse('pikampus://kurum-davet/AbC_123-xyzLongToken')), '/kurum-davet/AbC_123-xyzLongToken');
      expect(DeepLinks.locationFor(Uri.parse('pikampus://ogretmen/ayse-yilmaz')), '/ogretmen/ayse-yilmaz');
      expect(DeepLinks.locationFor(Uri.parse('pikampus://hesabim/derslerim/b1')), '/ders/b1');
      expect(DeepLinks.locationFor(Uri.parse('https://pikampus.com/kurum-davet/tok_123456789')), '/kurum-davet/tok_123456789');
      expect(DeepLinks.locationFor(Uri.parse('https://baska-site.com/ogretmen/x')), isNull);
      expect(DeepLinks.locationFor(Uri.parse('https://pikampus.com/yonetim')), isNull);
    });
  });

  test('bildirim hedefleri', () {
    expect(routeForTarget('booking', 'b1'), '/ders/b1');
    expect(routeForTarget('requests', null), '/panel/talepler');
    expect(routeForTarget('centerStudent', 'g1'), '/kurum/g1');
    expect(routeForTarget('teacher', 'ayse-yilmaz'), '/ogretmen/ayse-yilmaz');
    expect(routeForTarget('bilinmeyen', null), '/bildirimler');
  });

  test('giriş gerektiren sayfalar', () {
    expect(Routes.needsAuth('/ders/b1'), isTrue);
    expect(Routes.needsAuth('/ogretmen/ayse-yilmaz/randevu'), isTrue);
    expect(Routes.needsAuth('/ogretmen/ayse-yilmaz/soru'), isTrue);
    expect(Routes.needsAuth('/kurum-davet/x'), isTrue);
    expect(Routes.needsAuth('/ogretmen/ayse-yilmaz'), isFalse);
    expect(Routes.needsAuth('/ogretmenler'), isFalse);
    expect(Routes.needsAuth('/kesfet'), isFalse);
  });

  test('kurum davet kodu', () {
    expect(inviteTokenFrom('https://pikampus.com/kurum-davet/AbCdEf_123-456789'), 'AbCdEf_123-456789');
    expect(inviteTokenFrom('  AbCdEf_123-456789  '), 'AbCdEf_123-456789');
    expect(inviteTokenFrom('kısa'), isNull);
    expect(inviteTokenFrom(''), isNull);
  });

  test('öğretmen arama ölçütleri adrese yazılır ve geri okunur', () {
    const query = TeacherQuery(level: 'lgs', mode: 'online', minPrice: 500, verified: true, q: 'Ayşe', sort: 'puan');
    final restored = TeacherQuery.fromUri(query.toUri());
    expect(restored, query);
    expect(restored.activeFilters, 4);
    expect(query.toQuery(page: 2)['verified'], '1');
    expect(query.clearFilters().activeFilters, 0);
    expect(query.clearFilters().q, 'Ayşe');
    expect(query.copyWith(level: null).level, isNull);
    expect(query.copyWith(subject: 'matematik').level, 'lgs');
  });
}
