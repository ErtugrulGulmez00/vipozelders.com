import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/adaptive.dart';
import '../../core/api.dart';
import '../../core/door_icons.dart';
import '../../core/format.dart';
import '../../core/remote_config.dart';
import '../../core/web_page.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../auth/password_screen.dart';

/// Hesap: profil, paneller arası geçiş (giriş ekranındaki kapı kutularıyla), ayarlar, site sayfaları, iletişim, çıkış.
class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key, this.showTitle = false});

  /// Üst çubuğu olmayan ekranlarda (koç paneli) büyük "Hesabım" başlığı
  final bool showTitle;

  static String _short(AppView v) => switch (v) {
    AppView.coach => 'Pi Koç',
    AppView.kocStudent => 'Pi Koç öğrenci',
    AppView.teacher => 'Özel ders',
    AppView.parent => 'Özel ders veli',
    AppView.kurumStaff => 'Kurum',
    AppView.kurumPortal => 'Kurum veli',
  };

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    final me = session.me;
    // Çıkış anında ekran kapanana kadar boş kalır (kök ekran giriş ekranına döner)
    if (me == null) return const Scaffold();
    final config = ConfigScope.of(context);
    final view = session.view;
    final coach = view == AppView.coach;
    final views = me.views;
    // Uygulama içinde açılan site sayfaları (sitedeki ayardan gelir; Paketler yalnızca koçta)
    final pages = config.pages.where((p) => p['key'] != 'paketler' || coach).toList();
    final initials = [me.firstName, me.lastName].where((p) => p.isNotEmpty).map((p) => p.characters.first.toUpperCase()).join();
    void push(Widget page) => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => page));
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      children: [
        if (showTitle) ...[
          const Text(
            'Hesabım',
            style: TextStyle(fontFamily: AppTheme.displayFamily, fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: -0.6, color: Brand.ink900),
          ),
          const SizedBox(height: 14),
        ],
        _Group(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(color: Brand.ink900, borderRadius: BorderRadius.circular(16)),
                    alignment: Alignment.center,
                    child: Text(
                      initials,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 19),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          me.fullName,
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17, color: Brand.ink900),
                        ),
                        Text(
                          [me.email ?? me.username, view?.label].whereType<String>().join(' · '),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 13, color: Brand.ink500),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        if (views.length > 1) ...[
          const _Label('Paneller'),
          LayoutBuilder(
            builder: (context, box) {
              const gap = 8.0;
              final perRow = views.length >= 3 ? 3 : views.length;
              final w = (box.maxWidth - gap * (perRow - 1)) / perRow;
              return Wrap(
                spacing: gap,
                runSpacing: gap,
                children: [
                  for (final v in views)
                    SizedBox(
                      width: w,
                      child: _PanelTile(
                        key: Key('switch-${v.name}'),
                        view: v,
                        label: _short(v),
                        selected: v == view,
                        onTap: v == view
                            ? null
                            : () {
                                Navigator.of(context).popUntil((r) => r.isFirst);
                                session.switchView(v);
                              },
                      ),
                    ),
                ],
              );
            },
          ),
        ],
        const SizedBox(height: 14),
        _Group(
          children: [
            _Row(
              icon: Icons.notifications_outlined,
              tone: (Brand.b100, Brand.b700),
              label: 'Bildirimler',
              badge: me.unreadNotifications > 0 ? '${me.unreadNotifications}' : null,
              onTap: () => push(const NotificationsScreen()),
            ),
            _Row(icon: Icons.lock_outline_rounded, label: 'Şifre değiştir', onTap: () => push(const PasswordScreen())),
            if (view == AppView.teacher) ...[
              _Row(icon: Icons.event_available_outlined, label: 'Müsaitlik takvimi', onTap: () => WebPageScreen.openPath(context, 'Müsaitlik takvimi', '/ogretmen-paneli/takvim')),
              _Row(icon: Icons.reviews_outlined, label: 'Yorumlar', onTap: () => WebPageScreen.openPath(context, 'Yorumlar', '/ogretmen-paneli/yorumlar')),
            ],
            if (coach)
              _Row(
                icon: Icons.open_in_new_rounded,
                label: 'Sitedeki tam panel',
                hint: 'Program yazma, PDF aktarımı, tahsilat, veli raporu',
                onTap: () => launchUrl(Uri.parse('${AppConfig.siteUrl}/koc'), mode: LaunchMode.externalApplication),
              ),
          ],
        ),
        if (pages.isNotEmpty) ...[
          const SizedBox(height: 14),
          _Group(
            children: [
              for (final p in pages)
                _Row(
                  key: Key('page-${p['key']}'),
                  icon: _pageIcon(p['key'] as String?),
                  tone: _pageTone(p['key'] as String?),
                  label: (p['title'] as String?) ?? '',
                  onTap: () => WebPageScreen.open(context, p),
                ),
            ],
          ),
        ],
        if (config.whatsapp != null || config.contactEmail != null) ...[
          const SizedBox(height: 14),
          _Group(
            children: [
              if (config.whatsapp != null)
                _Row(
                  icon: Icons.chat_outlined,
                  tone: (const Color(0xFFDDF5EC), const Color(0xFF11684A)),
                  label: 'WhatsApp ile yazın',
                  hint: config.contactPhone,
                  onTap: () => launchUrl(Uri.parse('https://wa.me/${config.whatsapp}'), mode: LaunchMode.externalApplication),
                ),
              if (config.contactEmail != null) _Row(icon: Icons.mail_outline_rounded, label: 'E-posta', hint: config.contactEmail, onTap: () => launchUrl(Uri.parse('mailto:${config.contactEmail}'))),
            ],
          ),
        ],
        const SizedBox(height: 10),
        TextButton(
          key: const Key('logout'),
          onPressed: () async {
            if (await confirm(context, 'Çıkış yapılsın mı?', ok: 'Çıkış yap')) await session.logout();
          },
          style: TextButton.styleFrom(minimumSize: const Size.fromHeight(50)),
          child: const Text(
            'Çıkış yap',
            style: TextStyle(color: Brand.b700, fontWeight: FontWeight.w700, fontSize: 15),
          ),
        ),
        Center(
          child: Text('${config.appName} · sürüm ${ConfigScope.versionOf(context)}', style: const TextStyle(fontSize: 12, color: Brand.ink400)),
        ),
      ],
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(4, 18, 4, 8),
    child: Text(
      text.toUpperCase(),
      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: Brand.ink500),
    ),
  );
}

