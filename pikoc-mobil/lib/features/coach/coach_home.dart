import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/adaptive.dart';
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

  /// İki bölmeli düzende sağda açık olan öğrenci
  String? _selectedId;
  String _selectedName = '';

  Future<Json> _load() => SessionScope.read(context).api.get('/koc/panel');

  Future<void> _reload() async {
    final next = _load();
    setState(() => _data = next);
    await next.catchError((_) => <String, dynamic>{});
  }

  @override
  Widget build(BuildContext context) {
    final twoPane = Breakpoints.useTwoPane(context);
    final list = AsyncView<Json>(
      future: _data,
      onRetry: _reload,
      builder: (context, d) => RefreshIndicator(onRefresh: _reload, child: _list(d, twoPane)),
    );
    return AppNavScaffold(
      appBar: AppBar(title: Text(_tab == 0 ? 'Öğrencilerim' : 'Hesabım')),
      selectedIndex: _tab,
      onSelect: (i) => setState(() => _tab = i),
      items: const [
        NavItem(icon: Icons.groups_outlined, selectedIcon: Icons.groups_rounded, label: 'Öğrenciler'),
        NavItem(icon: Icons.person_outline_rounded, selectedIcon: Icons.person_rounded, label: 'Hesap'),
      ],
      body: IndexedStack(
        index: _tab,
        children: [
          if (twoPane)
            Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(width: 400, child: list),
                VerticalDivider(width: 1, thickness: 1, color: Theme.of(context).colorScheme.outlineVariant),
                Expanded(
                  child: _selectedId == null
                      ? const Center(
                          child: Padding(
                            padding: EdgeInsets.all(32),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.touch_app_outlined, size: 48, color: Brand.ink300),
                                SizedBox(height: 12),
                                Text(
                                  'Soldan bir öğrenci seçin',
                                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Brand.ink700),
                                ),
                                SizedBox(height: 4),
                                Text(
                                  'Programı, kayıtları ve denemeleri burada açılır.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(color: Brand.ink500),
                                ),
                              ],
                            ),
                          ),
                        )
                      : CoachStudentScreen(key: ValueKey(_selectedId), studentId: _selectedId!, name: _selectedName, embedded: true),
                ),
              ],
            )
          else
            Readable(child: list),
          const Readable(child: AccountScreen()),
        ],
      ),
    );
  }

  Future<void> _open(String id, String name, bool twoPane) async {
    if (twoPane) {
      setState(() {
        _selectedId = id;
        _selectedName = name;
      });
      return;
    }
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => CoachStudentScreen(studentId: id, name: name),
      ),
    );
    _reload();
  }

  Widget _list(Json d, bool twoPane) {
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
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.white,
              side: const BorderSide(color: Brand.ink600),
            ),
            onPressed: () => launchUrl(Uri.parse('${AppConfig.siteUrl}/koc'), mode: LaunchMode.externalApplication),
            icon: const Icon(Icons.open_in_new_rounded, size: 18),
            label: const Text('Sitedeki tam panel'),
          ),
        ),
        if (!center.flag('writable')) const SectionCard(title: 'Abonelik süresi doldu', child: Text('Panel salt okunur. Kayıtlarınız duruyor; aboneliği sitede yenileyebilirsiniz.')),
        if (all.length > 5)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: TextField(
              decoration: const InputDecoration(prefixIcon: Icon(Icons.search_rounded), hintText: 'Öğrenci ara'),
              onChanged: (v) => setState(() => _query = v),
            ),
          ),
        if (alerts > 0)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text('$alerts öğrencide dikkat edilecek bir durum var', style: Theme.of(context).textTheme.titleSmall),
          ),
        if (all.isEmpty) const SectionCard(title: 'Henüz öğrenci yok', child: Text('İlk öğrencinizi sitedeki panelden ekleyin; burada görünür.')),
        for (final s in students) _StudentCard(student: s, selected: twoPane && s.str('id') == _selectedId, onOpen: (name) => _open(s.str('id'), name, twoPane)),
      ],
    );
  }
}

class _StudentCard extends StatelessWidget {
  const _StudentCard({required this.student, required this.onOpen, this.selected = false});

  final Json student;
  final ValueChanged<String> onOpen;
  final bool selected;

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
      color: selected ? Brand.b50 : null,
      shape: selected
          ? RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(22),
              side: const BorderSide(color: Brand.b600, width: 1.5),
            )
          : null,
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: () => onOpen(name),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(backgroundColor: bg, foregroundColor: fg, child: Text(s.str('firstName').characters.first)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(name, style: theme.textTheme.titleMedium),
                        Text(
                          [
                            s.strOrNull('gradeName'),
                            s.strOrNull('targetExam'),
                            if (meetingText(s.objOrNull('meeting')).isNotEmpty) meetingText(s.objOrNull('meeting')),
                          ].whereType<String>().join(' · '),
                          style: theme.textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right_rounded),
                ],
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  Pill('${numText(s.integer('solvedThisWeek'))} soru'),
                  if (planTotal > 0) Pill('Program ${s.integer('planDone')}/$planTotal'),
                  if (s.numOrNull('lastNet') != null)
                    Pill(
                      '${s.str('netKind')} ${netText(s.numOrNull('lastNet')!)}${s.numOrNull('netChange') != null && s.numOrNull('netChange') != 0 ? ' (${s.numOrNull('netChange')! > 0 ? '+' : ''}${netText(s.numOrNull('netChange')!)})' : ''}',
                      tone: (s.numOrNull('netChange') ?? 0) < 0 ? Tone.rose : Tone.green,
                    ),
                  for (final a in alerts) Pill(a, tone: Tone.amber),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
