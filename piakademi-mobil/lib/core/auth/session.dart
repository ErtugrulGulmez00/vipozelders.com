import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../api/pi_api.dart';
import '../models/me.dart';
import '../providers.dart';
import 'sides.dart';

enum SessionStatus { loading, signedOut, signedIn, offline }

@immutable
class SessionState {
  const SessionState({required this.status, this.me, this.notice, this.view = AppView.student});

  const SessionState.loading() : this(status: SessionStatus.loading);
  const SessionState.signedOut([String? notice]) : this(status: SessionStatus.signedOut, notice: notice);

  final SessionStatus status;
  final Me? me;

  /// Oturum kapanınca giriş ekranında gösterilecek açıklama (ör. süresi doldu).
  final String? notice;

  /// Gösterilen taraf (özel ders: veli/öğrenci ya da öğretmen; kurum: portal ya da personel paneli)
  final AppView view;

  bool get isSignedIn => status == SessionStatus.signedIn && me != null;
  bool get isTeacher => isSignedIn && me!.isTeacher;
  bool get isStudent => isSignedIn && me!.isStudent;
  bool get mustChangePassword => isSignedIn && me!.mustChangePassword;

  /// Personel kurum paneli (web görünümü) açık
  bool get inCenterPanel => isSignedIn && view == AppView.centerPanel;

  /// Veli / öğrenci kurum portalı açık
  bool get inPortal => isSignedIn && view == AppView.portal;

  /// Kullanıcı değişince görünüm hesabın açabildiği taraflara göre yeniden çözülür.
  SessionState copyWith({Me? me, AppView? view}) {
    final next = me ?? this.me;
    return SessionState(status: status, me: next, notice: notice, view: next == null ? (view ?? this.view) : resolveView(next, view ?? this.view));
  }
}

/// Oturumu açar, kapatır ve sunucunun oturum hatalarını (401, şifre değişikliği) dinler.
class SessionController extends Notifier<SessionState> {
  StreamSubscription<AuthEvent>? _events;

  PiApi get _api => ref.read(apiProvider);

  @override
  SessionState build() {
    _events?.cancel();
    _events = ref.read(apiClientProvider).events.listen(_onAuthEvent);
    ref.onDispose(() => _events?.cancel());
    Future.microtask(restore);
    return const SessionState.loading();
  }

  /// Açılışta kayıtlı anahtar varsa kullanıcıyı getirir.
  Future<void> restore() async {
    final tokens = ref.read(tokenStoreProvider);
    final token = await tokens.load();
    if (token == null || token.isEmpty) {
      state = const SessionState.signedOut();
      return;
    }
    if (state.status != SessionStatus.loading) state = const SessionState.loading();
    try {
      final me = await _api.me();
      final preferred = AppView.fromName(await tokens.viewPreference());
      state = SessionState(status: SessionStatus.signedIn, me: me, view: resolveView(me, preferred));
    } on ApiException catch (error) {
      if (error.isOffline || error.code == 'INTERNAL') {
        state = const SessionState(status: SessionStatus.offline);
      } else {
        await tokens.clear();
        state = SessionState.signedOut(error.isUnauthenticated ? null : error.message);
      }
    }
  }

  /// door: giriş kapısı (özel ders / kurum); o tarafı olmayan kendi tarafına geçer.
  Future<Me> login(String identifier, String password, {Side door = Side.ozel}) async {
    final result = await _api.login(identifier: identifier.trim(), password: password, deviceName: deviceName());
    return _signIn(result, viewForSide(result.me, door));
  }

  Future<Me> register({
    required String firstName,
    required String lastName,
    required String email,
    String? phone,
    required String password,
    required String accountType,
    required bool marketing,
    String? referralCode,
  }) async {
    final result = await _api.register(
      firstName: firstName,
      lastName: lastName,
      email: email,
      phone: phone,
      password: password,
      accountType: accountType,
      kvkk: true,
      terms: true,
      marketing: marketing,
      deviceName: deviceName(),
      referralCode: referralCode,
    );
    return _signIn(result, AppView.student);
  }

