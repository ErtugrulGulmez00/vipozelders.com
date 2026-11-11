import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../account/account_screen.dart';
import '../meeting/meeting_screen.dart';
import '../shared/student_views.dart';
import 'forms.dart';
import 'study_timer.dart';

/// Öğrenci / veli: bağlantı seçimi ve alt sekmeler (Bugün, Program, Kayıtlar, Denemeler, Hesap).
class StudentHome extends StatefulWidget {
  const StudentHome({super.key});

  @override
  State<StudentHome> createState() => _StudentHomeState();
}

class _StudentHomeState extends State<StudentHome> {
  late Future<List<Json>> _links = _loadLinks();
  String? _linkId;
  int _tab = 0;

  Future<List<Json>> _loadLinks() async {
    final res = await SessionScope.read(context).api.get('/koc/ogrenci');
    return res.list('items');
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Json>>(
      future: _links,
      builder: (context, snap) {
        if (snap.hasError) return Scaffold(body: ErrorView(message: errorText(snap.error!), onRetry: () => setState(() => _links = _loadLinks())));
        if (!snap.hasData) return const Scaffold(body: Center(child: CircularProgressIndicator()));
        final links = snap.data!;
        if (links.isEmpty) {
          return Scaffold(
            appBar: AppBar(title: const Text('Pi Koç')),
            body: ErrorView(message: 'Hesabına bağlı bir Pi Koç öğrencisi yok. Koçunla görüş.', onRetry: () => setState(() => _links = _loadLinks())),
          );
        }
        final link = links.firstWhere((l) => l.str('id') == _linkId, orElse: () => links.first);
        final id = link.str('id');
        final pages = [
          _TodayTab(key: ValueKey('bugun-$id'), linkId: id),
          _ProgramTab(key: ValueKey('program-$id'), linkId: id),
          _RecordsTab(key: ValueKey('kayit-$id'), linkId: id),
          _ExamsTab(key: ValueKey('deneme-$id'), linkId: id),
          const AccountScreen(),
        ];
        const titles = ['Bugün', 'Haftalık program', 'Soru ve çalışma', 'Denemeler ve hedef', 'Hesabım'];
        return Scaffold(
          appBar: AppBar(
            title: Text(titles[_tab]),
            actions: [
              if (links.length > 1)
                PopupMenuButton<String>(
                  tooltip: 'Öğrenci seç',
                  icon: const Icon(Icons.swap_horiz_rounded),
                  onSelected: (v) => setState(() => _linkId = v),
                  itemBuilder: (_) => [
                    for (final l in links) PopupMenuItem(value: l.str('id'), child: Text('${l.obj('student').str('firstName')} ${l.obj('student').str('lastName')}')),
                  ],
                ),
            ],
          ),
          // Sekme her açılışta güncel veriyi yükler (bir sekmede girilen kayıt diğerinde de görünür)
          body: pages[_tab],
          bottomNavigationBar: NavigationBar(
            selectedIndex: _tab,
            onDestinationSelected: (i) => setState(() => _tab = i),
            destinations: const [
              NavigationDestination(icon: Icon(Icons.today_outlined), selectedIcon: Icon(Icons.today_rounded), label: 'Bugün'),
              NavigationDestination(icon: Icon(Icons.calendar_view_week_outlined), selectedIcon: Icon(Icons.calendar_view_week_rounded), label: 'Program'),
              NavigationDestination(icon: Icon(Icons.edit_note_outlined), selectedIcon: Icon(Icons.edit_note_rounded), label: 'Kayıtlar'),
              NavigationDestination(icon: Icon(Icons.insights_outlined), selectedIcon: Icon(Icons.insights_rounded), label: 'Denemeler'),
              NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded), label: 'Hesap'),
            ],
          ),
        );
      },
    );
  }
}

