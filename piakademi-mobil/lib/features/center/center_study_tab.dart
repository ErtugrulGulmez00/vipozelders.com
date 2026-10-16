import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/api/pi_api.dart';
import '../../core/format/dates.dart';
import '../../core/format/money.dart';
import '../../core/models/center.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';

/// Haftalık çalışma programı, kaynak/konu ilerlemesi ve koç görüşmeleri.
class CenterStudyTab extends ConsumerStatefulWidget {
  const CenterStudyTab({super.key, required this.guardianId});

  final String guardianId;

  @override
  ConsumerState<CenterStudyTab> createState() => _CenterStudyTabState();
}

class _CenterStudyTabState extends ConsumerState<CenterStudyTab> {
  String? _week;
  final _overrides = <String, bool>{};

  (String, String?) get _key => (widget.guardianId, _week);

  Future<void> _toggle(PlanItem item, bool done) async {
    setState(() => _overrides[item.id] = done);
    try {
      await ref.read(apiProvider).setPlanItemDone(widget.guardianId, item.id, done);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _overrides.remove(item.id));
      showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final week = ref.watch(studyWeekProvider(_key));
    return RefreshIndicator(
      onRefresh: () {
        _overrides.clear();
        return ref.refresh(studyWeekProvider(_key).future);
      },
      child: week.when(
        skipLoadingOnRefresh: true,
        loading: () => const LoadingView(),
        error: (error, _) => RefreshableScroll(onRefresh: () => ref.refresh(studyWeekProvider(_key).future), child: ErrorView(error: error, onRetry: () => ref.invalidate(studyWeekProvider(_key)))),
        data: (data) => _content(context, data),
      ),
    );
  }

  Widget _content(BuildContext context, StudyWeek data) {
    final scheme = Theme.of(context).colorScheme;
    final items = [for (final i in data.items) _overrides.containsKey(i.id) ? i.copyWith(done: _overrides[i.id]) : i];
    final done = items.where((i) => i.done).length;
    final days = [for (var i = 0; i < 7; i++) addDays(data.weekStart, i)];
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.fromLTRB(16, 16, 16, 32 + MediaQuery.paddingOf(context).bottom),
      children: [
        SectionCard(
          title: 'Haftalık çalışma programı',
          subtitle: items.isEmpty ? 'Kurumunuz bu hafta için program girmedi.' : '$done/${items.length} madde tamamlandı',
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                tooltip: 'Önceki hafta',
                visualDensity: VisualDensity.compact,
                onPressed: () => setState(() {
                  _week = addDays(data.weekStart, -7);
                  _overrides.clear();
                }),
                icon: const Icon(Icons.chevron_left_rounded),
              ),
              Text('${formatDayShort(data.weekStart)} – ${formatDayShort(data.weekEnd)}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
              IconButton(
                tooltip: 'Sonraki hafta',
                visualDensity: VisualDensity.compact,
                onPressed: () => setState(() {
                  _week = addDays(data.weekStart, 7);
                  _overrides.clear();
                }),
                icon: const Icon(Icons.chevron_right_rounded),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (items.isNotEmpty) ...[RateBar(value: done / items.length), const SizedBox(height: 12)],
              for (final day in days)
                if (items.any((i) => i.date == day))
                  Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: day == data.today ? scheme.primary.withValues(alpha: 0.5) : scheme.outlineVariant),
                      color: day == data.today ? scheme.primaryContainer.withValues(alpha: 0.35) : null,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(14, 10, 14, 0),
                          child: Row(
                            children: [
                              Text('${weekdayNames[isoWeekday(day) - 1]} ${formatDayShort(day)}', style: const TextStyle(fontWeight: FontWeight.w800)),
                              if (day == data.today) ...[const SizedBox(width: 8), const ToneBadge(label: 'Bugün', tone: Tone.brand)],
                            ],
                          ),
                        ),
                        for (final item in items.where((i) => i.date == day))
                          CheckboxListTile(
                            value: item.done,
                            onChanged: (v) => _toggle(item, v ?? false),
                            controlAffinity: ListTileControlAffinity.leading,
                            dense: true,
                            title: Text(
                              '${item.subject}${item.topic != null ? ' · ${item.topic}' : ''}',
                              style: TextStyle(fontWeight: FontWeight.w700, decoration: item.done ? TextDecoration.lineThrough : null, color: item.done ? scheme.onSurfaceVariant : null),
                            ),
                            subtitle: [item.resource, if (item.targetQuestions != null) '${item.targetQuestions} soru', item.note].whereType<String>().isEmpty
                                ? null
                                : Text([item.resource, if (item.targetQuestions != null) '${item.targetQuestions} soru', item.note].whereType<String>().join(' · ')),
                          ),
                      ],
                    ),
                  ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text('Kaynaklar ve konu ilerlemesi', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        if (data.resources.isEmpty)
          Text('Kurumunuz kaynak atadığında burada konu konu ilerlemenizi takip edebilirsiniz.', style: TextStyle(color: scheme.onSurfaceVariant))
        else
          for (final r in data.resources)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _ResourceCard(guardianId: widget.guardianId, resource: r, onSaved: () => ref.invalidate(studyWeekProvider(_key))),
            ),
        if (!data.coaching.isEmpty) ...[
          const SizedBox(height: 16),
          _CoachingCard(coaching: data.coaching),
        ],
      ],
    );
  }
}

