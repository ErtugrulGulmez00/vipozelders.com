import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/format.dart';
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
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        SectionCard(
          title: me.fullName,
          subtitle: [me.email, me.username].whereType<String>().join(' · '),
          child: Text(session.view == KocView.coach ? 'Pi Koç · koç hesabı' : 'Pi Koç · öğrenci / veli hesabı', style: theme.textTheme.bodySmall),
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
            if (me.isCoach && me.isStudent)
              ListTile(
                leading: const Icon(Icons.swap_horiz_rounded),
                title: Text(session.view == KocView.coach ? 'Öğrenci ekranına geç' : 'Koç paneline geç'),
                onTap: () => session.switchView(session.view == KocView.coach ? KocView.student : KocView.coach),
              ),
            if (session.view == KocView.coach)
              ListTile(
                leading: const Icon(Icons.open_in_new_rounded),
                title: const Text('Tam paneli tarayıcıda aç'),
                subtitle: const Text('Program yazma, deneme PDF aktarımı, tahsilat, veli raporu'),
                onTap: () => launchUrl(Uri.parse('${AppConfig.siteUrl}/koc'), mode: LaunchMode.externalApplication),
              ),
            ListTile(
              leading: const Icon(Icons.help_outline_rounded),
              title: const Text('Gizlilik ve kullanım koşulları'),
              onTap: () => launchUrl(Uri.parse('${AppConfig.siteUrl}/gizlilik'), mode: LaunchMode.externalApplication),
            ),
          ]),
        ),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          key: const Key('logout'),
          onPressed: () async {
            if (await confirm(context, 'Çıkış yapılsın mı?', ok: 'Çıkış yap')) await session.logout();
          },
          icon: const Icon(Icons.logout_rounded),
          label: const Text('Çıkış yap'),
        ),
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
