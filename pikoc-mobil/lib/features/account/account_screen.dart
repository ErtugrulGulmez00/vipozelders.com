import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/remote_config.dart';
import '../../core/web_page.dart';
import '../../core/session.dart';
import '../../core/widgets.dart';
import '../auth/password_screen.dart';

/// Hesap: bilgiler, bildirimler, şifre, taraf değiştirme (koç + öğrenci olan hesapta), çıkış.
class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    final me = session.me!;
    final theme = Theme.of(context);
    final config = ConfigScope.of(context);
    final view = session.view;
    final coach = view == AppView.coach;
    // Hesabın diğer tarafları (aynı hesap, farklı kapı): dokununca uygulama o tarafa geçer
    final others = me.views.where((v) => v != view).toList();
    // Uygulama içinde açılan site sayfaları (sitedeki ayardan gelir; Paketler yalnızca koçta)
    final pages = config.pages.where((p) => p['key'] != 'paketler' || coach).toList();
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        SectionCard(
          title: me.fullName,
          subtitle: [me.email, me.username].whereType<String>().join(' · '),
          child: Text(view?.label ?? '', style: theme.textTheme.bodySmall),
        ),
        Card(
          child: Column(children: [
            ListTile(
              leading: const Icon(Icons.notifications_outlined),
              title: const Text('Bildirimler'),
              trailing: me.unreadNotifications > 0 ? Badge(label: Text('${me.unreadNotifications}')) : const Icon(Icons.chevron_right_rounded),
              onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const NotificationsScreen())),
            ),
            ListTile(
              leading: const Icon(Icons.lock_outline_rounded),
              title: const Text('Şifre değiştir'),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const PasswordScreen())),
            ),
            for (final v in others)
              ListTile(
                key: Key('switch-${v.name}'),
                leading: const Icon(Icons.swap_horiz_rounded),
                title: Text('${v.label} tarafına geç'),
                onTap: () {
                  Navigator.of(context).popUntil((r) => r.isFirst);
                  session.switchView(v);
                },
              ),
            if (view == AppView.teacher) ...[
              ListTile(
                leading: const Icon(Icons.event_available_outlined),
                title: const Text('Müsaitlik takvimi'),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => WebPageScreen.openPath(context, 'Müsaitlik takvimi', '/ogretmen-paneli/takvim'),
              ),
              ListTile(
                leading: const Icon(Icons.reviews_outlined),
                title: const Text('Yorumlar'),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => WebPageScreen.openPath(context, 'Yorumlar', '/ogretmen-paneli/yorumlar'),
              ),
            ],
            if (coach)
              ListTile(
                leading: const Icon(Icons.open_in_new_rounded),
                title: const Text('Tam paneli tarayıcıda aç'),
                subtitle: const Text('Program yazma, deneme PDF aktarımı, tahsilat, veli raporu'),
                onTap: () => launchUrl(Uri.parse('${AppConfig.siteUrl}/koc'), mode: LaunchMode.externalApplication),
              ),
          ]),
        ),
        if (pages.isNotEmpty) ...[
          const SizedBox(height: 12),
          Card(
            child: Column(children: [
              for (final p in pages)
                ListTile(
                  key: Key('page-${p['key']}'),
                  leading: Icon(_pageIcon(p['key'] as String?)),
                  title: Text((p['title'] as String?) ?? ''),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => WebPageScreen.open(context, p),
                ),
            ]),
          ),
        ],
        if (config.whatsapp != null || config.contactEmail != null) ...[
          const SizedBox(height: 12),
          Card(
            child: Column(children: [
              if (config.whatsapp != null)
                ListTile(
                  leading: const Icon(Icons.chat_outlined),
                  title: const Text('WhatsApp ile yazın'),
                  subtitle: config.contactPhone != null ? Text(config.contactPhone!) : null,
                  onTap: () => launchUrl(Uri.parse('https://wa.me/${config.whatsapp}'), mode: LaunchMode.externalApplication),
                ),
              if (config.contactEmail != null)
                ListTile(
                  leading: const Icon(Icons.mail_outline_rounded),
                  title: const Text('E-posta'),
                  subtitle: Text(config.contactEmail!),
                  onTap: () => launchUrl(Uri.parse('mailto:${config.contactEmail}')),
                ),
            ]),
          ),
        ],
        const SizedBox(height: 16),
        OutlinedButton.icon(
          key: const Key('logout'),
          onPressed: () async {
            if (await confirm(context, 'Çıkış yapılsın mı?', ok: 'Çıkış yap')) await session.logout();
          },
          icon: const Icon(Icons.logout_rounded),
          label: const Text('Çıkış yap'),
        ),
        const SizedBox(height: 16),
        Center(child: Text('${config.appName} · sürüm ${ConfigScope.versionOf(context)}', style: theme.textTheme.bodySmall)),
      ],
    );
  }
}

/// Bildirimler: koç görüşme odasında, yeni görev, haftalık rapor…
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late final Session _session = SessionScope.read(context);
  late Future<Json> _data = _load();

  Future<Json> _load() => _session.api.get('/bildirimler');

  @override
  void dispose() {
    // Açılınca okundu sayılır; sayaç güncellenir
    final session = _session;
    session.api.post('/bildirimler/okundu').then((_) => session.refreshMe()).catchError((_) {});
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Bildirimler')),
      body: AsyncView<Json>(
        future: _data,
        onRetry: () => setState(() => _data = _load()),
        builder: (context, d) {
          final items = d.list('items');
          if (items.isEmpty) return const Center(child: EmptyNote('Bildirim yok.'));
          return ListView.separated(
            itemCount: items.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (context, i) {
              final n = items[i];
              final created = n.str('createdAt');
              return ListTile(
                leading: Icon(n.strOrNull('readAt') == null ? Icons.circle : Icons.circle_outlined, size: 10, color: Theme.of(context).colorScheme.primary),
                title: Text(n.str('title'), style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text([n.strOrNull('body'), created.length >= 10 ? dayMonth(created.substring(0, 10)) : null].whereType<String>().join('\n')),
              );
            },
          );
        },
      ),
    );
  }
}

IconData _pageIcon(String? key) => switch (key) {
      'paketler' => Icons.workspace_premium_outlined,
      'tercih-lgs' || 'tercih-yks' => Icons.school_outlined,
      'rehber' => Icons.menu_book_outlined,
      'sss' => Icons.help_outline_rounded,
      _ => Icons.description_outlined,
    };
