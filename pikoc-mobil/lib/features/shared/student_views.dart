import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

// Öğrencinin verisini gösteren parçalar: öğrenci/veli ekranı ve koçun öğrenci sayfası birlikte kullanır.

/// Bugün, bu hafta soru/çalışma, seri
class WeekStats extends StatelessWidget {
  const WeekStats({super.key, required this.data, this.studentWords = true});

  final Json data;
  final bool studentWords;

  @override
  Widget build(BuildContext context) {
    final stats = data.obj('stats');
    final items = data.list('todayItems');
    final done = items.where((i) => i.flag('done')).length;
    final week = stats.integer('weekSolved'), last = stats.integer('lastWeekSolved');
    return StatGrid(children: [
      StatTile(icon: Icons.check_circle_outline_rounded, label: 'Bugünkü görev', value: items.isEmpty ? '—' : '$done/${items.length}'),
      StatTile(icon: Icons.track_changes_rounded, label: 'Bu hafta soru', value: numText(week), hint: last > 0 ? 'Geçen hafta ${numText(last)}' : null),
      StatTile(icon: Icons.timer_outlined, label: 'Bu hafta çalışma', value: stats.integer('weekStudyMinutes') > 0 ? minutesText(stats.integer('weekStudyMinutes')) : '—'),
      StatTile(icon: Icons.local_fire_department_rounded, label: 'Seri', value: stats.integer('streak') > 0 ? '${stats.integer('streak')} gün' : '—', hint: studentWords ? 'Soru girdiğin ardışık gün' : 'Soru girilen ardışık gün', color: Brand.gold600),
    ]);
  }
}

/// Bugünkü görevler (işaretlenebilir)
class TodayTasks extends StatelessWidget {
  const TodayTasks({super.key, required this.items, this.onToggle, this.emptyText = 'Bugün için görev yok. Koçun programı yazınca burada görünür.'});

  final List<Json> items;
  final Future<void> Function(Json item, bool done)? onToggle;
  final String emptyText;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return EmptyNote(emptyText);
    return Column(children: [for (final i in items) TaskTile(item: i, onToggle: onToggle)]);
  }
}

class TaskTile extends StatefulWidget {
  const TaskTile({super.key, required this.item, this.onToggle});

  final Json item;
  final Future<void> Function(Json item, bool done)? onToggle;

  @override
  State<TaskTile> createState() => _TaskTileState();
}

class _TaskTileState extends State<TaskTile> {
  late bool _done = widget.item.flag('done');
  bool _busy = false;

  @override
  void didUpdateWidget(TaskTile old) {
    super.didUpdateWidget(old);
    _done = widget.item.flag('done');
  }

  @override
  Widget build(BuildContext context) {
    final i = widget.item;
    final theme = Theme.of(context);
    final meta = [i.strOrNull('resource'), i.intOrNull('targetQuestions') != null ? 'Hedef ${i.integer('targetQuestions')} soru' : null, i.strOrNull('note')].whereType<String>().where((s) => s.isNotEmpty).join(' · ');
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: widget.onToggle == null || _busy
          ? null
          : () async {
              final next = !_done;
              setState(() {
                _done = next;
                _busy = true;
              });
              try {
                await widget.onToggle!(i, next);
              } catch (e) {
                if (context.mounted) showMessage(context, errorText(e), error: true);
                setState(() => _done = !next);
              } finally {
                if (mounted) setState(() => _busy = false);
              }
            },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(_done ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded, color: _done ? const Color(0xFF059669) : theme.colorScheme.outline),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text.rich(
                TextSpan(children: [
                  TextSpan(text: i.str('subject'), style: const TextStyle(fontWeight: FontWeight.w700)),
                  if (i.strOrNull('topic')?.isNotEmpty ?? false) TextSpan(text: ' · ${i.str('topic')}'),
                ]),
                style: TextStyle(decoration: _done ? TextDecoration.lineThrough : null, color: _done ? theme.colorScheme.onSurfaceVariant : null),
              ),
              if (meta.isNotEmpty) Text(meta, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
            ]),
          ),
        ]),
      ),
    );
  }
}

