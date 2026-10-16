import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../api/pi_api.dart';
import '../models/me.dart';
import '../providers.dart';

enum SessionStatus { loading, signedOut, signedIn, offline }

@immutable
class SessionState {
  const SessionState({required this.status, this.me, this.notice});

  const SessionState.loading() : this(status: SessionStatus.loading);
  const SessionState.signedOut([String? notice]) : this(status: SessionStatus.signedOut, notice: notice);

  final SessionStatus status;
  final Me? me;

  /// Oturum kapanınca giriş ekranında gösterilecek açıklama (ör. süresi doldu).
  final String? notice;

  bool get isSignedIn => status == SessionStatus.signedIn && me != null;
  bool get isTeacher => isSignedIn && me!.isTeacher;
  bool get isStudent => isSignedIn && me!.isStudent;
  bool get mustChangePassword => isSignedIn && me!.mustChangePassword;

  SessionState copyWith({Me? me}) => SessionState(status: status, me: me ?? this.me, notice: notice);
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
      state = SessionState(status: SessionStatus.signedIn, me: me);
    } on ApiException catch (error) {
      if (error.isOffline || error.code == 'INTERNAL') {
        state = const SessionState(status: SessionStatus.offline);
      } else {
        await tokens.clear();
        state = SessionState.signedOut(error.isUnauthenticated ? null : error.message);
      }
    }
  }

  Future<Me> login(String identifier, String password) async {
    final result = await _api.login(identifier: identifier.trim(), password: password, deviceName: deviceName());
    return _signIn(result);
  }

  Future<Me> register({
    required String firstName,
    required String lastName,
    required String email,
    String? phone,
    required String password,
    required String accountType,
    required bool marketing,
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
    );
    return _signIn(result);
  }

  Future<Me> _signIn(AuthResult result) async {
    await ref.read(tokenStoreProvider).save(result.token);
    state = SessionState(status: SessionStatus.signedIn, me: result.me);
    return result.me;
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

  void setUnread(int unread) {
    final me = state.me;
    if (me != null && me.unreadNotifications != unread) state = state.copyWith(me: me.copyWith(unreadNotifications: unread));
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
