import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../core/auth/sides.dart';
import '../../core/config.dart';
import '../../core/models/catalog.dart';
import '../../core/models/me.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/avatar.dart';
import '../../core/widgets/feedback.dart';
import '../center/invite_screen.dart';
import '../shared/widgets.dart';

final appVersionProvider = FutureProvider<String>((ref) async {
  try {
    final info = await PackageInfo.fromPlatform();
    return '${info.version} (${info.buildNumber})';
  } catch (_) {
    return '';
  }
});

/// Veli/öğrenci "Hesabım" sekmesi (misafirde giriş daveti ve yasal metinler).
class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final catalog = ref.watch(catalogProvider).valueOrNull;
    if (!session.isSignedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text('Hesabım')),
        body: ListView(
          children: [
            const SizedBox(
              height: 460,
              child: SignInPrompt(
                title: 'Pi Kampüs’e hoş geldiniz',
                message: 'Ders almak, favorilerinizi kaydetmek ve çocuğunuzun kurumdaki gelişimini takip etmek için giriş yapın ya da ücretsiz hesap oluşturun.',
                icon: Icons.person_outline_rounded,
              ),
            ),
            if (catalog != null) InfoLinks(catalog: catalog),
            const AppVersionFooter(),
          ],
        ),
      );
    }
    final me = session.me!;
    final unread = unreadFor(me, session.view);
    return Scaffold(
      appBar: AppBar(title: const Text('Hesabım'), actions: const [NotificationBell()]),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          ProfileHeader(me: me),
          SideSwitchTiles(me: me, current: AppView.student),
          const MenuTitle('Hesap'),
          MenuTile(icon: Icons.badge_outlined, title: 'Profil bilgileri', subtitle: 'Ad, telefon, il, hesap tipi', onTap: () => context.push(Routes.profileEdit)),
          MenuTile(icon: Icons.lock_reset_rounded, title: 'Şifre değiştir', onTap: () => context.push(Routes.changePassword)),
          MenuTile(
            icon: Icons.notifications_none_rounded,
            title: 'Bildirimler',
            trailing: unread > 0 ? Badge(label: Text('$unread')) : null,
            onTap: () => context.push(Routes.notifications),
          ),
          MenuTile(
            icon: Icons.forum_outlined,
            title: 'Mesajlar',
            subtitle: 'Öğretmenlerinizle yazışmalar',
            trailing: me.unreadMessages > 0 ? Badge(label: Text('${me.unreadMessages}')) : null,
            onTap: () => context.push(Routes.messages),
          ),
          const MenuTitle('Soru çözüm'),
          MenuTile(
            icon: Icons.add_a_photo_outlined,
            title: 'Soru sor',
            subtitle: me.questionCredits == null ? 'Fotoğrafını çek, öğretmen çözsün' : 'Kalan kredi: ${me.questionCredits}',
            onTap: () => context.push(Routes.ask),
          ),
          MenuTile(icon: Icons.help_outline_rounded, title: 'Sorularım', onTap: () => context.push(Routes.myQuestions)),
          MenuTile(icon: Icons.subscriptions_outlined, title: 'Soru aboneliklerim', subtitle: 'Öğretmeninize doğrudan soru', onTap: () => context.push(Routes.subscriptions)),
          const MenuTitle('Özel ders'),
          MenuTile(icon: Icons.event_note_outlined, title: 'Derslerim', onTap: () => context.go(Routes.lessons)),
          MenuTile(icon: Icons.inventory_2_outlined, title: 'Paketlerim', subtitle: 'Paket ve düzenli dersler', onTap: () => context.push(Routes.packages)),
          MenuTile(icon: Icons.groups_2_outlined, title: 'Grup derslerim', onTap: () => context.push(Routes.myGroups)),
          MenuTile(icon: Icons.favorite_border_rounded, title: 'Favori öğretmenler', onTap: () => context.go(Routes.favorites)),
          MenuTile(icon: Icons.search_rounded, title: 'Öğretmen bul', onTap: () => context.push(Routes.teachers)),
          MenuTile(icon: Icons.co_present_outlined, title: 'Grup dersleri', subtitle: 'Küçük gruplarla canlı ders', onTap: () => context.push(Routes.groups)),
          if (catalog?.rules.referralEnabled ?? false)
            MenuTile(
              icon: Icons.card_giftcard_rounded,
              title: 'Arkadaşını davet et',
              subtitle: 'Arkadaşınıza %${catalog!.rules.referralDiscountPercent} indirim, size soru kredisi',
              onTap: () => context.push(Routes.invite),
            ),
          const MenuTitle('Kurum (etüt merkezi / dershane)'),
          MenuTile(
            icon: Icons.link_rounded,
            title: 'Davet bağlantısıyla öğrenci bağla',
            subtitle: 'Kurumunuzun gönderdiği bağlantıyı ya da kodu girin',
            onTap: () => showInviteCodeSheet(context),
          ),
          MenuTile(icon: Icons.auto_stories_outlined, title: 'Rehber', subtitle: 'Sınav ve ders çalışma yazıları', onTap: () => context.push(Routes.guide)),
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

class ProfileHeader extends StatelessWidget {
  const ProfileHeader({super.key, required this.me, this.subtitle});

  final Me me;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final info = subtitle ??
        [
          if (me.student != null) me.student!.isParent ? 'Veli' : 'Öğrenci',
          if (me.isTeacher) 'Öğretmen',
          if (me.isCenter) 'Kurum personeli',
          if (me.student?.cityName != null) me.student!.cityName!,
        ].join(' · ');
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: Brand.hero, borderRadius: BorderRadius.circular(28)),
      child: Row(
        children: [
          Avatar(name: me.fullName, photoUrl: me.teacher?.photoUrl, size: 60),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(me.fullName, style: const TextStyle(fontFamily: AppTheme.displayFamily, color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
                const SizedBox(height: 2),
                Text(me.email ?? me.username ?? '', style: const TextStyle(color: Brand.ink200)),
                if (info.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(info, style: const TextStyle(color: Brand.gold300, fontWeight: FontWeight.w700, fontSize: 13)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// "Kurum tarafına geç" / "Özel ders tarafına geç" (sitedeki üst çubuk bağlantıları). Tarafı olmayan hesapta boş.
class SideSwitchTiles extends ConsumerWidget {
  const SideSwitchTiles({super.key, required this.me, required this.current});

  final Me me;
  final AppView current;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final switches = sideSwitches(me, current);
    if (switches.isEmpty) return const SizedBox.shrink();
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
      child: Column(
        children: [
          for (final s in switches)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Material(
                color: scheme.tertiaryContainer,
                borderRadius: BorderRadius.circular(20),
                clipBehavior: Clip.antiAlias,
                child: ListTile(
                  leading: Icon(s.target.isKurum ? Icons.apartment_rounded : Icons.school_rounded, color: scheme.primary),
                  title: Text(s.label, style: TextStyle(fontWeight: FontWeight.w700, color: scheme.onTertiaryContainer)),
                  subtitle: Text(switch (s.target) {
                    AppView.centerPanel => 'Kurum personeli paneli',
                    AppView.portal => 'Devam, etüt, ödev, deneme ve ödemeler',
                    AppView.teacher => 'Dersleriniz, talepler ve takvim',
                    AppView.student => 'Öğretmen bul, dersler ve soru çözüm',
                  }),
                  trailing: const Icon(Icons.swap_horiz_rounded),
                  onTap: () => ref.read(sessionProvider.notifier).switchView(s.target),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class MenuTitle extends StatelessWidget {
  const MenuTitle(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 6),
      child: Text(text, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, letterSpacing: 0.4, color: Theme.of(context).colorScheme.onSurfaceVariant)),
    );
  }
}

class MenuTile extends StatelessWidget {
  const MenuTile({super.key, required this.icon, required this.title, this.subtitle, this.onTap, this.trailing, this.destructive = false});

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final Widget? trailing;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final color = destructive ? scheme.error : null;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 20),
      leading: Icon(icon, color: color),
      title: Text(title, style: TextStyle(color: color)),
      subtitle: subtitle == null ? null : Text(subtitle!, maxLines: 2, overflow: TextOverflow.ellipsis),
      trailing: trailing ?? (destructive ? null : const Icon(Icons.chevron_right_rounded)),
      onTap: onTap,
    );
  }
}

/// Destek ve yasal metinler (KVKK, gizlilik, sözleşmeler).
class InfoLinks extends StatelessWidget {
  const InfoLinks({super.key, required this.catalog});

  final Catalog catalog;

  static const _support = ['sss', 'nasil-calisir', 'iletisim', 'hakkimizda'];

  @override
  Widget build(BuildContext context) {
    final support = catalog.pages.where((p) => _support.contains(p.slug)).toList();
    final legal = catalog.pages.where((p) => !_support.contains(p.slug)).toList();
    final email = catalog.site.contactEmail;
    final phone = catalog.site.contactPhone;
    final whatsapp = catalog.site.whatsappLink;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const MenuTitle('Destek'),
        // "Nasıl çalışır?" artık sitede ekran ekran rehber (özel ders, etüt merkezi, dershane)
        for (final page in support)
          MenuTile(
            icon: Icons.help_outline_rounded,
            title: page.title,
            onTap: () => context.push(page.slug == 'nasil-calisir' ? Routes.howItWorks : Routes.page(page.slug)),
          ),
        if (whatsapp != null)
          MenuTile(icon: Icons.chat_outlined, title: 'WhatsApp ile yazın', subtitle: catalog.site.supportWhatsapp, onTap: () => openExternal(context, whatsapp)),
        if (email != null && email.isNotEmpty && !email.endsWith('example.com'))
          MenuTile(icon: Icons.mail_outline_rounded, title: 'E-posta ile yazın', subtitle: email, onTap: () => openExternal(context, 'mailto:$email')),
        if (phone != null && phone.isNotEmpty) MenuTile(icon: Icons.call_outlined, title: 'Bizi arayın', subtitle: phone, onTap: () => openExternal(context, 'tel:$phone')),
        MenuTile(icon: Icons.language_rounded, title: 'Web sitesi', subtitle: AppConfig.siteHost, onTap: () => openExternal(context, AppConfig.siteUrl)),
        const MenuTitle('Yasal metinler'),
        for (final page in legal) MenuTile(icon: Icons.description_outlined, title: page.title, onTap: () => context.push(Routes.page(page.slug))),
      ],
    );
  }
}

class AppVersionFooter extends ConsumerWidget {
  const AppVersionFooter({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final version = ref.watch(appVersionProvider).valueOrNull ?? '';
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Text(
        'Pi Kampüs${version.isEmpty ? '' : ' · sürüm $version'}',
        textAlign: TextAlign.center,
        style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 12),
      ),
    );
  }
}
