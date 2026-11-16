import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/adaptive.dart';
import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/pi_logo.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../account/account_screen.dart';
import '../meeting/meeting_screen.dart';
import 'coach_student.dart';

/// Koç: "Bugün" kartı (günün görüşmesi), öğrenci kartları (iki sütun) ve hesap.
/// Program yazma, PDF aktarımı, tahsilat sitede.
class CoachHome extends StatefulWidget {
  const CoachHome({super.key});

  @override
  State<CoachHome> createState() => _CoachHomeState();
}

class _CoachHomeState extends State<CoachHome> {
  int _tab = 0;
  late Future<Json> _data = _load();
  String _query = '';
  bool _searching = false;

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
      selectedIndex: _tab,
      onSelect: (i) => setState(() => _tab = i),
      items: const [
        NavItem(icon: Icons.groups_outlined, selectedIcon: Icons.groups_rounded, label: 'Öğrenciler'),
        NavItem(icon: Icons.person_outline_rounded, selectedIcon: Icons.person_rounded, label: 'Hesabım'),
      ],
      body: SafeArea(
        bottom: false,
        child: IndexedStack(
          index: _tab,
          children: [
            if (twoPane)
              Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(width: 420, child: list),
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
            const Readable(child: AccountScreen(showTitle: true)),
          ],
        ),
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
    final weekSolved = all.fold<int>(0, (t, s) => t + s.integer('solvedThisWeek'));
    final me = SessionScope.of(context).me!;
    final todayWeekday = DateTime.tryParse(d.str('today'))?.weekday;
    // Bugünkü görüşmeler (öğrencinin haftalık görüşme günü bugünse), saate göre
    final todays = all.where((s) => (s.objOrNull('meeting')?['weekday'] as num?)?.toInt() == todayWeekday).toList()
      ..sort((a, b) => ((a.objOrNull('meeting')?['minute'] as num?) ?? 0).compareTo((b.objOrNull('meeting')?['minute'] as num?) ?? 0));
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      children: [
        Row(
          children: [
            const PiBadge(size: 36),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Merhaba ${me.firstName}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontFamily: AppTheme.displayFamily, fontSize: 22, fontWeight: FontWeight.w800, color: Brand.ink900),
              ),
            ),
            _SquareButton(
              icon: _searching ? Icons.close_rounded : Icons.search_rounded,
              tooltip: _searching ? 'Aramayı kapat' : 'Öğrenci ara',
              onTap: () => setState(() {
                _searching = !_searching;
                if (!_searching) _query = '';
              }),
            ),
          ],
        ),
        if (_searching) ...[
          const SizedBox(height: 12),
          TextField(
            autofocus: true,
            decoration: const InputDecoration(prefixIcon: Icon(Icons.search_rounded), hintText: 'Öğrenci ara'),
            onChanged: (v) => setState(() => _query = v),
          ),
        ],
        const SizedBox(height: 16),
        _TodayCard(
          today: d.str('today'),
          meetings: todays,
          weekSolved: weekSolved,
          studentCount: all.length,
          onMeet: (s) => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => MeetingScreen(studentId: s.str('id')))),
        ),
        if (!center.flag('writable'))
          const _Banner(text: 'Abonelik süresi doldu: panel salt okunur. Kayıtlarınız duruyor; paket kodunuz varsa Hesap → Paketler bölümünden girebilirsiniz.')
        else if (center.str('status') == 'TRIAL' && center.strOrNull('trialEndsAt') != null)
          _Banner(text: 'Ücretsiz deneme ${dayMonth(center.str('trialEndsAt').substring(0, 10))} tarihine kadar.', soft: true),
        const SizedBox(height: 18),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Text.rich(
                TextSpan(
                  children: [
                    const TextSpan(text: 'Öğrencilerim '),
                    TextSpan(
                      text: '${all.length}/${center.integer('studentLimit')}',
                      style: const TextStyle(color: Brand.ink400, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
                style: const TextStyle(fontFamily: AppTheme.displayFamily, fontSize: 19, fontWeight: FontWeight.w800, color: Brand.ink900),
              ),
            ),
            TextButton(
              onPressed: () => launchUrl(Uri.parse('${AppConfig.siteUrl}/koc'), mode: LaunchMode.externalApplication),
              child: const Text(
                'Sitede yönet',
                style: TextStyle(color: Brand.b700, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        if (all.isEmpty)
          const _Banner(text: 'Henüz öğrenci yok. İlk öğrencinizi sitedeki panelden ekleyin; burada görünür.', soft: true)
        else
          LayoutBuilder(
            builder: (context, box) {
              const gap = 10.0;
              final w = (box.maxWidth - gap) / 2;
              return Wrap(
                spacing: gap,
                runSpacing: gap,
                children: [
                  for (final s in students)
                    SizedBox(
                      width: w,
                      child: _StudentCard(student: s, todayWeekday: todayWeekday, selected: twoPane && s.str('id') == _selectedId, onOpen: (name) => _open(s.str('id'), name, twoPane)),
                    ),
                ],
              );
            },
          ),
      ],
    );
  }
}

class _SquareButton extends StatelessWidget {
  const _SquareButton({required this.icon, required this.tooltip, required this.onTap});

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: Brand.ink100),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: SizedBox.square(dimension: 44, child: Icon(icon, size: 21, color: Brand.ink700)),
        ),
      ),
    );
  }
}