class _ResourceCard extends StatelessWidget {
  const _ResourceCard({required this.guardianId, required this.resource, required this.onSaved});

  final String guardianId;
  final StudyResource resource;
  final VoidCallback onSaved;

  @override
  Widget build(BuildContext context) {
    final r = resource;
    final scheme = Theme.of(context).colorScheme;
    final scored = r.topics.where((t) => t.accuracy != null).toList();
    return SectionCard(
      title: '${r.subject} · ${r.name}',
      subtitle: '${r.doneCount}/${r.topicCount} konu bitti · ${r.solved} soru çözüldü${r.accuracy != null ? ' · başarı ${formatPercent(r.accuracy!)}' : ''}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          RateBar(value: r.completion, color: scheme.primary),
          if (scored.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final t in scored)
                  ToneBadge(
                    label: '${t.topic} ${formatPercent(t.accuracy!)}',
                    tone: t.accuracy! >= 0.7 ? Tone.green : (t.accuracy! >= 0.5 ? Tone.amber : Tone.rose),
                  ),
              ],
            ),
          ],
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () async {
                final saved = await showModalBottomSheet<bool>(
                  context: context,
                  isScrollControlled: true,
                  useSafeArea: true,
                  builder: (_) => _ProgressSheet(guardianId: guardianId, resource: r),
                );
                if (saved ?? false) onSaved();
              },
              icon: const Icon(Icons.edit_note_rounded),
              label: const Text('İlerleme gir'),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProgressSheet extends ConsumerStatefulWidget {
  const _ProgressSheet({required this.guardianId, required this.resource});

  final String guardianId;
  final StudyResource resource;

  @override
  ConsumerState<_ProgressSheet> createState() => _ProgressSheetState();
}

class _ProgressSheetState extends ConsumerState<_ProgressSheet> {
  late final _rows = [
    for (final t in widget.resource.topics)
      (
        topic: t.topic,
        done: ValueNotifier<bool>(t.done),
        solved: TextEditingController(text: t.solved == 0 ? '' : '${t.solved}'),
        correct: TextEditingController(text: t.correct == 0 ? '' : '${t.correct}'),
        wrong: TextEditingController(text: t.wrong == 0 ? '' : '${t.wrong}'),
      ),
  ];
  bool _busy = false;

  @override
  void dispose() {
    for (final r in _rows) {
      r.done.dispose();
      r.solved.dispose();
      r.correct.dispose();
      r.wrong.dispose();
    }
    super.dispose();
  }