/// Son 14 gün soru grafiği + derslere göre doğruluk
class QuestionCharts extends StatelessWidget {
  const QuestionCharts({super.key, required this.stats});

  final Json stats;

  @override
  Widget build(BuildContext context) {
    final days = stats.list('questionDays');
    final subjects = stats.list('subjects');
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      MiniBars(values: days.map((d) => d.integer('solved')).toList(), labels: days.map((d) => d.str('date').substring(8)).toList()),
      const SizedBox(height: 14),
      if (subjects.isEmpty) const EmptyNote('Son 30 günde soru kaydı yok.'),
      for (final s in subjects.take(8))
        RatioBar(label: s.str('subject'), ratio: s.numOrNull('accuracy') ?? 0, trailing: '${numText(s.integer('solved'))} soru · ${percent(s.numOrNull('accuracy'))}'),
    ]);
  }
}

class StudyChart extends StatelessWidget {
  const StudyChart({super.key, required this.stats});

  final Json stats;

  @override
  Widget build(BuildContext context) {
    final days = stats.list('studyDays');
    return MiniBars(values: days.map((d) => d.integer('minutes')).toList(), labels: days.map((d) => d.str('date').substring(8)).toList(), color: Brand.iris500);
  }
}

/// Hedef kartları: hedef net ve kalan
class GoalsView extends StatelessWidget {
  const GoalsView({super.key, required this.goals});

  final List<Json> goals;

  @override
  Widget build(BuildContext context) {
    if (goals.isEmpty) return const EmptyNote('Henüz hedef yok. Hedefi koçunla birlikte belirleyin.');
    final theme = Theme.of(context);
    return Column(children: [
      for (final g in goals)
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('${g.str('kindLabel')} · ${netText(g.numOrNull('targetNet') ?? 0)} net${g.strOrNull('label') != null ? ' · ${g.str('label')}' : ''}', style: theme.textTheme.titleSmall),
            const SizedBox(height: 4),
            if (g.numOrNull('current') != null)
              RatioBar(
                label: 'Son deneme ${netText(g.numOrNull('current')!)} net',
                ratio: (g.numOrNull('current')! / (g.numOrNull('targetNet') ?? 1)).clamp(0, 1).toDouble(),
                trailing: g.numOrNull('gap') == 0 ? 'Hedefe ulaşıldı' : '${netText(g.numOrNull('gap') ?? 0)} net kaldı',
              )
            else
              Text('Bu türde deneme girilince ilerleme görünür.', style: theme.textTheme.bodySmall),
          ]),
        ),
    ]);
  }
}

/// Deneme listesi
class ExamList extends StatelessWidget {
  const ExamList({super.key, required this.exams, this.onDelete, this.byStudentLabel = 'Sen girdin'});

  final List<Json> exams;
  final Future<void> Function(Json exam)? onDelete;
  final String byStudentLabel;

  @override
  Widget build(BuildContext context) {
    if (exams.isEmpty) return const EmptyNote('Henüz deneme sonucu yok.');
    final theme = Theme.of(context);
    return Column(children: [
      for (final e in exams)
        Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: theme.colorScheme.surfaceContainerLow, borderRadius: BorderRadius.circular(14)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(e.str('name'), style: const TextStyle(fontWeight: FontWeight.w700)),
                  Text('${e.str('kindLabel')} · ${dayMonth(e.str('date'))}', style: theme.textTheme.bodySmall),
                ]),
              ),
              Text(netText(e.numOrNull('net') ?? 0), style: theme.textTheme.titleLarge),
              const Text(' net'),
              if (onDelete != null && e.flag('byStudent'))
                IconButton(tooltip: 'Sil', icon: const Icon(Icons.delete_outline_rounded, size: 20), onPressed: () => onDelete!(e)),
            ]),
            const SizedBox(height: 6),
            Wrap(spacing: 6, runSpacing: 6, children: [
              if (e.flag('byStudent')) Pill(byStudentLabel, tone: Tone.violet),
              for (final s in e.list('sections')) Pill('${s.str('name')} ${netText(s.numOrNull('net') ?? 0)}'),
            ]),
          ]),
        ),
    ]);
  }
}