  Future<Me> _signIn(AuthResult result, AppView view) async {
    final tokens = ref.read(tokenStoreProvider);
    await tokens.save(result.token);
    final resolved = resolveView(result.me, view);
    await tokens.saveViewPreference(resolved.name);
    state = SessionState(status: SessionStatus.signedIn, me: result.me, view: resolved);
    return result.me;
  }

  /// "Diğer tarafa geç": hesap o tarafı açabiliyorsa görünüm değişir ve hatırlanır.
  Future<void> switchView(AppView view) async {
    final me = state.me;
    if (me == null || !availableViews(me).contains(view) || state.view == view) return;
    state = state.copyWith(view: view);
    await ref.read(tokenStoreProvider).saveViewPreference(view.name);
  }

  /// Kullanıcı bilgisini yeniler (okunmamış bildirim sayısı, şifre durumu vb.).
  Future<void> refreshMe() async {
    if (!state.isSignedIn) return;
    try {
      final me = await _api.me();
      state = state.copyWith(me: me);
    } on ApiException catch (_) {
      // Ağ hatası: mevcut bilgi korunur. 401 ise olay dinleyicisi çıkış yapar.
    }
  }

  void updateMe(Me me) {
    if (state.isSignedIn) state = state.copyWith(me: me);
  }

  /// Bildirim listesinden gelen okunmamış sayısı (o tarafın sayısı; iki taraflı hesapta taraf sayacı güncellenir).
  void setUnread(int unread) {
    final me = state.me;
    if (me == null) return;
    if (me.unreadKurum != null && me.unreadOzel != null) {
      final kurum = state.view.isKurum ? unread : me.unreadKurum!;
      final ozel = state.view.isKurum ? me.unreadOzel! : unread;
      if (kurum != me.unreadKurum || ozel != me.unreadOzel) {
        state = state.copyWith(me: me.copyWith(unreadKurum: kurum, unreadOzel: ozel, unreadNotifications: kurum + ozel));
      }
      return;
    }
    if (me.unreadNotifications != unread) state = state.copyWith(me: me.copyWith(unreadNotifications: unread));
  }

  void passwordChanged() {
    final me = state.me;
    if (me != null) state = state.copyWith(me: me.copyWith(mustChangePassword: false));
  }

  Future<void> logout({String? notice}) async {
    final tokens = ref.read(tokenStoreProvider);
    final pushToken = await tokens.pushToken();
    if (tokens.hasToken) {
      try {
        await _api.logout(pushToken: pushToken);
      } catch (_) {
        // Sunucuya ulaşılamasa da cihazdaki oturum kapatılır.
      }
    }
    await tokens.clear();
    await tokens.clearPushToken();
    await tokens.clearViewPreference();
    state = SessionState.signedOut(notice);
  }

  /// Sunucu oturumu geçersiz saydığında (cihazdaki anahtar silinir).
  Future<void> _expire(String notice) async {
    final tokens = ref.read(tokenStoreProvider);
    await tokens.clear();
    state = SessionState.signedOut(notice);
  }

  void _onAuthEvent(AuthEvent event) {
    switch (event) {
      case AuthEvent.unauthenticated:
        if (state.isSignedIn) _expire('Oturumunuzun süresi doldu. Lütfen yeniden giriş yapın.');
      case AuthEvent.passwordChangeRequired:
        final me = state.me;
        if (me != null && !me.mustChangePassword) state = state.copyWith(me: me.copyWith(mustChangePassword: true));
      case AuthEvent.accountBlocked:
        if (state.isSignedIn) _expire('Hesabınızla mobil uygulamaya giriş yapılamıyor. Destek ekibimizle iletişime geçin.');
    }
  }

  static String deviceName() {
    if (kIsWeb) return 'Pi Kampüs web önizleme';
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'Pi Kampüs Android';
      case TargetPlatform.iOS:
        return 'Pi Kampüs iOS';
      default:
        return 'Pi Kampüs uygulaması';
    }
  }
}
