import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'core/api.dart';
import 'core/session.dart';
import 'core/theme.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/password_screen.dart';
import 'features/coach/coach_home.dart';
import 'features/student/student_home.dart';
import 'features/account/no_koc_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('tr_TR');
  final session = Session(ApiClient());
  runApp(PiKocApp(session: session));
  await session.restore();
}

class PiKocApp extends StatelessWidget {
  const PiKocApp({super.key, required this.session});

  final Session session;

  @override
  Widget build(BuildContext context) {
    return SessionScope(
      session: session,
      child: MaterialApp(
        title: 'Pi Koç',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        locale: const Locale('tr', 'TR'),
        supportedLocales: const [Locale('tr', 'TR')],
        localizationsDelegates: const [GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
        home: const _Root(),
      ),
    );
  }
}

/// Oturuma göre ilk ekran: giriş, şifre değiştirme, koç paneli ya da öğrenci ekranı.
class _Root extends StatelessWidget {
  const _Root();

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    if (!session.ready) return const Scaffold(backgroundColor: Brand.ink900, body: Center(child: CircularProgressIndicator(color: Colors.white)));
    final me = session.me;
    if (me == null) return const LoginScreen();
    if (me.mustChangePassword) return const PasswordScreen(firstLogin: true);
    return switch (session.view) {
      KocView.coach => const CoachHome(),
      KocView.student => const StudentHome(),
      null => const NoKocScreen(),
    };
  }
}