/// Soru ve çalışma kayıtları listesi
class LogList extends StatelessWidget {
  const LogList({super.key, required this.rows, required this.title, required this.subtitle, this.onDelete, this.byStudentLabel = 'Sen girdin'});

  final List<Json> rows;
  final String Function(Json row) title;
  final String Function(Json row) subtitle;
  final Future<void> Function(Json row)? onDelete;
  final String byStudentLabel;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return const EmptyNote('Henüz kayıt yok.');
    return Column(children: [
      for (final r in rows)
        ListTile(
          contentPadding: EdgeInsets.zero,
          dense: true,
          title: Text(title(r), style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text(subtitle(r)),
          trailing: onDelete != null && r.flag('byStudent')
              ? IconButton(tooltip: 'Sil', icon: const Icon(Icons.delete_outline_rounded, size: 20), onPressed: () => onDelete!(r))
              : r.flag('byStudent')
                  ? Pill(byStudentLabel, tone: Tone.violet)
                  : null,
        ),
    ]);
  }
}

/// Haftalık program: gün gün görevler ve koç notları
class WeekProgram extends StatelessWidget {
  const WeekProgram({super.key, required this.data, required this.onWeek, this.onToggle});

  final Json data;
  final ValueChanged<String> onWeek;
  final Future<void> Function(Json item, bool done)? onToggle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final start = data.str('weekStart');
    final items = data.list('items');
    final today = data.str('today');
    final done = items.where((i) => i.flag('done')).length;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Row(children: [
          IconButton(tooltip: 'Önceki hafta', onPressed: () => onWeek(addDays(start, -7)), icon: const Icon(Icons.chevron_left_rounded)),
          Expanded(child: Text('${dayMonth(start)} – ${dayMonth(data.str('weekEnd'))}', textAlign: TextAlign.center, style: theme.textTheme.titleMedium)),
          IconButton(tooltip: 'Sonraki hafta', onPressed: () => onWeek(addDays(start, 7)), icon: const Icon(Icons.chevron_right_rounded)),
        ]),
        if (items.isNotEmpty) RatioBar(label: 'Haftanın görevleri', ratio: done / items.length, trailing: '$done/${items.length}'),
        if (items.isEmpty) const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: EmptyNote('Bu hafta için program yazılmamış.')),
        for (var d = 0; d < 7; d++)
          Builder(builder: (context) {
            final day = addDays(start, d);
            final dayItems = items.where((i) => i.str('date') == day).toList();
            if (dayItems.isEmpty) return const SizedBox.shrink();
            return SectionCard(
              title: longDay(day),
              action: day == today ? const Padding(padding: EdgeInsets.only(right: 8), child: Pill('Bugün', tone: Tone.brand)) : null,
              child: TodayTasks(items: dayItems, onToggle: onToggle),
            );
          }),
        if (data.list('notes').isNotEmpty) ...[
          const SizedBox(height: 8),
          Text('Koç notları', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          for (final n in data.list('notes'))
            SectionCard(
              title: longDay(n.str('date')),
              subtitle: n.flag('held') ? 'Görüşme yapıldı' : 'Görüşme yapılmadı',
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (n.strOrNull('notes')?.isNotEmpty ?? false) Text(n.str('notes')),
                if (n.strings('priorityTopics').isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Wrap(spacing: 6, runSpacing: 6, children: [for (final t in n.strings('priorityTopics')) Pill(t, tone: Tone.amber)]),
                ],
                if (n.strOrNull('nextGoal')?.isNotEmpty ?? false) Padding(padding: const EdgeInsets.only(top: 8), child: Text('Hedef: ${n.str('nextGoal')}', style: const TextStyle(fontWeight: FontWeight.w600))),
              ]),
            ),
        ],
      ],
    );
  }
}
