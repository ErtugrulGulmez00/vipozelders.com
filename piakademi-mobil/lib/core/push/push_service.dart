import 'dart:async';
import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/session.dart';
import '../config.dart';
import '../providers.dart';
import '../router/app_router.dart';

/// Uygulama kapalıyken gelen mesajlar (FCM bildirimi kendisi gösterir; burada iş yok).
@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage message) async {}

final pushServiceProvider = Provider<PushService>((ref) {
  final service = PushService(ref);
  ref.onDispose(service.dispose);
  return service;
});

/// Push bildirimleri (Firebase Cloud Messaging). Firebase ayarı yoksa yalnızca uygulamaya
/// dönüldüğünde okunmamış bildirim sayısı yenilenir.
class PushService {
  PushService(this._ref);

  static const channelId = 'pikampus_genel';
  static bool _firebaseReady = false;

  final Ref _ref;
  final _local = FlutterLocalNotificationsPlugin();
  final _subscriptions = <StreamSubscription<Object?>>[];
  AppLifecycleListener? _lifecycle;
  ProviderSubscription<SessionState>? _sessionSub;
  bool _started = false;

  static bool get available => _firebaseReady;

  /// main() içinde çağrılır.
  static Future<void> initializeFirebase() async {
    if (kIsWeb || !AppConfig.pushConfigured) return;
    final appId = defaultTargetPlatform == TargetPlatform.iOS ? AppConfig.firebaseAppIdIos : AppConfig.firebaseAppIdAndroid;
    if (appId.isEmpty) return;
    try {
      await Firebase.initializeApp(
        options: FirebaseOptions(
          apiKey: AppConfig.firebaseApiKey,
          appId: appId,
          messagingSenderId: AppConfig.firebaseSenderId,
          projectId: AppConfig.firebaseProjectId,
        ),
      );
      FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);
      _firebaseReady = true;
    } catch (error) {
      debugPrint('Firebase başlatılamadı: $error');
    }
  }

  void start() {
    if (_started) return;
    _started = true;

    // Uygulamaya dönülünce okunmamış sayısı ve kullanıcı bilgisi yenilenir.
    _lifecycle = AppLifecycleListener(onResume: () => _ref.read(sessionProvider.notifier).refreshMe());

    if (!_firebaseReady) return;
    unawaited(_startMessaging());
  }

  Future<void> _startMessaging() async {
    try {
      await _local.initialize(
        settings: const InitializationSettings(
          android: AndroidInitializationSettings('@drawable/ic_stat_pikampus'),
          iOS: DarwinInitializationSettings(requestAlertPermission: false, requestBadgePermission: false, requestSoundPermission: false),
        ),
        onDidReceiveNotificationResponse: (response) => _openPayload(response.payload),
      );
      final android = _local.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      await android?.createNotificationChannel(
        const AndroidNotificationChannel(channelId, 'Pi Kampüs bildirimleri', description: 'Ders talepleri, onaylar, hatırlatmalar ve kurum bildirimleri', importance: Importance.high),
      );

      final messaging = FirebaseMessaging.instance;
      await messaging.setForegroundNotificationPresentationOptions(alert: false, badge: true, sound: false);

      _subscriptions.add(FirebaseMessaging.onMessage.listen(_onForegroundMessage));
      _subscriptions.add(FirebaseMessaging.onMessageOpenedApp.listen(_openMessage));
      // Sunucu FCM HTTP v1 "token" hedeflemesi kullanır; bu yüzden kayıt anahtarı (registration token) alınır.
      // ignore: deprecated_member_use
      _subscriptions.add(messaging.onTokenRefresh.listen((token) => _register(token)));

      final initial = await messaging.getInitialMessage();
      if (initial != null) _openMessage(initial);

      // Oturum açılınca izin istenir ve cihaz kaydedilir.
      _sessionSub = _ref.listen<SessionState>(sessionProvider, (previous, next) {
        if (next.isSignedIn && previous?.me?.id != next.me?.id) unawaited(_registerCurrent());
      }, fireImmediately: true);
    } catch (error) {
      debugPrint('Push bildirimleri başlatılamadı: $error');
    }
  }

  Future<void> _registerCurrent() async {
    try {
      final settings = await FirebaseMessaging.instance.requestPermission();
      if (settings.authorizationStatus == AuthorizationStatus.denied) return;
      // ignore: deprecated_member_use
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await _register(token);
    } catch (error) {
      debugPrint('Push kaydı yapılamadı: $error');
    }
  }

  Future<void> _register(String token) async {
    final session = _ref.read(sessionProvider);
    if (!session.isSignedIn) return;
    final platform = defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android';
    try {
      await _ref.read(apiProvider).registerDevice(token, platform);
      await _ref.read(tokenStoreProvider).savePushToken(token);
    } catch (error) {
      debugPrint('Cihaz kaydedilemedi: $error');
    }
  }

  void _onForegroundMessage(RemoteMessage message) {
    _ref.read(sessionProvider.notifier).refreshMe();
    final notification = message.notification;
    if (notification == null) return;
    _local.show(
      id: message.hashCode & 0x7fffffff,
      title: notification.title,
      body: notification.body,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(channelId, 'Pi Kampüs bildirimleri', importance: Importance.high, priority: Priority.high, icon: '@drawable/ic_stat_pikampus'),
        iOS: DarwinNotificationDetails(presentAlert: true, presentSound: true),
      ),
      payload: jsonEncode(message.data),
    );
  }

  void _openMessage(RemoteMessage message) => _navigate(message.data);

  void _openPayload(String? payload) {
    if (payload == null || payload.isEmpty) return;
    try {
      final data = jsonDecode(payload);
      if (data is Map) _navigate(data.map((key, value) => MapEntry(key.toString(), value)));
    } catch (_) {}
  }

  void _navigate(Map<String, dynamic> data) {
    final screen = data['screen']?.toString() ?? '';
    final id = data['targetId']?.toString();
    final location = screen.isEmpty ? Routes.notifications : routeForTarget(screen, (id == null || id.isEmpty) ? null : id);
    // Uygulama açılırken oturum yüklenene kadar bekleyip ilgili ekranı açar.
    Future<void>.delayed(const Duration(milliseconds: 300), () => _ref.read(routerProvider).push(location));
  }

  void dispose() {
    for (final sub in _subscriptions) {
      sub.cancel();
    }
    _sessionSub?.close();
    _lifecycle?.dispose();
  }
}