/// Beyaz, yuvarlak köşeli grup; satırlar arasında ince çizgi
class _Group extends StatelessWidget {
  const _Group({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Brand.ink100),
      ),
      child: Column(
        children: [
          for (var i = 0; i < children.length; i++) ...[if (i > 0) const Divider(height: 1, thickness: 1, color: Brand.ink50), children[i]],
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({super.key, required this.icon, required this.label, required this.onTap, this.hint, this.badge, this.tone = (Brand.ink50, Brand.ink700)});

  final IconData icon;
  final String label;
  final String? hint;
  final String? badge;
  final (Color, Color) tone;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(color: tone.$1, borderRadius: BorderRadius.circular(10)),
                child: Icon(icon, size: 19, color: tone.$2),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15, color: Brand.ink900),
                    ),
                    if (hint != null) Text(hint!, style: const TextStyle(fontSize: 12, color: Brand.ink500)),
                  ],
                ),
              ),
              if (badge != null)
                Container(
                  constraints: const BoxConstraints(minWidth: 22),
                  height: 22,
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  margin: const EdgeInsets.only(right: 6),
                  decoration: BoxDecoration(color: Brand.b600, borderRadius: BorderRadius.circular(999)),
                  alignment: Alignment.center,
                  child: Text(
                    badge!,
                    style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                ),
              const Icon(Icons.chevron_right_rounded, color: Brand.ink300),
            ],
          ),
        ),
      ),
    );
  }
}

/// Panel kutusu (giriş ekranındaki kapı kutusuyla aynı görünüm)
class _PanelTile extends StatelessWidget {
  const _PanelTile({super.key, required this.view, required this.label, required this.selected, this.onTap});

  final AppView view;
  final String label;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      selected: selected,
      button: true,
      label: '$label paneline geç',
      excludeSemantics: true,
      child: Material(
        color: selected ? Brand.b50 : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(color: selected ? Brand.b600 : Brand.ink100, width: selected ? 1.5 : 1),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
            child: Column(
              children: [
                DoorIcon(door: view.door, size: 34),
                const SizedBox(height: 6),
                Text(
                  label,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: selected ? Brand.b700 : Brand.ink700),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

(Color, Color) _pageTone(String? key) => switch (key) {
  'paketler' => (Brand.gold100, Brand.gold700),
  'tercih-lgs' || 'tercih-yks' => (Brand.iris100, const Color(0xFF3B3F9E)),
  'rehber' => (const Color(0xFFDDF5EC), const Color(0xFF11684A)),
  _ => (Brand.ink50, Brand.ink700),
};

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
      body: Readable(
        child: AsyncView<Json>(
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
