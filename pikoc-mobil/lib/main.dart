import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'core/api.dart';
import 'core/pi_logo.dart';
import 'core/push.dart';
import 'core/remote_config.dart';
import 'core/session.dart';
import 'core/theme.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/password_screen.dart';
import 'features/coach/coach_home.dart';
import 'features/student/student_home.dart';
import 'features/account/account_screen.dart';
import 'features/account/no_koc_screen.dart';
import 'features/teacher/teacher_home.dart';
import 'core/web_page.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('tr_TR');
  await PushService.instance.initialize();
  final api = ApiClient();
  final session = Session(api);
  // Açılış ayarları ve sürüm birlikte; oturum arkada açılır
  final results = await Future.wait([RemoteConfig.load(api), currentAppVersion()]);
  runApp(PiKampusApp(session: session, config: results[0] as RemoteConfig, version: results[1] as String));
  await session.restore();
  PushService.instance.start(session);
}

class PiKampusApp extends StatelessWidget {
  const PiKampusApp({super.key, required this.session, required this.config, required this.version});

  final Session session;
  final RemoteConfig config;
  final String version;

  @override
  Widget build(BuildContext context) {
    return ConfigScope(
      config: config,
      version: version,
      child: SessionScope(
        session: session,
        child: MaterialApp(
          title: config.appName,
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light(),
          darkTheme: AppTheme.dark(),
          locale: const Locale('tr', 'TR'),
          supportedLocales: const [Locale('tr', 'TR')],
          localizationsDelegates: const [GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
          home: compareVersions(version, config.minVersion) < 0 ? const UpdateRequiredScreen() : const _Root(),
        ),
      ),
    );
  }
}

/// Oturuma göre ilk ekran: giriş, şifre değiştirme, koç paneli ya da öğrenci ekranı.
class _Root extends StatefulWidget {
  const _Root();

  @override
  State<_Root> createState() => _RootState();
}

class _RootState extends State<_Root> {
  bool _offered = false;

  /// Yeni sürüm varsa (zorunlu değil) her sürüm için bir kez önerilir
  Future<void> _offerUpdate() async {
    if (_offered) return;
    _offered = true;
    final config = ConfigScope.of(context);
    final version = ConfigScope.versionOf(context);
    final storeUrl = _storeUrl(config);
    if (storeUrl == null || compareVersions(version, config.latestVersion) >= 0) return;
    final prefs = await SharedPreferences.getInstance();
    final key = 'pk_update_offered_${config.latestVersion}';
    if (prefs.getBool(key) == true || !mounted) return;
    await prefs.setBool(key, true);
    if (!mounted) return;
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      SnackBar(
        duration: const Duration(seconds: 8),
        content: Text('${config.appName} ${config.latestVersion} sürümü çıktı.'),
        action: SnackBarAction(label: 'Güncelle', onPressed: () => launchUrl(Uri.parse(storeUrl), mode: LaunchMode.externalApplication)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    if (!session.ready) return const Scaffold(backgroundColor: Brand.ink900, body: Center(child: CircularProgressIndicator(color: Colors.white)));
    WidgetsBinding.instance.addPostFrameCallback((_) => _offerUpdate());
    final me = session.me;
    if (me == null) return const LoginScreen();
    if (me.mustChangePassword) return const PasswordScreen(firstLogin: true);
    // Seçili taraf: Pi Koç uygulamanın kendi ekranları; özel ders öğretmeni karma; veli ve kurum sitenin paneli
    final view = session.view;
    final account = IconButton(
      tooltip: 'Hesabım',
      icon: const Icon(Icons.account_circle_outlined),
      onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => Scaffold(appBar: AppBar(title: const Text('Hesabım')), body: const AccountScreen()))),
    );
    return KeyedSubtree(
      key: ValueKey(view),
      child: switch (view) {
        AppView.coach => const CoachHome(),
        AppView.kocStudent => const StudentHome(),
        AppView.teacher => const TeacherHome(),
        AppView.parent => WebHome(title: 'Hesabım', path: '/hesabim', actions: [account]),
        AppView.kurumStaff => WebHome(title: 'Kurum paneli', path: '/kurum', actions: [account]),
        AppView.kurumPortal => WebHome(title: 'Kurumum', path: '/hesabim/kurum', actions: [account]),
        null => const NoKocScreen(),
      },
    );
  }
}

String? _storeUrl(RemoteConfig config) {
  try {
    return Platform.isIOS ? config.iosStoreUrl : config.androidStoreUrl;
  } catch (_) {
    return config.androidStoreUrl;
  }
}

/// Uygulama, sitenin desteklediği en düşük sürümden eskiyse: güncelleme istenir (eski sürüm sunucuyla uyumsuz olabilir).
class UpdateRequiredScreen extends StatelessWidget {
  const UpdateRequiredScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final config = ConfigScope.of(context);
    final storeUrl = _storeUrl(config);
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: Brand.ink900,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const PiLogo(light: true, size: 48),
              const SizedBox(height: 24),
              Text('Lütfen uygulamayı güncelleyin', textAlign: TextAlign.center, style: theme.textTheme.headlineSmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w800)),
              const SizedBox(height: 12),
              Text(
                'Bu sürüm artık desteklenmiyor. Yeni özellikler ve güvenlik düzeltmeleri için ${config.appName} uygulamasının son sürümünü yükleyin.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(color: Colors.white70),
              ),
              const SizedBox(height: 28),
              if (storeUrl != null)
                FilledButton.icon(
                  onPressed: () => launchUrl(Uri.parse(storeUrl), mode: LaunchMode.externalApplication),
                  icon: const Icon(Icons.system_update_rounded),
                  label: const Text('Güncelle'),
                )
              else
                TextButton(
                  onPressed: () => launchUrl(Uri.parse(config.siteUrl), mode: LaunchMode.externalApplication),
                  child: const Text('Siteyi aç', style: TextStyle(color: Colors.white)),
                ),
            ]),
          ),
        ),
      ),
    );
  }
}
