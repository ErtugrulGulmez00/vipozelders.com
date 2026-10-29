import 'package:flutter_test/flutter_test.dart';
import 'package:pikampus/core/auth/sides.dart';
import 'package:pikampus/core/models/me.dart';

import 'support/fixtures.dart';

Me me({String role = 'STUDENT', bool kurum = false, bool ozel = true, bool staff = false, bool portal = false, bool privateActivity = false}) =>
    Me.fromJson(meJson(role: role, sides: {'kurum': kurum, 'ozel': ozel, 'staff': staff, 'portal': portal, 'privateActivity': privateActivity}));

List<String> labels(Me m, AppView view) => sideSwitches(m, view).map((s) => s.label).toList();

void main() {
  // Sitedeki tests/sides.test.ts ile aynı durumlar
  test('kapıya göre açılış: kurum kapısı kurum tarafını, özel ders kapısı özel dersi açar', () {
    final parent = me(kurum: true, portal: true, privateActivity: true);
    expect(viewForSide(parent, Side.kurum), AppView.portal);
    expect(viewForSide(parent, Side.ozel), AppView.student);

    final teacherStaff = me(role: 'TEACHER', kurum: true, staff: true, privateActivity: true);
    expect(viewForSide(teacherStaff, Side.kurum), AppView.centerPanel);
    expect(viewForSide(teacherStaff, Side.ozel), AppView.teacher);
  });

  test('o tarafta hesabı olmayan kendi tarafına geçer', () {
    // Kurumu olmayan veli kurum kapısından girerse özel ders
    expect(viewForSide(me(), Side.kurum), AppView.student);
    // Yalnızca kurum personeli özel ders kapısından girerse kurum paneli
    expect(viewForSide(me(role: 'CENTER', ozel: false, kurum: true, staff: true), Side.ozel), AppView.centerPanel);
    // Kurumun açtığı öğrenci hesabında özel ders tarafı yok
    expect(viewForSide(me(ozel: false, kurum: true, portal: true), Side.ozel), AppView.portal);
  });

  test('kaydedilen taraf artık açık değilse özel ders kapısına göre çözülür', () {
    final parent = me(kurum: true, portal: true);
    expect(resolveView(parent, AppView.portal), AppView.portal);
    // Kurum bağlantısı kaldırıldı
    expect(resolveView(me(), AppView.portal), AppView.student);
    expect(resolveView(me(role: 'TEACHER'), AppView.centerPanel), AppView.teacher);
  });

  test('taraf geçiş bağlantıları', () {
    final parent = me(kurum: true, portal: true);
    expect(labels(parent, AppView.student), ['Kurum tarafına geç']);
    // Kurumun davet ettiği veliye özel ders tanıtılmaz: işlemi yoksa portaldan geçiş görünmez
    expect(labels(parent, AppView.portal), isEmpty);
    expect(labels(me(kurum: true, portal: true, privateActivity: true), AppView.portal), ['Özel ders tarafına geç']);

    final teacherStaff = me(role: 'TEACHER', kurum: true, staff: true, privateActivity: true);
    expect(labels(teacherStaff, AppView.teacher), ['Kurum paneline geç']);
    expect(labels(teacherStaff, AppView.centerPanel), ['Özel ders paneline geç']);

    // Kurum personeli olan veli
    final parentStaff = me(kurum: true, staff: true, portal: true);
    expect(labels(parentStaff, AppView.centerPanel), ['Özel ders tarafına geç', 'Veli / öğrenci portalı']);
    expect(labels(me(role: 'CENTER', ozel: false, kurum: true, staff: true), AppView.centerPanel), isEmpty);
  });

  test('iki taraflı hesapta okunmamış bildirim taraf başına', () {
    final json = meJson(sides: {'kurum': true, 'ozel': true, 'staff': false, 'portal': true, 'privateActivity': true})..['unreadBySide'] = {'kurum': 3, 'ozel': 1};
    final both = Me.fromJson(json);
    expect(unreadFor(both, AppView.portal), 3);
    expect(unreadFor(both, AppView.student), 1);
    expect(sideParam(AppView.centerPanel), 'kurum');
    // Tek taraflı hesapta toplam
    expect(unreadFor(me(), AppView.student), 2);
  });
}
