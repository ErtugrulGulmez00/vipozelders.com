import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'push.dart';

/// Giriş kapısı (sitedeki gibi tek hesap, üç kapı): özel ders, kurum, Pi Koç.
enum Door { ozel, kurum, koc }

extension DoorLabel on Door {
  String get label => switch (this) {
        Door.ozel => 'Özel ders',
        Door.kurum => 'Kurum',
        Door.koc => 'Pi Koç',
      };
}

/// Uygulamanın gösterdiği taraf.
enum AppView {
  /// Pi Koç koç paneli (uygulamanın kendi ekranları)
  coach,

  /// Pi Koç öğrencisi / velisi (uygulamanın kendi ekranları)
  kocStudent,

  /// Özel ders öğretmeni
  teacher,

  /// Özel ders velisi / öğrencisi (Hesabım)
  parent,

  /// Kurum personeli (kurum paneli)
  kurumStaff,

  /// Kurumun veli / öğrenci portalı
  kurumPortal,
}

extension AppViewInfo on AppView {
  Door get door => switch (this) {
        AppView.coach || AppView.kocStudent => Door.koc,
        AppView.teacher || AppView.parent => Door.ozel,
        AppView.kurumStaff || AppView.kurumPortal => Door.kurum,
      };

  String get label => switch (this) {
        AppView.coach => 'Pi Koç · koç paneli',
        AppView.kocStudent => 'Pi Koç · öğrenci / veli',
        AppView.teacher => 'Özel ders · öğretmen paneli',
        AppView.parent => 'Özel ders · veli / öğrenci',
        AppView.kurumStaff => 'Kurum paneli',
        AppView.kurumPortal => 'Kurum · veli / öğrenci portalı',
      };
}

/// Giriş yapan kullanıcı (GET /ben).
class Me {
  Me(this.json);

  final Json json;

  String get firstName => json.str('firstName');
  String get lastName => json.str('lastName');
  String get fullName => '$firstName $lastName';
  String? get email => json.strOrNull('email');
  String? get username => json.strOrNull('username');
  String get role => json.str('role');
  bool get mustChangePassword => json.flag('mustChangePassword');
  int get unreadNotifications => json.integer('unreadNotifications');
  Json get _sides => json.obj('sides');
  bool get isCoach => _sides.flag('kocStaff');
  bool get isStudent => _sides.flag('kocStudent');

  /// Kapının bu hesapta açtığı taraflar (sitedeki kapı kuralı: src/lib/sides.ts)
  List<AppView> viewsFor(Door door) => switch (door) {
        Door.ozel => [
            if (role == 'TEACHER') AppView.teacher,
            if (role == 'STUDENT' && _sides.flag('ozel')) AppView.parent,
          ],
        Door.kurum => [
            if (_sides.flag('staff')) AppView.kurumStaff,
            if (role == 'STUDENT' && _sides.flag('portal')) AppView.kurumPortal,
          ],
        Door.koc => [
            if (_sides.flag('kocStaff')) AppView.coach,
            if (_sides.flag('kocStudent')) AppView.kocStudent,
          ],
      };

  /// Hesabın uygulamada açabildiği bütün taraflar
  List<AppView> get views => [for (final d in Door.values) ...viewsFor(d)];
}

/// Oturum: anahtar güvenli depoda; açılışta /ben ile doğrulanır. Seçilen taraf cihazda hatırlanır.
class Session extends ChangeNotifier {
  Session(this.api) {
    _sub = api.events.stream.listen((code) {
      if (code == 'UNAUTHENTICATED' || code == 'ACCOUNT_SUSPENDED') {
        _clear();
      } else if (code == 'PASSWORD_CHANGE_REQUIRED' && me != null) {
        me!.json['mustChangePassword'] = true;
        notifyListeners();
      }
    });
  }

  static const _tokenKey = 'pikoc_token';
  static const _viewKey = 'pk_view';
  static const _doorKey = 'pk_door';
  static const _storage = FlutterSecureStorage();

  final ApiClient api;
  late final StreamSubscription<String> _sub;

  Me? me;
  bool ready = false;
  AppView? chosenView;

  /// Son kullanılan giriş kapısı (giriş ekranında seçili gelir)
  Door lastDoor = Door.koc;

  AppView? get view {
    final m = me;
    if (m == null) return null;
    final views = m.views;
    if (views.isEmpty) return null;
    return chosenView != null && views.contains(chosenView) ? chosenView : views.first;
  }

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    chosenView = AppView.values.where((v) => v.name == prefs.getString(_viewKey)).firstOrNull;
    lastDoor = Door.values.where((d) => d.name == prefs.getString(_doorKey)).firstOrNull ?? Door.koc;
    try {
      api.token = await _storage.read(key: _tokenKey);
    } catch (_) {
      api.token = null;
    }
    if (api.token != null) {
      try {
        me = Me(await api.get('/ben'));
      } on ApiException catch (e) {
        if (!e.isOffline) await _clear(notify: false);
      }
    }
    ready = true;
    notifyListeners();
  }

  /// Kapıdan giriş: hesabın o kapıda tarafı yoksa oturum açılmaz, hangi kapıdan girileceği söylenir.
  Future<void> login(String identifier, String password, Door door) async {
    final res = await api.post('/oturum', {'identifier': identifier.trim(), 'password': password, 'deviceName': 'Pi Kampüs uygulaması'});
    api.token = res.str('token');
    final user = Me(res.obj('user'));
    final views = user.viewsFor(door);
    if (views.isEmpty) {
      final other = Door.values.where((d) => d != door && user.viewsFor(d).isNotEmpty).map((d) => '“${d.label}”').toList();
      try {
        await api.delete('/oturum');
      } catch (_) {}
      api.token = null;
      throw ApiException(
        'WRONG_DOOR',
        user.role == 'ADMIN'
            ? 'Yönetici hesabı uygulamada açılmaz; lütfen siteyi kullanın.'
            : 'Bu hesapla ${door.label} tarafında kaydınız yok.${other.isEmpty ? '' : ' Hesabınız ${other.join(' ya da ')} tarafında: üstten o kapıyı seçin.'}',
      );
    }
    await _storage.write(key: _tokenKey, value: api.token!);
    me = user;
    lastDoor = door;
    await _saveView(views.first);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_doorKey, door.name);
    notifyListeners();
  }

  Future<void> refreshMe() async {
    me = Me(await api.get('/ben'));
    notifyListeners();
  }

  Future<void> switchView(AppView view) async {
    await _saveView(view);
    notifyListeners();
  }

  Future<void> _saveView(AppView view) async {
    chosenView = view;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_viewKey, view.name);
  }

  Future<void> logout() async {
    await PushService.instance.unregister(this);
    try {
      await api.delete('/oturum');
    } catch (_) {
      // Sunucuya ulaşılamasa da cihazdaki oturum kapanır
    }
    await _clear();
  }

  Future<void> _clear({bool notify = true}) async {
    api.token = null;
    me = null;
    try {
      await _storage.delete(key: _tokenKey);
    } catch (_) {}
    if (notify) notifyListeners();
  }

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}

/// Oturuma ağaçtan erişim: `SessionScope.of(context)`.
class SessionScope extends InheritedNotifier<Session> {
  const SessionScope({super.key, required Session session, required super.child}) : super(notifier: session);

  static Session of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<SessionScope>()!.notifier!;

  /// Yeniden çizim tetiklemeden (işlem içinde) erişim
  static Session read(BuildContext context) => context.getInheritedWidgetOfExactType<SessionScope>()!.notifier!;
}
