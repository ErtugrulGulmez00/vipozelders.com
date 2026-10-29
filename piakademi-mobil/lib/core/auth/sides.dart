import '../models/me.dart';

// Tek hesap, iki taraf (sitedeki src/lib/sides.ts): kurum (etüt merkezi / dershane) ve özel ders.
// Kişi hangi kapıdan girerse o tarafı görür; o tarafta hiçbir şeyi yoksa kendi tarafına geçer.

/// Giriş kapısı: özel ders girişi ya da kurum girişi.
enum Side { ozel, kurum }

/// Uygulamanın gösterdiği taraf.
enum AppView {
  /// Özel ders: veli / öğrenci (Keşfet, Derslerim, Favoriler, Hesabım)
  student,

  /// Özel ders: öğretmen paneli
  teacher,

  /// Kurum: veli / öğrenci portalı (Kurumum)
  portal,

  /// Kurum: personel paneli (sitedeki /kurum, uygulamada web görünümüyle)
  centerPanel;

  bool get isKurum => this == portal || this == centerPanel;

  static AppView? fromName(String? name) => AppView.values.where((v) => v.name == name).firstOrNull;
}

/// Kurum tarafında açılacak görünüm (personel önce), yoksa null.
AppView? kurumView(Me me) {
  if (me.sides.staff) return AppView.centerPanel;
  if (me.sides.portal && me.isStudent) return AppView.portal;
  return null;
}

/// Özel ders tarafında açılacak görünüm, yoksa null (kurum personeli ve kurumun açtığı öğrenci hesabı).
AppView? privateView(Me me) {
  if (me.isCenter || !me.sides.ozel) return null;
  return me.isTeacher ? AppView.teacher : AppView.student;
}

/// Girilen kapıya göre açılacak görünüm: o tarafı yoksa diğer taraf.
AppView viewForSide(Me me, Side side) {
  final order = side == Side.kurum ? [kurumView(me), privateView(me)] : [privateView(me), kurumView(me)];
  return order.nonNulls.firstOrNull ?? (me.isTeacher ? AppView.teacher : (me.isCenter ? AppView.centerPanel : AppView.student));
}

/// Hesabın açabileceği görünümler.
Set<AppView> availableViews(Me me) => {
      ?privateView(me),
      if (me.sides.staff) AppView.centerPanel,
      if (me.sides.portal && me.isStudent) AppView.portal,
    };

/// Seçilmiş görünüm hâlâ açıksa o, değilse özel ders kapısının görünümü.
AppView resolveView(Me me, AppView? preferred) {
  if (preferred != null && availableViews(me).contains(preferred)) return preferred;
  return viewForSide(me, Side.ozel);
}

/// "Diğer tarafa geç" bağlantısı.
class SideSwitch {
  const SideSwitch(this.target, this.label);

  final AppView target;
  final String label;
}

/// Sitedeki sideSwitches ile aynı kurallar. Kurumun davet ettiği veliye özel dersi biz tanıtmayız:
/// portaldan özel derse geçiş yalnızca özel derste işlemi olana görünür.
List<SideSwitch> sideSwitches(Me me, AppView current) {
  final s = me.sides;
  return switch (current) {
    AppView.teacher => [if (s.staff) const SideSwitch(AppView.centerPanel, 'Kurum paneline geç')],
    AppView.student => [
        if (s.portal) const SideSwitch(AppView.portal, 'Kurum tarafına geç'),
        if (s.staff) const SideSwitch(AppView.centerPanel, 'Kurum paneline geç'),
      ],
    AppView.centerPanel => [
        if (me.isTeacher) const SideSwitch(AppView.teacher, 'Özel ders paneline geç'),
        if (me.isStudent && s.ozel) const SideSwitch(AppView.student, 'Özel ders tarafına geç'),
        if (me.isStudent && s.portal) const SideSwitch(AppView.portal, 'Veli / öğrenci portalı'),
      ],
    AppView.portal => [
        if (s.privateActivity && s.ozel) const SideSwitch(AppView.student, 'Özel ders tarafına geç'),
        if (s.staff) const SideSwitch(AppView.centerPanel, 'Kurum paneline geç'),
      ],
  };
}

/// Bildirim isteğindeki taraf: iki taraflı hesapta o tarafın bildirimleri gelir.
String sideParam(AppView view) => view.isKurum ? 'kurum' : 'ozel';

/// Görünümde gösterilecek okunmamış bildirim sayısı.
int unreadFor(Me me, AppView view) {
  if (me.unreadKurum == null || me.unreadOzel == null) return me.unreadNotifications;
  return view.isKurum ? me.unreadKurum! : me.unreadOzel!;
}
