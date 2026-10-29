import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/pi_logo.dart';

/// Açılış: kayıtlı oturum kontrol edilirken gösterilir.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: DecoratedBox(
        decoration: BoxDecoration(color: Brand.hero),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              PiBadge(size: 84),
              SizedBox(height: 18),
              Text('Pi Kampüs', style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
              SizedBox(height: 28),
              SizedBox.square(dimension: 26, child: CircularProgressIndicator(strokeWidth: 2.5, color: Brand.gold300)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Kayıtlı oturum varken sunucuya ulaşılamadı.
class OfflineScreen extends ConsumerWidget {
  const OfflineScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(color: Brand.hero),
        child: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.wifi_off_rounded, color: Brand.gold300, size: 56),
                  const SizedBox(height: 16),
                  const Text('Bağlantı kurulamadı', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  const Text(
                    'Pi Kampüs’e ulaşamadık. İnternet bağlantınızı kontrol edip tekrar deneyin.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Brand.ink200, height: 1.45),
                  ),
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    style: FilledButton.styleFrom(backgroundColor: Brand.gold400, foregroundColor: Brand.ink900),
                    onPressed: () => ref.read(sessionProvider.notifier).restore(),
                    icon: const Icon(Icons.refresh_rounded),
                    label: const Text('Tekrar dene'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
