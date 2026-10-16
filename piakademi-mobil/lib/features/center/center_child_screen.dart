import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/deep_links.dart';
import '../../core/format/dates.dart';
import '../../core/format/money.dart';
import '../../core/models/center.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import 'center_questions_tab.dart';
import 'center_study_tab.dart';
import 'net_trend_chart.dart';

const _tabs = [
  ('ozet', 'Özet'),
  ('devam', 'Devam ve etüt'),
  ('denemeler', 'Denemeler'),
  ('odemeler', 'Ödemeler'),
  ('odevler', 'Ödevler'),
  ('calisma', 'Çalışma programı'),
  ('sorular', 'Soru sor'),
  ('program', 'Ders programı'),
];

Tone attendanceTone(String status) => switch (status) {
      'PRESENT' => Tone.green,
      'ABSENT' => Tone.rose,
      'LATE' => Tone.amber,
      'EXCUSED' => Tone.sky,
      _ => Tone.slate,
    };

/// Veli portalı: kuruma kayıtlı öğrencinin ayrıntısı.
class CenterChildScreen extends ConsumerWidget {
  const CenterChildScreen({super.key, required this.id, this.initialTab});

  final String id;
  final String? initialTab;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final child = ref.watch(centerChildProvider(id));
    final initialIndex = _tabs.indexWhere((t) => t.$1 == initialTab).clamp(0, _tabs.length - 1);
    return DefaultTabController(
      length: _tabs.length,
      initialIndex: initialIndex,
      child: Scaffold(
        appBar: AppBar(
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(child.valueOrNull?.student.fullName ?? 'Öğrenci'),
              if (child.valueOrNull != null)
                Text(child.value!.center.name, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500, color: Theme.of(context).colorScheme.onSurfaceVariant)),
            ],
          ),
          leading: BackButton(onPressed: () => context.canPop() ? context.pop() : context.go(Routes.center)),
          bottom: TabBar(isScrollable: true, tabs: [for (final t in _tabs) Tab(text: t.$2)]),
        ),
        body: AsyncBody(
          value: child,
          onRetry: () => ref.invalidate(centerChildProvider(id)),
          builder: (data) => TabBarView(
            children: [
              _Refreshable(id: id, child: _Overview(data: data)),
              _Refreshable(id: id, child: _Attendance(data: data)),
              _Refreshable(id: id, child: _Exams(data: data)),
              _Refreshable(id: id, child: _Payments(data: data)),
              _Refreshable(id: id, child: _Homeworks(data: data)),
              CenterStudyTab(guardianId: id),
              CenterQuestionsTab(data: data),
              _Refreshable(id: id, child: _Schedule(data: data)),
            ],
          ),
        ),
      ),
    );
  }
}

class _Refreshable extends ConsumerWidget {
  const _Refreshable({required this.id, required this.child});

  final String id;
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return RefreshIndicator(
      onRefresh: () => ref.refresh(centerChildProvider(id).future),
      child: child,
    );
  }
}

class _TabList extends StatelessWidget {
  const _TabList({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.fromLTRB(16, 16, 16, 32 + MediaQuery.paddingOf(context).bottom),
      children: children,
    );
  }
}

class _Overview extends ConsumerWidget {
  const _Overview({required this.data});

