import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api.dart';

/// Uygulamanın gösterdiği taraf: koç paneli ya da öğrenci/veli ekranı.
enum KocView { coach, student }

/// Giriş yapan kullanıcı (GET /ben).
class Me {
  Me(this.json);

  final Json json;

  String get firstName => json.str('firstName');
  String get lastName => json.str('lastName');
  String get fullName => '$firstName $lastName';
  String? get email => json.strOrNull('email');
  String? get username => json.strOrNull('username');
  bool get mustChangePassword => json.flag('mustChangePassword');
  int get unreadNotifications => json.integer('unreadNotifications');
  bool get isCoach => json.obj('sides').flag('kocStaff');
  bool get isStudent => json.obj('sides').flag('kocStudent');
}

/// Oturum: anahtar güvenli depoda; açılışta /ben ile doğrulanır.
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
  static const _storage = FlutterSecureStorage();

  final ApiClient api;
  late final StreamSubscription<String> _sub;

  Me? me;
  bool ready = false;

  /// Hem koç hem öğrenci olan hesapta seçilen taraf
  KocView? chosenView;

  KocView? get view {
    final m = me;
    if (m == null) return null;
    if (m.isCoach && m.isStudent) return chosenView ?? KocView.coach;
    if (m.isCoach) return KocView.coach;
    if (m.isStudent) return KocView.student;
    return null;
  }

  Future<void> restore() async {
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

  Future<void> login(String identifier, String password) async {
    final res = await api.post('/oturum', {'identifier': identifier.trim(), 'password': password, 'deviceName': 'Pi Koç uygulaması'});
    api.token = res.str('token');
    await _storage.write(key: _tokenKey, value: api.token!);
    me = Me(res.obj('user'));
    chosenView = null;
    notifyListeners();
  }

  Future<void> refreshMe() async {
    me = Me(await api.get('/ben'));
    notifyListeners();
  }

  void switchView(KocView view) {
    chosenView = view;
    notifyListeners();
  }

  Future<void> logout() async {
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