/// Mercan "Bugün" kartı: günün görüşmesi ve "Görüşmeyi başlat"; görüşme yoksa haftanın özeti.
class _TodayCard extends StatelessWidget {
  const _TodayCard({required this.today, required this.meetings, required this.weekSolved, required this.studentCount, required this.onMeet});

  final String today;
  final List<Json> meetings;
  final int weekSolved;
  final int studentCount;
  final void Function(Json student) onMeet;

  @override
  Widget build(BuildContext context) {
    final next = meetings.isEmpty ? null : meetings.first;
    const sub = TextStyle(color: Brand.b100, fontSize: 13);
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(color: Brand.b600, borderRadius: BorderRadius.circular(24)),
      child: Stack(
        children: [
          Positioned(right: -40, top: -40, child: PiMark(size: 170, color: Colors.white.withValues(alpha: 0.12))),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'BUGÜN · ${dayMonth(today).toUpperCase()}',
                  style: const TextStyle(color: Brand.b100, fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.8),
                ),
                const SizedBox(height: 12),
                if (next == null) ...[
                  const Text(
                    'Bugün planlı görüşme yok',
                    style: TextStyle(fontFamily: AppTheme.displayFamily, color: Colors.white, fontSize: 19, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  Text('Bu hafta öğrencileriniz ${numText(weekSolved)} soru çözdü · $studentCount öğrenci', style: sub),
                ] else ...[
                  Row(
                    children: [
                      Container(
                        width: 46,
                        height: 46,
                        decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(14)),
                        alignment: Alignment.center,
                        child: Text(
                          next.str('firstName').characters.first.toUpperCase(),
                          style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${next.str('firstName')} ${next.str('lastName')}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontFamily: AppTheme.displayFamily, color: Colors.white, fontSize: 19, fontWeight: FontWeight.w800),
                            ),
                            Text(
                              [
                                if ((next.obj('meeting')['minute'] as num?) != null) timeOf((next.obj('meeting')['minute'] as num).toInt()),
                                'haftalık görüşme',
                                if (meetings.length > 1) '+${meetings.length - 1} görüşme daha',
                              ].join(' · '),
                              style: sub,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  FilledButton.icon(
                    key: const Key('today-meet'),
                    onPressed: () => onMeet(next),
                    style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: Brand.b700, minimumSize: const Size.fromHeight(46), shape: const StadiumBorder()),
                    icon: const Icon(Icons.videocam_rounded, size: 20),
                    label: const Text('Görüşmeyi başlat', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.text, this.soft = false});

  final String text;
  final bool soft;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: soft ? Brand.ink50 : Brand.b50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: soft ? Brand.ink100 : Brand.b200),
      ),
      child: Text(text, style: TextStyle(fontSize: 13, color: soft ? Brand.ink700 : Brand.b800)),
    );
  }
}

/// Öğrenci kartı: avatar, tek durum etiketi, ad, sınıf; bu hafta soru ve program.
class _StudentCard extends StatelessWidget {
  const _StudentCard({required this.student, required this.onOpen, required this.todayWeekday, this.selected = false});

  final Json student;
  final ValueChanged<String> onOpen;
  final int? todayWeekday;
  final bool selected;

  /// En önemli tek durum: uyarı > net değişimi > bugünkü görüşme > görüşme günü
  (String, bool, Color, Color) _tag() {
    final s = student;
    final alerts = s.strings('alerts');
    final change = s.numOrNull('netChange');
    String short(String a) {
      if (a.contains('net düştü') && change != null) return 'Net ${netText(change)}';
      if (a.contains('soru girilmedi')) return '2 hafta sessiz';
      if (a.contains('program geride')) return 'Program geride';
      if (a.contains('2 haftadır görüşme')) return 'Görüşme gecikti';
      if (a.contains('Henüz görüşme')) return 'Görüşme yok';
      return a;
    }

    if (alerts.isNotEmpty) return (short(alerts.first), true, Brand.b100, Brand.b800);
    if (change != null && change > 0) return ('Net +${netText(change)}', false, const Color(0xFFDDF5EC), const Color(0xFF11684A));
    final meeting = s.objOrNull('meeting');
    final weekday = (meeting?['weekday'] as num?)?.toInt();
    final minute = (meeting?['minute'] as num?)?.toInt();
    if (weekday != null && weekday == todayWeekday) return ('Bugün${minute != null ? ' ${timeOf(minute)}' : ''}', false, Brand.ink50, Brand.ink700);
    if (weekday != null && weekday >= 1 && weekday <= 7) {
      final day = weekdayNames[weekday - 1];
      return ('${day.length > 3 ? day.substring(0, 3) : day}${minute != null ? ' ${timeOf(minute)}' : ''}', false, Brand.ink50, Brand.ink700);
    }
    return ('Yeni', false, Brand.ink50, Brand.ink700);
  }

  @override
  Widget build(BuildContext context) {
    final s = student;
    final name = '${s.str('firstName')} ${s.str('lastName')}';
    final (avBg, avFg) = Brand.softAvatar(name);
    final (tag, warn, tagBg, tagFg) = _tag();
    final planTotal = s.integer('planTotal');
    final grade = [s.strOrNull('gradeName'), s.strOrNull('targetExam')].whereType<String>().join(' · ');
    return Material(
      color: selected ? Brand.b50 : (warn ? const Color(0xFFFFF8F5) : Colors.white),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: selected ? Brand.b600 : (warn ? Brand.b200 : Brand.ink100), width: selected ? 1.6 : 1),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () => onOpen(name),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(color: avBg, borderRadius: BorderRadius.circular(12)),
                    alignment: Alignment.center,
                    child: Text(
                      s.str('firstName').characters.first.toUpperCase(),
                      style: TextStyle(color: avFg, fontWeight: FontWeight.w800, fontSize: 16),
                    ),
                  ),
                  const Spacer(),
                  Flexible(
                    flex: 4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(color: tagBg, borderRadius: BorderRadius.circular(999)),
                      child: Text(
                        tag,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: tagFg, fontSize: 11, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: Brand.ink900),
              ),
              Text(
                grade.isEmpty ? ' ' : grade,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12, color: Brand.ink500),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: numText(s.integer('solvedThisWeek')),
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Brand.ink900),
                        ),
                        const TextSpan(text: ' soru'),
                      ],
                    ),
                    style: const TextStyle(fontSize: 12, color: Brand.ink500),
                  ),
                  const Spacer(),
                  if (planTotal > 0)
                    Text.rich(
                      TextSpan(
                        children: [
                          const TextSpan(text: 'Program '),
                          TextSpan(
                            text: '${s.integer('planDone')}/$planTotal',
                            style: const TextStyle(fontWeight: FontWeight.w800, color: Brand.ink900),
                          ),
                        ],
                      ),
                      style: const TextStyle(fontSize: 12, color: Brand.ink500),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