  final CenterChild data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final last = data.exams.isEmpty ? null : data.exams.first;
    final scheme = Theme.of(context).colorScheme;
    return _TabList(
      children: [
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 1.45,
          children: [
            StatTile(icon: Icons.how_to_reg_rounded, label: 'Devam (60 gün)', value: formatPercent(data.attendanceRate), hint: '${data.absences} devamsızlık', onTap: () => DefaultTabController.of(context).animateTo(1)),
            StatTile(
              icon: Icons.insights_rounded,
              label: 'Son deneme',
              value: last == null ? '—' : '${formatNet(last.net)} net',
              hint: last == null ? null : '${last.name}${last.rank != null ? ' · ${last.rank}/${last.participants}' : ''}',
              onTap: () => DefaultTabController.of(context).animateTo(2),
            ),
            StatTile(
              icon: Icons.account_balance_wallet_rounded,
              label: 'Kalan ödeme',
              value: formatMoney(data.balance.remaining),
              hint: data.balance.overdue > 0 ? 'Geciken ${formatMoney(data.balance.overdue)}' : 'Geciken yok',
              hintColor: data.balance.overdue > 0 ? scheme.error : null,
              onTap: () => DefaultTabController.of(context).animateTo(3),
            ),
            StatTile(icon: Icons.flag_rounded, label: 'Eksik konu', value: '${data.weakTopics.length}'),
          ],
        ),
        const SizedBox(height: 14),
        SectionCard(
          title: 'Eksik konular',
          subtitle: 'Yayınlanan denemelerde en fazla yarısını doğru yapabildiği konular',
          child: data.weakTopics.isEmpty
              ? Text('Henüz eksik konu analizi yok. Kurum deneme cevaplarını girip sonuçları yayınladıkça burada görünür.', style: TextStyle(color: scheme.onSurfaceVariant))
              : Column(children: [for (final t in data.weakTopics) WeakTopicRow(topic: t)]),
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: 'Duyurular',
          child: data.announcements.isEmpty
              ? Text('Duyuru yok.', style: TextStyle(color: scheme.onSurfaceVariant))
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final a in data.announcements)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(a.title, style: const TextStyle(fontWeight: FontWeight.w800)),
                            Text('${formatCompact(a.createdAt)} · ${a.group ?? 'Tüm kurum'}', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12)),
                            const SizedBox(height: 4),
                            Text(a.body, style: const TextStyle(height: 1.45)),
                          ],
                        ),
                      ),
                  ],
                ),
        ),
        if (data.notes.isNotEmpty) ...[
          const SizedBox(height: 12),
          SectionCard(
            title: 'Öğretmen notları',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final n in data.notes)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          [noteKindLabels[n.kind] ?? n.kind, if (n.author != null) n.author!, formatCompact(n.createdAt)].join(' · '),
                          style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12),
                        ),
                        const SizedBox(height: 4),
                        Text(n.text, style: const TextStyle(height: 1.45)),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 12),
        _CenterContact(data: data),
      ],
    );
  }
}

/// Eksik konu satırı: oran çubuğu ve (kurum izin veriyorsa) özel ders öğretmenleri bağlantısı.
class WeakTopicRow extends StatelessWidget {
  const WeakTopicRow({super.key, required this.topic});

  final WeakTopic topic;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(topic.topic, style: const TextStyle(fontWeight: FontWeight.w700))),
              Text(formatPercent(topic.rate), style: TextStyle(fontWeight: FontWeight.w800, color: RateBar.colorFor(topic.rate))),
            ],
          ),
          const SizedBox(height: 4),
          RateBar(value: topic.rate),
          const SizedBox(height: 4),
          if (topic.teachersUrl != null)
            InkWell(
              onTap: () {
                final location = DeepLinks.locationFor(Uri.parse(topic.teachersUrl!));
                if (location != null) {
                  context.push(location);
                } else {
                  openExternal(context, topic.teachersUrl!);
                }
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Text('${topic.section} için özel ders öğretmenleri →', style: TextStyle(color: scheme.primary, fontWeight: FontWeight.w700, fontSize: 13)),
              ),
            )
          else
            Text(topic.section, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12.5)),
        ],
      ),
    );
  }
}

class _CenterContact extends ConsumerWidget {
  const _CenterContact({required this.data});

  final CenterChild data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = data.center;
    return SectionCard(
      title: c.name,
      subtitle: c.address,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (c.phone != null) OutlinedButton.icon(onPressed: () => openExternal(context, 'tel:${c.phone}'), icon: const Icon(Icons.call_outlined), label: Text(c.phone!)),
              if (c.email != null) OutlinedButton.icon(onPressed: () => openExternal(context, 'mailto:${c.email}'), icon: const Icon(Icons.mail_outline_rounded), label: const Text('E-posta')),
            ],
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: () async {
                final ok = await confirmDialog(
                  context,
                  title: 'Bağlantı kaldırılsın mı?',
                  message: '${data.student.fullName} bu hesaptan kaldırılır. Kurumdaki kayıt silinmez; yeniden bağlanmak için kurumdan yeni davet istemeniz gerekir.',
                  confirmText: 'Kaldır',
                  destructive: true,
                );
                if (!ok) return;
                try {
                  await ref.read(apiProvider).unlinkCenter(data.id);
                  ref.invalidate(centerLinksProvider);
                  if (context.mounted) {
                    showSnack(context, 'Bağlantı kaldırıldı.');
                    context.go(Routes.center);
                  }
                } on ApiException catch (error) {
                  if (context.mounted) showError(context, error);
                }
              },
              child: Text('Bağlantıyı kaldır', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
            ),
          ),
        ],
      ),
    );
  }
}

class _Attendance extends StatelessWidget {
  const _Attendance({required this.data});

