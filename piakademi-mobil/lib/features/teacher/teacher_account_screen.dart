import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/config.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/widgets/feedback.dart';
import '../account/account_screen.dart';
import '../shared/widgets.dart';

/// Öğretmen hesabı: kazançlar, yorumlar, profil (web paneli), şifre, çıkış.
class TeacherAccountScreen extends ConsumerWidget {
  const TeacherAccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(sessionProvider.select((s) => s.me));
    final catalog = ref.watch(catalogProvider).valueOrNull;
    if (me == null) return const Scaffold(body: SizedBox.shrink());
    final teacher = me.teacher;
    return Scaffold(
      appBar: AppBar(title: const Text('Hesap'), actions: const [NotificationBell()]),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          ProfileHeader(
            me: me,
            subtitle: [
              'Öğretmen',
              if (teacher != null) teacher.status == 'PUBLISHED' ? 'Profil yayında' : 'Profil yayında değil',
              if (teacher?.verified ?? false) 'Onaylı',
            ].join(' · '),
          ),
          const MenuTitle('Kazanç ve geri bildirim'),
          MenuTile(icon: Icons.payments_outlined, title: 'Kazançlar', subtitle: 'Bekleyen, ödenebilir ve ödenen tutarlar', onTap: () => context.push(Routes.earnings)),
          MenuTile(icon: Icons.reviews_outlined, title: 'Yorumlar', subtitle: 'Gelen yorumlar ve cevaplarınız', onTap: () => context.push(Routes.teacherReviews)),
          const MenuTitle('Profil (web paneli)'),
          if (teacher != null)
            MenuTile(icon: Icons.visibility_outlined, title: 'Profilimi görüntüle', subtitle: 'Velilerin gördüğü sayfa', onTap: () => context.push(Routes.teacher(teacher.slug))),
          MenuTile(
            icon: Icons.edit_outlined,
            title: 'Profil, fotoğraf ve tanıtım',
            trailing: const Icon(Icons.open_in_new_rounded, size: 18),
            onTap: () => openExternal(context, '${AppConfig.siteUrl}/ogretmen-paneli/profil'),
          ),
          MenuTile(
            icon: Icons.sell_outlined,
            title: 'Dersler ve fiyatlar',
            trailing: const Icon(Icons.open_in_new_rounded, size: 18),
            onTap: () => openExternal(context, '${AppConfig.siteUrl}/ogretmen-paneli/dersler-ve-fiyatlar'),
          ),
          MenuTile(
            icon: Icons.folder_shared_outlined,
            title: 'Belgeler (kimlik, diploma)',
            trailing: const Icon(Icons.open_in_new_rounded, size: 18),
            onTap: () => openExternal(context, '${AppConfig.siteUrl}/ogretmen-paneli/belgeler'),
          ),
          const MenuTitle('Hesap'),
          MenuTile(icon: Icons.phone_outlined, title: 'Telefon numarası', subtitle: me.phone ?? 'Eklenmemiş', onTap: () => context.push(Routes.profileEdit)),
          MenuTile(icon: Icons.lock_reset_rounded, title: 'Şifre değiştir', onTap: () => context.push(Routes.changePassword)),
          MenuTile(icon: Icons.notifications_none_rounded, title: 'Bildirimler', onTap: () => context.push(Routes.notifications)),
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
