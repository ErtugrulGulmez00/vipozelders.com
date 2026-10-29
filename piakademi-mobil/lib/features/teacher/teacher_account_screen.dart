import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/sides.dart';
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
          // Kurum personeliyse "Kurum paneline geç"
          SideSwitchTiles(me: me, current: AppView.teacher),
          const MenuTitle('Kazanç ve geri bildirim'),
          MenuTile(icon: Icons.payments_outlined, title: 'Kazançlar', subtitle: 'Bekleyen, ödenebilir ve ödenen tutarlar', onTap: () => context.push(Routes.earnings)),
          MenuTile(icon: Icons.reviews_outlined, title: 'Yorumlar', subtitle: 'Gelen yorumlar ve cevaplarınız', onTap: () => context.push(Routes.teacherReviews)),
          MenuTile(
            icon: Icons.forum_outlined,
            title: 'Mesajlar',
            subtitle: 'Velilerle yazışmalar',
            trailing: me.unreadMessages > 0 ? Badge(label: Text('${me.unreadMessages}')) : null,
            onTap: () => context.push(Routes.messages),
          ),
          MenuTile(icon: Icons.photo_camera_outlined, title: 'Soru havuzu', subtitle: 'Fotoğraflı soruları ve abonelerinizin sorularını çözün', onTap: () => context.push(Routes.teacherPool)),
          MenuTile(icon: Icons.groups_2_outlined, title: 'Grup derslerim', subtitle: 'Oturumlar ve kayıtlar', onTap: () => context.push(Routes.myGroups)),
          MenuTile(
            icon: Icons.subscriptions_outlined,
            title: 'Soru aboneliği planlarım',
            subtitle: 'Aylık soru aboneliği satın',
            onTap: () => context.push(Routes.teacherWeb('/ogretmen-paneli/soru-aboneligi', 'Soru aboneliği')),
          ),
          const MenuTitle('Profil'),
          if (teacher != null)
            MenuTile(icon: Icons.visibility_outlined, title: 'Profilimi görüntüle', subtitle: 'Velilerin gördüğü sayfa', onTap: () => context.push(Routes.teacher(teacher.slug))),
          MenuTile(
            icon: Icons.edit_outlined,
            title: 'Profil, fotoğraf ve tanıtım',
            onTap: () => context.push(Routes.teacherWeb('/ogretmen-paneli/profil', 'Profil ve fotoğraf')),
          ),
          MenuTile(
            icon: Icons.sell_outlined,
            title: 'Dersler ve fiyatlar',
            onTap: () => context.push(Routes.teacherWeb('/ogretmen-paneli/dersler-ve-fiyatlar', 'Dersler ve fiyatlar')),
          ),
          MenuTile(
            icon: Icons.folder_shared_outlined,
            title: 'Belgeler (kimlik, diploma)',
            onTap: () => context.push(Routes.teacherWeb('/ogretmen-paneli/belgeler', 'Belgeler')),
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