  int _n(TextEditingController c) => int.tryParse(c.text.trim()) ?? 0;

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).saveResourceProgress(
            widget.guardianId,
            widget.resource.id,
            [for (final r in _rows) ProgressRow(topic: r.topic, solved: _n(r.solved), correct: _n(r.correct), wrong: _n(r.wrong), done: r.done.value)],
          );
      if (!mounted) return;
      showSnack(context, 'İlerleme kaydedildi.');
      Navigator.pop(context, true);
    } on ApiException catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    InputDecoration box(String label) => InputDecoration(labelText: label, isDense: true, contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10));
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.9,
      maxChildSize: 0.95,
      builder: (context, controller) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(widget.resource.name, style: Theme.of(context).textTheme.titleLarge),
                Text('Konu konu çözülen, doğru ve yanlış sayısını girin; biten konuları işaretleyin.', style: TextStyle(color: scheme.onSurfaceVariant)),
              ],
            ),
          ),
          Expanded(
            child: ListView.separated(
              controller: controller,
              padding: EdgeInsets.fromLTRB(16, 4, 16, MediaQuery.viewInsetsOf(context).bottom + 16),
              itemCount: _rows.length,
              separatorBuilder: (_, _) => const Divider(height: 20),
              itemBuilder: (context, i) {
                final r = _rows[i];
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ValueListenableBuilder<bool>(
                      valueListenable: r.done,
                      builder: (context, done, _) => CheckboxListTile(
                        value: done,
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        controlAffinity: ListTileControlAffinity.leading,
                        onChanged: (v) => r.done.value = v ?? false,
                        title: Text(r.topic, style: const TextStyle(fontWeight: FontWeight.w700)),
                      ),
                    ),
                    Row(
                      children: [
                        Expanded(child: TextField(controller: r.solved, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly], decoration: box('Çözülen'))),
                        const SizedBox(width: 8),
                        Expanded(child: TextField(controller: r.correct, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly], decoration: box('Doğru'))),
                        const SizedBox(width: 8),
                        Expanded(child: TextField(controller: r.wrong, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly], decoration: box('Yanlış'))),
                      ],
                    ),
                  ],
                );
              },
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: SizedBox(width: double.infinity, child: BusyButton(busy: _busy, onPressed: _save, label: 'Kaydet')),
            ),
          ),
        ],
      ),
    );
  }
}

class _CoachingCard extends StatelessWidget {
  const _CoachingCard({required this.coaching});

  final Coaching coaching;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final schedule = coaching.coach == null
        ? 'Koç atanmamış'
        : 'Koç: ${coaching.coach}${coaching.weekday != null ? ' · her ${weekdayNames[coaching.weekday! - 1]}${coaching.minute != null ? ' ${minutesToTime(coaching.minute!)}' : ''}' : ''}';
    return SectionCard(
      title: 'Koç görüşmeleri',
      subtitle: schedule,
      child: coaching.sessions.isEmpty
          ? Text('Paylaşılan görüşme notu yok.', style: TextStyle(color: scheme.onSurfaceVariant))
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final s in coaching.sessions)
                  Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: scheme.surfaceContainerLow, borderRadius: BorderRadius.circular(12)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Wrap(
                          spacing: 8,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Text('${formatDayNumeric(s.date)}${s.coach != null ? ' · ${s.coach}' : ''}', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12.5, fontWeight: FontWeight.w700)),
                            if (!s.held) const ToneBadge(label: 'Görüşme yapılamadı', tone: Tone.rose),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(s.notes, style: const TextStyle(height: 1.45)),
                        if (s.priorityTopics.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Wrap(spacing: 6, runSpacing: 6, children: [for (final t in s.priorityTopics) ToneBadge(label: t, tone: Tone.amber)]),
                        ],
                        if (s.nextGoal != null) ...[const SizedBox(height: 6), Text('Hedef: ${s.nextGoal}', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13))],
                      ],
                    ),
                  ),
              ],
            ),
    );
  }
}
