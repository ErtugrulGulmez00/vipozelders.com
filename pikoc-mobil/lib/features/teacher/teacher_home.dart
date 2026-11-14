import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/web_page.dart';
import '../../core/widgets.dart';
import '../account/account_screen.dart';

/// Özel ders öğretmeni: ders talepleri (uygulamanın ekranı), mesajlar ve profil (sitenin sayfası), hesap.
class TeacherHome extends StatefulWidget {
  const TeacherHome({super.key});

  @override
  State<TeacherHome> createState() => _TeacherHomeState();
}

class _TeacherHomeState extends State<TeacherHome> {
  int _tab = 0;

  static const _titles = ['Ders talepleri', 'Mesajlar', 'Profilim', 'Hesabım'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_titles[_tab])),
      body: IndexedStack(index: _tab, children: const [
        InquiriesScreen(),
        WebPanel(authPath: '/ogretmen-paneli/mesajlar'),
        WebPanel(authPath: '/ogretmen-paneli/profil'),
        AccountScreen(),
      ]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.inbox_outlined), selectedIcon: Icon(Icons.inbox_rounded), label: 'Talepler'),
          NavigationDestination(icon: Icon(Icons.chat_bubble_outline_rounded), selectedIcon: Icon(Icons.chat_bubble_rounded), label: 'Mesajlar'),
          NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded), label: 'Profil'),
          NavigationDestination(icon: Icon(Icons.settings_outlined), selectedIcon: Icon(Icons.settings_rounded), label: 'Hesap'),
        ],
      ),
    );
  }
}

/// Vitrinden gelen ders talepleri: kabul et / geri çevir; kabul edilende velinin telefonu ve WhatsApp'ı.
class InquiriesScreen extends StatefulWidget {
  const InquiriesScreen({super.key});

  @override
  State<InquiriesScreen> createState() => _InquiriesScreenState();
}

class _InquiriesScreenState extends State<InquiriesScreen> {
  late Future<Json> _data = _load();
  String? _busy;

  Future<Json> _load() => SessionScope.read(context).api.get('/ogretmen/ders-talepleri');

  Future<void> _reload() async {
    final next = _load();
    setState(() => _data = next);
    await next.catchError((_) => <String, dynamic>{});
  }

  Future<void> _act(String id, String action) async {
    if (action == 'decline' && !await confirm(context, 'Talep geri çevrilsin mi? Veliye nazikçe haber verilir.', ok: 'Geri çevir')) return;
    if (!mounted) return;
    setState(() => _busy = id);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final res = await SessionScope.read(context).api.post('/ogretmen/ders-talepleri/$id', {'action': action});
      messenger.showSnackBar(SnackBar(content: Text(res.str('message'))));
      await _reload();
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(errorText(e))));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    final hasCoach = session.me?.views.contains(AppView.coach) ?? false;
    return AsyncView<Json>(
      future: _data,
      onRetry: _reload,
      builder: (context, d) {
        final items = d.list('items');
        return RefreshIndicator(
          onRefresh: _reload,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              _VideoNote(onKoc: hasCoach ? () => session.switchView(AppView.coach) : null),
              const SizedBox(height: 12),
              if (items.isEmpty)
                const Padding(padding: EdgeInsets.only(top: 40), child: EmptyNote('Henüz ders talebi yok. Veliler profilinizden talep gönderdiğinde burada görünür.'))
              else
                for (final q in items) _InquiryCard(q: q, busy: _busy == q.str('id'), onAct: (a) => _act(q.str('id'), a), onKoc: hasCoach ? () => session.switchView(AppView.coach) : null),
            ],
          ),
        );
      },
    );
  }
}

/// Görüntülü derslerin Pi Koç'tan yapıldığını anlatan not (sitedeki Ders talepleri sayfasıyla aynı)
class _VideoNote extends StatelessWidget {
  const _VideoNote({this.onKoc});

