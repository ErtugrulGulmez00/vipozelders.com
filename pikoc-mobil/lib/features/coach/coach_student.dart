import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../meeting/meeting_screen.dart';
import '../shared/student_views.dart';

/// Koçun öğrenci sayfası: özet, program, kayıtlar, denemeler; online görüşme.
class CoachStudentScreen extends StatefulWidget {
  const CoachStudentScreen({super.key, required this.studentId, required this.name});

  final String studentId;
  final String name;

  @override
  State<CoachStudentScreen> createState() => _CoachStudentScreenState();
}

class _CoachStudentScreenState extends State<CoachStudentScreen> {
  late Future<Json> _data = _load();
  late Future<Json> _program = _loadProgram();
  String? _week;

  Future<Json> _load() => SessionScope.read(context).api.get('/koc/panel/ogrenci/${widget.studentId}');
  Future<Json> _loadProgram() => SessionScope.read(context).api.get('/koc/panel/ogrenci/${widget.studentId}/program', query: {if (_week != null) 'hafta': _week});

  Future<void> _reload() async {
    final next = _load();
    setState(() => _data = next);
    await next.catchError((_) => <String, dynamic>{});
  }

  void _meet() => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => MeetingScreen(studentId: widget.studentId)));

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.name),
          actions: [
            IconButton(tooltip: 'Sitede aç', icon: const Icon(Icons.open_in_new_rounded), onPressed: () => launchUrl(Uri.parse('${AppConfig.siteUrl}/koc/ogrenciler/${widget.studentId}'), mode: LaunchMode.externalApplication)),
          ],
          bottom: const TabBar(isScrollable: true, tabAlignment: TabAlignment.start, tabs: [Tab(text: 'Genel bakış'), Tab(text: 'Program'), Tab(text: 'Soru ve çalışma'), Tab(text: 'Denemeler')]),
        ),
        floatingActionButton: FloatingActionButton.extended(key: const Key('coach-meet'), onPressed: _meet, icon: const Icon(Icons.videocam_rounded), label: const Text('Online görüşme')),
        body: TabBarView(children: [
          _tab((d) => [
                HeroHeader(
                  overline: [d.obj('student').strOrNull('gradeName'), d.obj('student').strOrNull('targetExam')].whereType<String>().join(' · '),
                  title: widget.name,
                  lines: [
                    if (meetingText(d.objOrNull('meeting')).isNotEmpty) 'Görüşme ${meetingText(d.objOrNull('meeting'))}',
                    d.flag('hasStudentAccount') ? 'Öğrencinin giriş hesabı var' : 'Öğrencinin giriş hesabı yok (sitede Bilgiler sekmesinden açın)',
                  ],
                ),
                WeekStats(data: d, studentWords: false),
                SectionCard(title: 'Bugünkü görevler', child: TodayTasks(items: d.list('todayItems'), emptyText: 'Bugün için görev yok.')),
                SectionCard(title: 'Hedef', child: GoalsView(goals: d.list('goals'))),
              ]),
          FutureBuilder<Json>(
            future: _program,
            builder: (context, snap) {
              if (snap.hasError) return ErrorView(message: errorText(snap.error!), onRetry: () => setState(() => _program = _loadProgram()));
              if (!snap.hasData) return const Center(child: CircularProgressIndicator());
              return WeekProgram(
                data: snap.data!,
                onWeek: (w) => setState(() {
                  _week = w;
                  _program = _loadProgram();
                }),
              );
            },
          ),
          _tab((d) => [
                SectionCard(title: 'Son 14 gün çözülen soru', subtitle: 'Derslere göre doğruluk: son 30 gün', child: QuestionCharts(stats: d.obj('stats'))),
                SectionCard(title: 'Son 14 gün çalışma', subtitle: 'Bu hafta ${minutesText(d.obj('stats').integer('weekStudyMinutes'))}', child: StudyChart(stats: d.obj('stats'))),
                SectionCard(
                  title: 'Soru kayıtları',
                  child: LogList(
                    rows: d.list('questionLogs'),
                    title: (r) => '${r.str('subject')} · ${r.integer('solved')} soru',
                    subtitle: (r) => '${dayMonth(r.str('date'))} · ${r.integer('correct')} doğru, ${r.integer('wrong')} yanlış',
                    byStudentLabel: 'Öğrenci girdi',
                  ),
                ),
                SectionCard(
                  title: 'Çalışma kayıtları',
                  child: LogList(rows: d.list('studySessions'), title: (r) => '${r.strOrNull('subject') ?? 'Genel'} · ${minutesText(r.integer('minutes'))}', subtitle: (r) => dayMonth(r.str('date')), byStudentLabel: 'Öğrenci girdi'),
                ),
              ]),
          _tab((d) => [SectionCard(title: 'Denemeler', child: ExamList(exams: d.list('exams'), byStudentLabel: 'Öğrenci girdi'))]),
        ]),
      ),
    );
  }

  Widget _tab(List<Widget> Function(Json d) children) => AsyncView<Json>(
        future: _data,
        onRetry: _reload,
        builder: (context, d) => RefreshIndicator(
          onRefresh: _reload,
          child: ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.fromLTRB(16, 12, 16, 96), children: children(d)),
        ),
      );
}

// Koçun öğrenci kartında da kullanılan renk
const coachAccent = Brand.b600;
