import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'session.dart';

/// Uygulama kapalıyken gelen mesajı FCM kendisi gösterir; burada iş yok.
@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage message) async {}

/// Push bildirimleri (Firebase Cloud Messaging). Firebase ayarı yoksa (google-services.json olmadan derlenmişse)
/// sessizce kapalı kalır; uygulamaya dönülünce okunmamış sayısı yine yenilenir.
class PushService {
  PushService._();

  static final instance = PushService._();
  static const channelId = 'pikampus_genel';

  bool _ready = false;
  bool _started = false;
  String? _token;
  String? _registeredFor;
  Session? _session;
  final _local = FlutterLocalNotificationsPlugin();
  final _subs = <StreamSubscription<Object?>>[];
  AppLifecycleListener? _lifecycle;

  /// main() içinde, runApp'tan önce
  Future<void> initialize() async {
    if (kIsWeb) return;
    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);
      _ready = true;
    } catch (error) {
      debugPrint('Firebase başlatılamadı (bildirimler kapalı): $error');
    }
  }

  /// Oturum hazır olunca: dinleyiciler kurulur, giriş yapılınca cihaz kaydedilir.
  void start(Session session) {
    if (_started) return;
    _started = true;
    _session = session;
    _lifecycle = AppLifecycleListener(onResume: () {
      if (session.me != null) session.refreshMe().catchError((_) {});
    });
    session.addListener(_onSession);
    if (_ready) unawaited(_startMessaging());
  }

  Future<void> _startMessaging() async {
    try {
      await _local.initialize(
        settings: const InitializationSettings(
          android: AndroidInitializationSettings('@drawable/ic_stat_pikampus'),
          iOS: DarwinInitializationSettings(requestAlertPermission: false, requestBadgePermission: false, requestSoundPermission: false),
        ),
      );
      final android = _local.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      await android?.createNotificationChannel(
        const AndroidNotificationChannel(channelId, 'Pi Kampüs bildirimleri', description: 'Ders talepleri, görüşmeler, raporlar ve kurum bildirimleri', importance: Importance.high),
      );
      final messaging = FirebaseMessaging.instance;
      await messaging.setForegroundNotificationPresentationOptions(alert: false, badge: true, sound: false);
      _subs.add(FirebaseMessaging.onMessage.listen(_onForeground));
      // ignore: deprecated_member_use
      _subs.add(messaging.onTokenRefresh.listen((token) {
        _token = token;
        _registeredFor = null;
        unawaited(_register());
      }));
      _onSession();
    } catch (error) {
      debugPrint('Bildirimler başlatılamadı: $error');
    }
  }

  void _onSession() {
    final me = _session?.me;
    if (!_ready || me == null) return;
    final id = '${me.email ?? me.username}';
    if (_registeredFor == id) return;
    unawaited(_register());
  }

  Future<void> _register() async {
    final session = _session;
    if (session == null || session.me == null) return;
    try {
      final settings = await FirebaseMessaging.instance.requestPermission();
      if (settings.authorizationStatus == AuthorizationStatus.denied) return;
      // Sunucu FCM HTTP v1 "token" hedeflemesi kullanır
      // ignore: deprecated_member_use
      _token ??= await FirebaseMessaging.instance.getToken();
      final token = _token;
      if (token == null) return;
      await session.api.post('/cihazlar', {'token': token, 'platform': defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android'});
      _registeredFor = '${session.me?.email ?? session.me?.username}';
    } catch (error) {
      debugPrint('Cihaz kaydedilemedi: $error');
    }
  }

  /// Çıkışta: bu cihaza artık bildirim gitmesin
  Future<void> unregister(Session session) async {
    final token = _token;
    _registeredFor = null;
    if (!_ready || token == null) return;
    try {
      await session.api.delete('/cihazlar/${Uri.encodeComponent(token)}');
    } catch (_) {}
  }

  void _onForeground(RemoteMessage message) {
    _session?.refreshMe().catchError((_) {});
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
    );
  }

  void dispose() {
    for (final s in _subs) {
      s.cancel();
    }
    _session?.removeListener(_onSession);
    _lifecycle?.dispose();
  }
}