  final VoidCallback? onKoc;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFFF3EEFF), Colors.white, Brand.b50]),
        border: Border.all(color: const Color(0xFFDCCFFD)),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(color: const Color(0xFF7C3AED), borderRadius: BorderRadius.circular(12)),
          child: const Icon(Icons.videocam_rounded, color: Colors.white, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Görüntülü dersler Pi Koç üzerinden yapılır.', style: TextStyle(fontWeight: FontWeight.w800, color: Brand.ink900)),
            const SizedBox(height: 4),
            const Text(
              'Talebi kabul ettiğiniz öğrenci Pi Koç\'unuza eklenir; dersi öğrencinin sayfasındaki "Görüşmeyi başlat" ile açarsınız. Öğrencinin Koçum bölümünde "Görüşmeye katıl" düğmesi açılır.',
              style: TextStyle(fontSize: 13, color: Brand.ink700, height: 1.35),
            ),
            if (onKoc != null) TextButton(onPressed: onKoc, style: TextButton.styleFrom(padding: EdgeInsets.zero), child: const Text("Pi Koç'a geç")),
          ]),
        ),
      ]),
    );
  }
}

class _InquiryCard extends StatelessWidget {
  const _InquiryCard({required this.q, required this.busy, required this.onAct, this.onKoc});

  final Json q;
  final bool busy;
  final void Function(String action) onAct;
  final VoidCallback? onKoc;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final status = q.str('status');
    final created = q.str('createdAt');
    final who = [q.strOrNull('studentName'), q.strOrNull('gradeName')].whereType<String>().join(', ');
    final (label, tone) = switch (status) {
      'PENDING' => ('Yanıt bekliyor', Tone.amber),
      'ACCEPTED' => ('Kabul ettiniz', Tone.green),
      _ => ('Geri çevrildi', Tone.slate),
    };
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(q.strOrNull('lessonName') ?? 'Ders belirtilmedi', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800))),
            Pill(label, tone: tone),
          ]),
          if (who.isNotEmpty) Text(who, style: theme.textTheme.bodyMedium),
          Text([created.length >= 10 ? dayMonth(created.substring(0, 10)) : null, q.strOrNull('modeLabel')].whereType<String>().join(' · '), style: theme.textTheme.bodySmall),
          if (q.strOrNull('preferredTimes') != null) ...[const SizedBox(height: 8), Text('Uygun saatler: ${q.str('preferredTimes')}')],
          if (q.strOrNull('note') != null) ...[
            const SizedBox(height: 8),
            Container(width: double.infinity, padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: theme.colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(12)), child: Text(q.str('note'))),
          ],
          const SizedBox(height: 12),
          if (status == 'PENDING')
            Row(children: [
              Expanded(child: OutlinedButton(onPressed: busy ? null : () => onAct('decline'), child: const Text('Geri çevir'))),
              const SizedBox(width: 10),
              Expanded(child: FilledButton(onPressed: busy ? null : () => onAct('accept'), child: busy ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white)) : const Text('Kabul et'))),
            ])
          else if (status == 'ACCEPTED') ...[
            Text(q.str('name'), style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Wrap(spacing: 8, runSpacing: 8, children: [
              if (q.strOrNull('phone') != null)
                OutlinedButton.icon(onPressed: () => launchUrl(Uri.parse('tel:${q.str('phone').replaceAll(' ', '')}')), icon: const Icon(Icons.call_rounded, size: 18), label: Text(q.str('phone'))),
              if (q.strOrNull('whatsapp') != null)
                FilledButton.icon(
                  style: FilledButton.styleFrom(backgroundColor: const Color(0xFF25D366)),
                  onPressed: () => launchUrl(Uri.parse('https://wa.me/${q.str('whatsapp')}'), mode: LaunchMode.externalApplication),
                  icon: const Icon(Icons.chat_rounded, size: 18),
                  label: const Text('WhatsApp'),
                ),
            ]),
            const SizedBox(height: 6),
            if (q.strOrNull('coachStudentId') != null)
              TextButton(onPressed: onKoc, style: TextButton.styleFrom(padding: EdgeInsets.zero), child: const Text("Öğrenci Pi Koç'unuzda: program, ödev, deneme ve görüntülü ders orada"))
            else
              TextButton(onPressed: busy ? null : () => onAct('koc'), style: TextButton.styleFrom(padding: EdgeInsets.zero), child: const Text("Pi Koç'a ekle")),
          ],
        ]),
      ),
    );
  }
}