/// Sekmelerin ortak yükleyicisi: ana ekran verisi (GET /koc/ogrenci/{id}), aşağı çekince yenilenir.
mixin _HomeData<T extends StatefulWidget> on State<T> {
  String get linkId;
  late Future<Json> data = load();

  Future<Json> load() => SessionScope.read(context).api.get('/koc/ogrenci/$linkId');

  Future<void> reload() async {
    final next = load();
    setState(() => data = next);
    await next.catchError((_) => <String, dynamic>{});
  }

  Future<void> toggle(Json item, bool done) async {
    await SessionScope.read(context).api.post('/koc/ogrenci/$linkId/gorev/${item.str('id')}', {'done': done});
    // Sayaçlar (bugünkü görev x/y) yeniden istek atmadan güncellenir
    item['done'] = done;
    if (mounted) setState(() {});
  }

  Future<void> openForm(Widget form) async {
    final saved = await showFormSheet(context, form);
    if (saved == true) {
      if (mounted) showMessage(context, 'Kaydedildi.');
      reload();
    }
  }

  Future<void> deleteRow(String path, String question) async {
    if (!await confirm(context, question, ok: 'Sil')) return;
    if (!mounted) return;
    try {
      await SessionScope.read(context).api.delete(path);
      reload();
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    }
  }

  Widget page(Widget Function(Json d) builder) => AsyncView<Json>(
        future: data,
        onRetry: reload,
        builder: (context, d) => RefreshIndicator(onRefresh: reload, child: builder(d)),
      );
}

class _TodayTab extends StatefulWidget {
  const _TodayTab({super.key, required this.linkId});

  final String linkId;

  @override
  State<_TodayTab> createState() => _TodayTabState();
}

class _TodayTabState extends State<_TodayTab> with _HomeData<_TodayTab> {
  @override
  String get linkId => widget.linkId;

  @override
  Widget build(BuildContext context) {
    return page((d) {
      final student = d.obj('student');
      final canWrite = d.flag('canWrite');
      final subjects = d.strings('subjects');
      final items = d.list('todayItems');
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          HeroHeader(
            overline: '${d.str('coachName')} · ${longDay(d.str('today'))}',
            title: d.flag('isStudent') ? 'Merhaba ${student.str('firstName')}' : '${student.str('firstName')} ${student.str('lastName')}',
            lines: [
              [student.strOrNull('gradeName'), student.strOrNull('targetExam')].whereType<String>().join(' · '),
              if (meetingText(d.objOrNull('meeting')).isNotEmpty) 'Koç görüşmesi: ${meetingText(d.objOrNull('meeting'))}',
            ],
            action: FilledButton.icon(
              key: const Key('join-meeting'),
              style: FilledButton.styleFrom(backgroundColor: Brand.b600),
              onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => MeetingScreen(studentId: student.str('id')))),
              icon: const Icon(Icons.videocam_rounded),
              label: const Text('Görüşmeye katıl'),
            ),
          ),
          WeekStats(data: d, studentWords: d.flag('isStudent')),
          SectionCard(
            title: d.flag('isStudent') ? 'Bugünkü görevlerin' : 'Bugünkü görevler',
            subtitle: items.isEmpty ? null : '${items.where((i) => i.flag('done')).length}/${items.length} tamamlandı',
            child: TodayTasks(items: items, onToggle: toggle),
          ),
          if (canWrite) ...[
            SectionCard(
              title: 'Çalışma sayacı',
              subtitle: 'Başlat, bitince kaydet; koçun görür.',
              child: StudyTimer(linkId: linkId, studentId: student.str('id'), subjects: subjects, onSaved: reload),
            ),
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  key: const Key('add-questions'),
                  onPressed: () => openForm(QuestionLogForm(linkId: linkId, subjects: subjects)),
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('Soru gir'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => openForm(StudyForm(linkId: linkId, subjects: subjects)),
                  icon: const Icon(Icons.more_time_rounded),
                  label: const Text('Süre gir'),
                ),
              ),
            ]),
          ] else if (d.flag('isStudent'))
            const EmptyNote('Koçunun aboneliği yenilenene kadar yeni kayıt girilemiyor; kayıtların duruyor.'),
        ],
      );
    });
  }
}

class _ProgramTab extends StatefulWidget {
  const _ProgramTab({super.key, required this.linkId});

  final String linkId;

  @override
  State<_ProgramTab> createState() => _ProgramTabState();
}

class _ProgramTabState extends State<_ProgramTab> {
  String? _week;
  late Future<Json> _data = _load();

  Future<Json> _load() => SessionScope.read(context).api.get('/koc/ogrenci/${widget.linkId}/program', query: {if (_week != null) 'hafta': _week});

  Future<void> _reload() async {
    final next = _load();
    setState(() => _data = next);
    await next.catchError((_) => <String, dynamic>{});
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<Json>(
      future: _data,
      onRetry: _reload,
      builder: (context, d) => RefreshIndicator(
        onRefresh: _reload,
        child: WeekProgram(
          data: d,
          onWeek: (w) {
            _week = w;
            _reload();
          },
          onToggle: (item, done) => SessionScope.read(context).api.post('/koc/ogrenci/${widget.linkId}/gorev/${item.str('id')}', {'done': done}),
        ),
      ),
    );
  }
}