  final CenterChild data;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return _TabList(
      children: [
        if (data.hallDays.isNotEmpty) ...[
          SectionCard(
            title: 'Çalışma salonu',
            subtitle: 'Son günler · G geldi, Y gelmedi',
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final d in data.hallDays)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(color: scheme.surfaceContainerLow, borderRadius: BorderRadius.circular(10)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${formatDayWithWeekday(d.date)} · ${d.hall}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
                        Text('${d.present}/${d.marked} periyot  ${d.marks}', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12, fontFamily: 'monospace')),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
        SectionCard(
          title: 'Ders yoklamaları',
          subtitle: 'Son 60 gün',
          padding: const EdgeInsets.fromLTRB(4, 8, 4, 8),
          child: data.attendance.isEmpty
              ? const Padding(padding: EdgeInsets.all(12), child: Text('Yoklama kaydı yok.'))
              : Column(
                  children: [
                    for (final a in data.attendance)
                      ListTile(
                        dense: true,
                        title: Text(a.subject, style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text('${formatDayWithWeekday(a.date)} ${minutesToTime(a.startMinute)} · ${a.group}'),
                        trailing: ToneBadge(label: attendanceLabels[a.status] ?? a.status, tone: attendanceTone(a.status)),
                      ),
                  ],
                ),
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: 'Etütler',
          padding: const EdgeInsets.fromLTRB(4, 8, 4, 8),
          child: data.etuds.isEmpty
              ? const Padding(padding: EdgeInsets.all(12), child: Text('Etüt yok.'))
              : Column(
                  children: [
                    for (final e in data.etuds)
                      ListTile(
                        dense: true,
                        title: Text('${e.subject}${e.topic != null ? ' — ${e.topic}' : ''}', style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text('${formatDayWithWeekday(e.date)} ${minutesToTime(e.startMinute)}–${minutesToTime(e.endMinute)}${e.teacher != null ? ' · ${e.teacher}' : ''}'),
                        trailing: e.attendance != null
                            ? ToneBadge(label: attendanceLabels[e.attendance] ?? e.attendance!, tone: attendanceTone(e.attendance!))
                            : ToneBadge(label: etudStatusLabels[e.status] ?? 'Planlandı', tone: Tone.sky),
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}

class _Exams extends StatelessWidget {
  const _Exams({required this.data});

  final CenterChild data;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    if (data.exams.isEmpty) {
      return const _TabList(children: [EmptyView(icon: Icons.insights_rounded, title: 'Yayınlanmış deneme sonucu yok', message: 'Kurum sonuçları yayınladıkça burada görünür.')]);
    }
    final kind = data.exams.first.kind;
    final maxNet = data.exams.first.questionCount > 0 ? data.exams.first.questionCount.toDouble() : null;
    return _TabList(
      children: [
        if (data.trend.length >= 2) ...[
          SectionCard(title: '${examKindLabels[kind] ?? kind} net gelişimi', child: NetTrendChart(points: data.trend, maxNet: maxNet)),
          const SizedBox(height: 12),
        ],
        for (final exam in data.exams)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: () => context.push(Routes.reportCard(data.id, exam.examId)),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(child: Text(exam.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15))),
                          Text('${formatNet(exam.net)} net', style: TextStyle(fontWeight: FontWeight.w800, color: scheme.primary, fontSize: 16)),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${formatDayLong(exam.date)} · ${examKindLabels[exam.kind] ?? exam.kind}${exam.rank != null ? ' · ${exam.rank}/${exam.participants}. sıra' : ''}',
                        style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12.5),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        exam.sections.where((s) => s.net != null).map((s) => '${s.name} ${formatNet(s.net)}').join(' · '),
                        style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12.5),
                      ),
                      const SizedBox(height: 6),
                      Text('Karneyi aç →', style: TextStyle(color: scheme.primary, fontWeight: FontWeight.w700, fontSize: 13)),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _Payments extends StatelessWidget {
  const _Payments({required this.data});

  final CenterChild data;

  static Tone _tone(String state) => switch (state) {
        'paid' => Tone.green,
        'partial' => Tone.sky,
        'overdue' => Tone.rose,
        'due' => Tone.amber,
        _ => Tone.slate,
      };

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final b = data.balance;
    return _TabList(
      children: [
        SectionCard(
          child: Column(
            children: [
              InfoRow(label: 'Toplam', value: formatMoney(b.total)),
              InfoRow(label: 'Ödenen', value: formatMoney(b.paid)),
              InfoRow(label: 'Kalan', value: formatMoney(b.remaining)),
              if (b.overdue > 0) InfoRow(label: 'Geciken', value: formatMoney(b.overdue)),
              if (b.total > 0) ...[const SizedBox(height: 8), RateBar(value: b.paid / b.total, color: scheme.primary)],
            ],
          ),
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: 'Taksitler',
          padding: const EdgeInsets.fromLTRB(4, 8, 4, 8),
          child: data.installments.isEmpty
              ? const Padding(padding: EdgeInsets.all(12), child: Text('Ödeme planı yok.'))
              : Column(
                  children: [
                    for (final i in data.installments)
                      ListTile(
                        dense: true,
                        title: Text(formatMoney(i.amount), style: const TextStyle(fontWeight: FontWeight.w800)),
                        subtitle: Text('${formatDayNumeric(i.dueDate)} · ${i.title} · ${i.order}. taksit${i.paidAmount > 0 && i.paidAmount < i.amount ? ' · ödenen ${formatMoney(i.paidAmount)}' : ''}'),
                        trailing: ToneBadge(label: installmentLabels[i.state] ?? i.state, tone: _tone(i.state)),
                      ),
                  ],
                ),
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: 'Yapılan ödemeler',
          padding: const EdgeInsets.fromLTRB(4, 8, 4, 8),
          child: data.payments.isEmpty
              ? const Padding(padding: EdgeInsets.all(12), child: Text('Ödeme kaydı yok.'))
              : Column(
                  children: [
                    for (final p in data.payments)
                      ListTile(
                        dense: true,
                        title: Text(formatMoney(p.amount), style: const TextStyle(fontWeight: FontWeight.w800)),
                        subtitle: Text('${formatDate(p.paidAt)}${p.receiptNo != null ? ' · Makbuz ${p.receiptNo}' : ''} · ${paymentMethodLabels[p.method] ?? p.method}'),
                      ),
                  ],
                ),
        ),
        const SizedBox(height: 8),
        Text('Ödemeler kurumunuza yapılır; ödeme ve makbuz için kurumunuzla iletişime geçin.', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12.5)),
      ],
    );
  }
}

class _Homeworks extends StatelessWidget {
  const _Homeworks({required this.data});

  final CenterChild data;

  static Tone _tone(String status) => switch (status) {
        'DONE' => Tone.green,
        'PARTIAL' => Tone.amber,
        'MISSING' => Tone.rose,
        _ => Tone.slate,
      };

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    if (data.homeworks.isEmpty) {
      return const _TabList(children: [EmptyView(icon: Icons.assignment_outlined, title: 'Ödev yok', message: 'Kurumun verdiği ödevler ve kontrol sonuçları burada görünür.')]);
    }
    final today = dateString(DateTime.now());
    return _TabList(
      children: [
        for (final h in data.homeworks)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(child: Text(h.title, style: const TextStyle(fontWeight: FontWeight.w800))),
                        ToneBadge(label: homeworkLabels[h.status] ?? h.status, tone: _tone(h.status)),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${h.subject} · teslim ${formatDayWithWeekday(h.dueDate)}${h.status == 'PENDING' && h.dueDate.compareTo(today) >= 0 ? ' (bekliyor)' : ''}',
                      style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12.5),
                    ),
                    if (h.description != null) ...[const SizedBox(height: 6), Text(h.description!, style: const TextStyle(height: 1.4))],
                    if (h.note != null) ...[const SizedBox(height: 6), Text('Öğretmen notu: ${h.note}', style: TextStyle(color: scheme.onSurfaceVariant, fontStyle: FontStyle.italic))],
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _Schedule extends StatelessWidget {
  const _Schedule({required this.data});

  final CenterChild data;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    if (data.schedule.isEmpty) {
      return const _TabList(children: [EmptyView(icon: Icons.calendar_view_week_rounded, title: 'Program henüz girilmemiş')]);
    }
    final today = isoWeekday(dateString(DateTime.now()));
    return _TabList(
      children: [
        for (var day = 1; day <= 7; day++)
          if (data.schedule.any((s) => s.weekday == day))
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: SectionCard(
                title: weekdayNames[day - 1],
                trailing: day == today ? const ToneBadge(label: 'Bugün', tone: Tone.brand) : null,
                padding: const EdgeInsets.fromLTRB(4, 4, 4, 8),
                child: Column(
                  children: [
                    for (final s in data.schedule.where((s) => s.weekday == day))
                      ListTile(
                        dense: true,
                        leading: Text('${minutesToTime(s.startMinute)}\n${minutesToTime(s.endMinute)}', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w700, color: scheme.primary, height: 1.3)),
                        title: Text(s.subject, style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text([s.group, if (s.teacher != null) s.teacher!, if (s.room != null) s.room!].join(' · ')),
                      ),
                  ],
                ),
              ),
            ),
      ],
    );
  }
}
