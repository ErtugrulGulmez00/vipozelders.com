import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../account/account_screen.dart';
import 'coach_student.dart';

/// Koç: öğrenci listesi (uyarılarla) ve hesap. Program yazma, PDF aktarımı, tahsilat sitede.
class CoachHome extends StatefulWidget {
  const CoachHome({super.key});

  @override
  State<CoachHome> createState() => _CoachHomeState();
}

class _CoachHomeState extends State<CoachHome> {
  int _tab = 0;
  late Future<Json> _data = _load();
  String _query = '';

  Future<Json> _load() => SessionScope.read(context).api.get('/koc/panel');

  Future<void> _reload() async {
    final next = _load();
    setState(() => _data = next);
    await next.catchError((_) => <String, dynamic>{});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_tab == 0 ? 'Öğrencilerim' : 'Hesabım')),
      body: IndexedStack(index: _tab, children: [
        AsyncView<Json>(future: _data, onRetry: _reload, builder: (context, d) => RefreshIndicator(onRefresh: _reload, child: _list(d))),
        const AccountScreen(),
      ]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.groups_outlined), selectedIcon: Icon(Icons.groups_rounded), label: 'Öğrenciler'),
          NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded), label: 'Hesap'),
        ],
      ),
    );
  }

  Widget _list(Json d) {
    final center = d.obj('center');
    final all = d.list('students');
    final q = _query.toLowerCase();
    final students = q.isEmpty ? all : all.where((s) => '${s.str('firstName')} ${s.str('lastName')}'.toLowerCase().contains(q)).toList();
    final alerts = all.where((s) => s.strings('alerts').isNotEmpty).length;
    final weekSolved = all.fold<int>(0, (t, s) => t + s.integer('solvedThisWeek'));
    final me = SessionScope.of(context).me!;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        HeroHeader(
          overline: '${center.str('name')} · ${longDay(d.str('today'))}',
          title: 'Merhaba ${me.firstName}',
          lines: [
            '${all.length}/${center.integer('studentLimit')} öğrenci · bu hafta ${numText(weekSolved)} soru',
            if (center.str('status') == 'TRIAL' && center.strOrNull('trialEndsAt') != null) 'Ücretsiz deneme ${dayMonth(center.str('trialEndsAt').substring(0, 10))} tarihine kadar',
          ],
          action: OutlinedButton.icon(
            style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Brand.ink600)),
            onPressed: () => launchUrl(Uri.parse('${AppConfig.siteUrl}/koc'), mode: LaunchMode.externalApplication),
            icon: const Icon(Icons.open_in_new_rounded, size: 18),
            label: const Text('Sitedeki tam panel'),
          ),
        ),
        if (!center.flag('writable'))
          const SectionCard(title: 'Abonelik süresi doldu', child: Text('Panel salt okunur. Kayıtlarınız duruyor; aboneliği sitede yenileyebilirsiniz.')),
        if (all.length > 5)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: TextField(decoration: const InputDecoration(prefixIcon: Icon(Icons.search_rounded), hintText: 'Öğrenci ara'), onChanged: (v) => setState(() => _query = v)),
          ),
        if (alerts > 0) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text('$alerts öğrencide dikkat edilecek bir durum var', style: Theme.of(context).textTheme.titleSmall)),
        if (all.isEmpty) const SectionCard(title: 'Henüz öğrenci yok', child: Text('İlk öğrencinizi sitedeki panelden ekleyin; burada görünür.')),
        for (final s in students) _StudentCard(student: s, onChanged: _reload),
      ],
    );
  }
}

class _StudentCard extends StatelessWidget {
  const _StudentCard({required this.student, required this.onChanged});

  final Json student;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final s = student;
    final name = '${s.str('firstName')} ${s.str('lastName')}';
    final (bg, fg) = Brand.avatarTone(name);
    final alerts = s.strings('alerts');
    final planTotal = s.integer('planTotal');
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: () async {
          await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => CoachStudentScreen(studentId: s.str('id'), name: name)));
          onChanged();
        },
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              CircleAvatar(backgroundColor: bg, foregroundColor: fg, child: Text(s.str('firstName').characters.first)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(name, style: theme.textTheme.titleMedium),
                  Text([s.strOrNull('gradeName'), s.strOrNull('targetExam'), if (meetingText(s.objOrNull('meeting')).isNotEmpty) meetingText(s.objOrNull('meeting'))].whereType<String>().join(' · '), style: theme.textTheme.bodySmall),
                ]),
              ),
              const Icon(Icons.chevron_right_rounded),
            ]),
            const SizedBox(height: 10),
            Wrap(spacing: 6, runSpacing: 6, children: [
              Pill('${numText(s.integer('solvedThisWeek'))} soru'),
              if (planTotal > 0) Pill('Program ${s.integer('planDone')}/$planTotal'),
              if (s.numOrNull('lastNet') != null)
                Pill(
                  '${s.str('netKind')} ${netText(s.numOrNull('lastNet')!)}${s.numOrNull('netChange') != null && s.numOrNull('netChange') != 0 ? ' (${s.numOrNull('netChange')! > 0 ? '+' : ''}${netText(s.numOrNull('netChange')!)})' : ''}',
                  tone: (s.numOrNull('netChange') ?? 0) < 0 ? Tone.rose : Tone.green,
                ),
              for (final a in alerts) Pill(a, tone: Tone.amber),
            ]),
          ]),
        ),
      ),
    );
  }
}