class _RecordsTab extends StatefulWidget {
  const _RecordsTab({super.key, required this.linkId});

  final String linkId;

  @override
  State<_RecordsTab> createState() => _RecordsTabState();
}

class _RecordsTabState extends State<_RecordsTab> with _HomeData<_RecordsTab> {
  @override
  String get linkId => widget.linkId;

  @override
  Widget build(BuildContext context) {
    return page((d) {
      final canWrite = d.flag('canWrite');
      final subjects = d.strings('subjects');
      final stats = d.obj('stats');
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          if (canWrite)
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Row(children: [
                Expanded(child: FilledButton.icon(onPressed: () => openForm(QuestionLogForm(linkId: linkId, subjects: subjects)), icon: const Icon(Icons.add_rounded), label: const Text('Soru gir'))),
                const SizedBox(width: 10),
                Expanded(child: FilledButton.tonalIcon(onPressed: () => openForm(StudyForm(linkId: linkId, subjects: subjects)), icon: const Icon(Icons.more_time_rounded), label: const Text('Süre gir'))),
              ]),
            ),
          SectionCard(title: 'Son 14 gün çözülen soru', subtitle: 'Derslere göre doğruluk: son 30 gün', child: QuestionCharts(stats: stats)),
          SectionCard(
            title: 'Son 14 gün çalışma',
            subtitle: 'Bu hafta ${minutesText(stats.integer('weekStudyMinutes'))} · geçen hafta ${minutesText(stats.integer('lastWeekStudyMinutes'))}',
            child: StudyChart(stats: stats),
          ),
          SectionCard(
            title: 'Soru kayıtları',
            child: LogList(
              rows: d.list('questionLogs'),
              title: (r) => '${r.str('subject')} · ${r.integer('solved')} soru',
              subtitle: (r) => '${dayMonth(r.str('date'))} · ${r.integer('correct')} doğru, ${r.integer('wrong')} yanlış',
              byStudentLabel: d.flag('isStudent') ? 'Sen girdin' : 'Öğrenci girdi',
              onDelete: canWrite ? (r) => deleteRow('/koc/ogrenci/$linkId/soru/${r.str('id')}', 'Bu soru kaydı silinsin mi?') : null,
            ),
          ),
          SectionCard(
            title: 'Çalışma kayıtları',
            child: LogList(
              rows: d.list('studySessions'),
              title: (r) => '${r.strOrNull('subject') ?? 'Genel'} · ${minutesText(r.integer('minutes'))}',
              subtitle: (r) => dayMonth(r.str('date')),
              byStudentLabel: d.flag('isStudent') ? 'Sen girdin' : 'Öğrenci girdi',
              onDelete: canWrite ? (r) => deleteRow('/koc/ogrenci/$linkId/calisma/${r.str('id')}', 'Bu çalışma kaydı silinsin mi?') : null,
            ),
          ),
        ],
      );
    });
  }
}

class _ExamsTab extends StatefulWidget {
  const _ExamsTab({super.key, required this.linkId});

  final String linkId;

  @override
  State<_ExamsTab> createState() => _ExamsTabState();
}

class _ExamsTabState extends State<_ExamsTab> with _HomeData<_ExamsTab> {
  @override
  String get linkId => widget.linkId;

  Future<void> _addExam() async {
    try {
      final res = await SessionScope.read(context).api.get('/koc/sinavlar');
      if (!mounted) return;
      await openForm(ExamForm(linkId: linkId, kinds: res.list('kinds')));
    } catch (e) {
      if (mounted) showMessage(context, errorText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return page((d) {
      final canWrite = d.flag('canWrite');
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          if (canWrite) Padding(padding: const EdgeInsets.only(bottom: 14), child: FilledButton.icon(onPressed: _addExam, icon: const Icon(Icons.add_rounded), label: const Text('Deneme sonucumu gir'))),
          SectionCard(title: 'Hedef', child: GoalsView(goals: d.list('goals'))),
          SectionCard(
            title: 'Denemeler',
            subtitle: 'Koçunun girdiği ve senin girdiğin sonuçlar',
            child: ExamList(
              exams: d.list('exams'),
              byStudentLabel: d.flag('isStudent') ? 'Sen girdin' : 'Öğrenci girdi',
              onDelete: canWrite ? (e) => deleteRow('/koc/ogrenci/$linkId/deneme/${e.str('id')}', 'Bu deneme sonucu silinsin mi?') : null,
            ),
          ),
        ],
      );
    });
  }
}
