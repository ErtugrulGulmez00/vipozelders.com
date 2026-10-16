import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/format/dates.dart';
import '../../core/format/money.dart';
import '../../core/models/center.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';
import 'center_child_screen.dart';
import 'net_trend_chart.dart';

/// Deneme karnesi: ders bazında D/Y/B/net, kurum ortalaması, konu analizi ve eksikler.
class ReportCardScreen extends ConsumerWidget {
  const ReportCardScreen({super.key, required this.id, required this.examId});

  final String id;
  final String examId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final report = ref.watch(reportCardProvider((id, examId)));
    return Scaffold(
      appBar: AppBar(leading: const AppBackButton(fallback: Routes.center), title: Text(report.valueOrNull?.examName ?? 'Deneme karnesi')),
      body: AsyncBody(
        value: report,
        onRetry: () => ref.invalidate(reportCardProvider((id, examId))),
        builder: (r) => _ReportBody(report: r),
      ),
    );
  }
}

class _ReportBody extends StatelessWidget {
  const _ReportBody({required this.report});

  final ReportCard report;

  @override
  Widget build(BuildContext context) {
    final r = report;
    final scheme = Theme.of(context).colorScheme;
    final questionCount = r.sections.fold<int>(0, (t, s) => t + s.questionCount);
    return ListView(
      padding: EdgeInsets.fromLTRB(16, 8, 16, 32 + MediaQuery.paddingOf(context).bottom),
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(gradient: Brand.heroGradient, borderRadius: BorderRadius.circular(22)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                [examKindLabels[r.examKind] ?? r.examKind, formatDayLong(r.examDate), if (r.publisher != null) r.publisher!].join(' · '),
                style: const TextStyle(color: Brand.b100, fontSize: 13, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 10),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(formatNet(r.net), style: const TextStyle(color: Colors.white, fontSize: 44, fontWeight: FontWeight.w800, height: 1)),
                  const SizedBox(width: 6),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text('net${questionCount > 0 ? ' / $questionCount soru' : ''}', style: const TextStyle(color: Brand.b100, fontWeight: FontWeight.w600)),
                  ),
                  const Spacer(),
                  if (r.rank != null)
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text('${r.rank}.', style: const TextStyle(color: Brand.gold300, fontSize: 28, fontWeight: FontWeight.w800)),
                        Text('${r.participants} öğrenci içinde', style: const TextStyle(color: Brand.b100, fontSize: 12)),
                      ],
                    ),
                ],
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _Pill('Doğru ${r.correct}'),
                  _Pill('Yanlış ${r.wrong}'),
                  _Pill('Boş ${r.blank}'),
                  if (r.score != null) _Pill('Puan ${formatNet(r.score)}'),
                  if (r.averageNet != null) _Pill('Kurum ortalaması ${formatNet(r.averageNet)}'),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        SectionCard(
          title: 'Ders bazında sonuçlar',
          child: Column(
            children: [
              for (final s in r.sections) _SectionRow(section: s),
            ],
          ),
        ),
        if (r.weakTopics.isNotEmpty) ...[
          const SizedBox(height: 12),
          SectionCard(
            title: 'Eksik konular',
            subtitle: 'Bu denemede en fazla yarısı doğru yapılan konular',
            child: Column(children: [for (final t in r.weakTopics) WeakTopicRow(topic: t)]),
          ),
        ],
        if (r.trend.length >= 2) ...[
          const SizedBox(height: 12),
          SectionCard(title: 'Net gelişimi', child: NetTrendChart(points: r.trend, maxNet: questionCount > 0 ? questionCount.toDouble() : null)),
        ],
        const SizedBox(height: 12),
        Text('Sonuçlar kurumunuzun yayınladığı cevap anahtarına göre hesaplanır.', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12.5)),
      ],
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999), border: Border.all(color: Colors.white24)),
      child: Text(text, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12.5)),
    );
  }
}

class _SectionRow extends StatefulWidget {
  const _SectionRow({required this.section});

  final ReportSection section;

  @override
  State<_SectionRow> createState() => _SectionRowState();
}

class _SectionRowState extends State<_SectionRow> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final s = widget.section;
    final scheme = Theme.of(context).colorScheme;
    final rate = s.net == null || s.questionCount == 0 ? 0.0 : (s.net! / s.questionCount).clamp(0.0, 1.0);
    final avgRate = s.averageNet == null || s.questionCount == 0 ? null : (s.averageNet! / s.questionCount).clamp(0.0, 1.0);
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: s.topics.isEmpty ? null : () => setState(() => _open = !_open),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(child: Text(s.name, style: const TextStyle(fontWeight: FontWeight.w700))),
                    Text('${formatNet(s.net)} / ${s.questionCount}', style: const TextStyle(fontWeight: FontWeight.w800)),
                    if (s.topics.isNotEmpty) Icon(_open ? Icons.expand_less_rounded : Icons.expand_more_rounded, size: 20),
                  ],
                ),
                const SizedBox(height: 4),
                Stack(
                  children: [
                    RateBar(value: rate, color: scheme.primary, height: 10),
                    if (avgRate != null)
                      Positioned.fill(
                        child: LayoutBuilder(
                          builder: (context, constraints) => Stack(
                            children: [
                              Positioned(left: constraints.maxWidth * avgRate - 1, top: 0, bottom: 0, child: Container(width: 3, color: Brand.gold500)),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'D ${s.correct ?? '—'} · Y ${s.wrong ?? '—'} · B ${s.blank ?? '—'}${s.averageNet != null ? ' · kurum ort. ${formatNet(s.averageNet)}' : ''}',
                  style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12.5),
                ),
              ],
            ),
          ),
          if (_open)
            Padding(
              padding: const EdgeInsets.only(top: 8, left: 8),
              child: Column(
                children: [
                  for (final t in s.topics)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          Expanded(flex: 3, child: Text(t.topic, style: const TextStyle(fontSize: 13))),
                          Expanded(flex: 2, child: RateBar(value: t.rate, height: 6)),
                          const SizedBox(width: 8),
                          SizedBox(width: 44, child: Text('${t.correct}/${t.questions}', textAlign: TextAlign.right, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700))),
                        ],
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
