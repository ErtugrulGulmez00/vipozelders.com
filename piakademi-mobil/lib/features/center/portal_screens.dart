import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/sides.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/states.dart';
import '../account/account_screen.dart';
import '../shared/data.dart';
import 'center_child_screen.dart';
import 'center_list_screen.dart';
import 'invite_screen.dart';

// Kurum tarafı (sitedeki /hesabim/kurum): veli ve öğrenci portalı. Özel ders menüsü burada yok;
// özel derse geçiş yalnızca özel derste işlemi olana görünür (sides.dart).

/// "Kurumum": tek bağlı öğrencide doğrudan onun sayfası (öğrenci hesabında "Bilgilerim"), birden çokta liste.
class PortalHomeScreen extends ConsumerWidget {
  const PortalHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final links = ref.watch(centerLinksProvider);
    final items = links.valueOrNull;
    if (items != null && items.length == 1) return CenterChildScreen(id: items.single.id, tab: true);
    if (items == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Kurumum')),
        body: AsyncBody(value: links, onRetry: () => ref.invalidate(centerLinksProvider), builder: (_) => const SizedBox.shrink()),
      );
    }
    return const CenterListScreen();
  }
}

/// Kurum tarafının hesap ayarları: profil, şifre, öğrenci bağlama, taraf değiştirme, destek, çıkış.
class PortalAccountScreen extends ConsumerWidget {
  const PortalAccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final me = session.me;
    if (me == null) return const Scaffold(body: LoadingView());
    final catalog = ref.watch(catalogProvider).valueOrNull;
    final links = ref.watch(centerLinksProvider).valueOrNull ?? const [];
    // Kurumun açtığı öğrenci hesabı: başka öğrenci bağlamaz
    final onlyStudent = links.isNotEmpty && links.every((l) => l.isStudentAccount);
    return Scaffold(
      appBar: AppBar(title: const Text('Hesap')),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          ProfileHeader(me: me, subtitle: onlyStudent ? 'Öğrenci · Kurum hesabı' : 'Veli · Kurum portalı'),
          SideSwitchTiles(me: me, current: AppView.portal),
          const MenuTitle('Hesap'),
          MenuTile(icon: Icons.badge_outlined, title: 'Profil bilgileri', subtitle: 'Ad, telefon', onTap: () => context.push(Routes.profileEdit)),
          MenuTile(icon: Icons.lock_reset_rounded, title: 'Şifre değiştir', onTap: () => context.push(Routes.changePassword)),
          if (!onlyStudent) ...[
            const MenuTitle('Kurum'),
            MenuTile(
              icon: Icons.link_rounded,
              title: 'Davet bağlantısıyla öğrenci bağla',
              subtitle: 'Kurumun gönderdiği bağlantıyı ya da kodu girin',
              onTap: () => showInviteCodeSheet(context),
            ),
          ],
          if (catalog != null) InfoLinks(catalog: catalog),
          const MenuTitle('Hesabı yönet'),
          MenuTile(icon: Icons.person_remove_outlined, title: 'Hesabımı sil', onTap: () => context.push(Routes.deleteAccount)),
          MenuTile(
            icon: Icons.logout_rounded,
            title: 'Çıkış yap',
            destructive: true,
            onTap: () async {
              final ok = await confirmDialog(context, title: 'Çıkış yapılsın mı?', message: 'Bu cihazdaki oturumunuz kapatılır.', confirmText: 'Çıkış yap');
              if (ok) await ref.read(sessionProvider.notifier).logout();
            },
          ),
          const AppVersionFooter(),
        ],
      ),
    );
  }
}
