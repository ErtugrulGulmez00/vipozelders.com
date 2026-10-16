import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/deep_links.dart';
import 'core/push/push_service.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

class PiKampusApp extends ConsumerStatefulWidget {
  const PiKampusApp({super.key});

  @override
  ConsumerState<PiKampusApp> createState() => _PiKampusAppState();
}

class _PiKampusAppState extends ConsumerState<PiKampusApp> {
  @override
  void initState() {
    super.initState();
    // Push bildirimleri ve web bağlantıları (davet, ders bağlantısı) uygulama açıkken dinlenir.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(pushServiceProvider).start();
      ref.read(deepLinksProvider).start();
    });
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'Pi Kampüs',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ThemeMode.system,
      routerConfig: router,
      locale: const Locale('tr', 'TR'),
      supportedLocales: const [Locale('tr', 'TR')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      builder: (context, child) {
        // Sistem yazı boyutuna uyulur ama düzen bozulmasın diye üst sınır konur.
        final media = MediaQuery.of(context);
        final scaler = media.textScaler.clamp(minScaleFactor: 0.9, maxScaleFactor: 1.35);
        return MediaQuery(data: media.copyWith(textScaler: scaler), child: child ?? const SizedBox.shrink());
      },
    );
  }
}
