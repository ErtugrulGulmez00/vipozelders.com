import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format/dates.dart';
import '../../core/format/money.dart';
import '../../core/format/text.dart';
import '../../core/models/booking.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/avatar.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/rating.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import 'lesson_actions.dart';
import 'question_thread.dart';

/// Ders (ya da fotoğrafla soru) ayrıntısı. Düğmeler sunucunun döndürdüğü `actions` alanına göre gösterilir.
class LessonDetailScreen extends ConsumerWidget {
  const LessonDetailScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(bookingDetailProvider(id));
    final asTeacher = ref.watch(sessionProvider.select((s) => s.isTeacher));
    return Scaffold(
      appBar: AppBar(
        title: Text(detail.valueOrNull?.summary.isQuestion ?? false ? 'Soru ayrıntısı' : 'Ders ayrıntısı'),
        leading: BackButton(onPressed: () => context.canPop() ? context.pop() : context.go(asTeacher ? Routes.teacherLessons : Routes.lessons)),
      ),
      body: AsyncBody(
        value: detail,
        onRetry: () => ref.invalidate(bookingDetailProvider(id)),
        builder: (booking) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(bookingDetailProvider(id));
            await ref.read(bookingDetailProvider(id).future).catchError((_) => booking);
          },
          child: _DetailBody(booking: booking, asTeacher: asTeacher),
        ),
      ),
    );
  }
}

class _DetailBody extends ConsumerWidget {
  const _DetailBody({required this.booking, required this.asTeacher});

  final BookingDetail booking;
  final bool asTeacher;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = booking.summary;
    final a = booking.actions;
    final actions = LessonActions(context, ref, booking);
    final scheme = Theme.of(context).colorScheme;
    final upcomingConfirmed = s.status == BookingStatus.confirmed && s.endAt.isAfter(DateTime.now());

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.fromLTRB(16, 8, 16, 32 + MediaQuery.paddingOf(context).bottom),
      children: [
        // Başlık
        Text(s.title, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 6,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            StatusBadge(status: s.status, label: s.isQuestion && s.status == BookingStatus.pendingApproval ? 'Çözüm bekleniyor' : s.statusLabel),
            if (s.isTest) const ToneBadge(label: 'Test dersi', tone: Tone.sky),
            Text(s.code, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
          ],
        ),
        const SizedBox(height: 14),
        ..._alerts(context, actions),
        if (s.isOnline && s.status == BookingStatus.confirmed && booking.classroom != null) ...[
          _ClassroomCard(booking: booking),
          const SizedBox(height: 12),
        ],
        if (asTeacher && (a.canApprove || a.canReject)) ...[
          _RequestCard(booking: booking, actions: actions),
          const SizedBox(height: 12),
        ],
        if (s.isQuestion && booking.question != null && s.status != BookingStatus.pendingPayment) ...[
          QuestionThreadView(booking: booking, asTeacher: asTeacher),
          const SizedBox(height: 12),
        ],
        _PersonCard(booking: booking, asTeacher: asTeacher),
        const SizedBox(height: 12),
        SectionCard(
          title: s.isQuestion ? 'Soru bilgileri' : 'Ders bilgileri',
          child: Column(
            children: [
              if (s.isQuestion)
                InfoRow(label: 'Gönderildi', value: formatDateTime(booking.createdAt ?? s.startAt))
              else ...[
                InfoRow(label: 'Zaman', value: formatLessonRange(s.startAt, s.endAt)),
                InfoRow(label: 'Süre', value: durationLabel(s.durationMinutes)),
              ],
              InfoRow(label: 'Hizmet', value: s.serviceName),
              InfoRow(label: 'Öğrenci', value: '${s.learnerName}${booking.learnerGrade != null ? ' · ${booking.learnerGrade}' : ''}'),
              InfoRow(
                label: 'Ders şekli',
                value: '${modeLabels[s.mode] ?? s.mode}${booking.inPersonPlace != null ? ' · ${placeLabels[booking.inPersonPlace] ?? ''}' : ''}',
              ),
              if (s.mode == 'IN_PERSON')
                InfoRow(
                  label: 'Konum',
                  value: booking.location?.text.isNotEmpty ?? false ? booking.location!.text : 'Öğretmenin yeri (onay sonrası paylaşılır)',
                ),
              if (booking.note != null && !s.isQuestion) InfoRow(label: asTeacher ? 'Öğrencinin notu' : 'Notunuz', value: booking.note!),
              InfoRow(label: s.isQuestion ? 'Soru ücreti' : 'Ders ücreti', value: s.isIntro ? 'Ücretsiz tanışma' : formatMoney(booking.price)),
              if (asTeacher && booking.teacherAmount != null) InfoRow(label: 'Kazancınız', value: formatMoney(booking.teacherAmount!)),
              if (booking.refundedAmount > 0) InfoRow(label: 'İade', value: formatMoney(booking.refundedAmount)),
              if (upcomingConfirmed) ...[
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerLeft,
                  child: OutlinedButton.icon(onPressed: actions.addToCalendar, icon: const Icon(Icons.event_rounded), label: const Text('Takvime ekle')),
                ),
              ],
            ],
          ),
        ),
        if (!asTeacher && (a.canReview || booking.review != null)) ...[
          const SizedBox(height: 12),
          _ReviewCard(booking: booking, onReview: a.canReview ? actions.review : null),
        ],
        if (!asTeacher && a.canDispute) ...[
          const SizedBox(height: 12),
          SectionCard(
            title: 'Bir sorun mu yaşadınız?',
            subtitle: 'İtiraz süresi içinde bildirebilirsiniz; inceleme bitene kadar öğretmene ödeme yapılmaz.',
            child: Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton.icon(onPressed: actions.dispute, icon: const Icon(Icons.report_gmailerrorred_rounded), label: const Text('Sorun bildir')),
            ),
          ),
        ],
        if (a.canCancel) ...[
          const SizedBox(height: 12),
          SectionCard(
            title: s.isQuestion ? 'Soruyu iptal et' : (asTeacher ? 'Dersi iptal et' : 'Randevuyu iptal et'),
            subtitle: s.isIntro ? 'Ücretsiz tanışma görüşmesi; iptalde ücret söz konusu değildir.' : (asTeacher ? 'Öğrenciye ücretin tamamı iade edilir.' : _refundText()),
            child: Align(
              alignment: Alignment.centerLeft,
              child: BusyButton(
                busy: false,
                outlined: true,
                destructive: true,
                onPressed: asTeacher ? actions.cancelByTeacher : actions.cancelByStudent,
                label: 'İptal et',
                icon: Icons.cancel_outlined,
              ),
            ),
          ),
        ],
        if (!asTeacher && booking.payments.isNotEmpty) ...[
          const SizedBox(height: 12),
          _PaymentsCard(payments: booking.payments),
        ],
        if (booking.events.isNotEmpty) ...[
          const SizedBox(height: 12),
          _Timeline(events: booking.events),
        ],
      ],
    );
  }

  String _refundText() {
    final preview = booking.actions.cancelPreview;
    if (preview == null) return '';
    if (preview.refundAmount >= booking.price && preview.refundAmount > 0) return 'Şimdi iptal ederseniz ödediğiniz ${formatMoney(booking.price)} tamamen iade edilir.';
    if (preview.refundAmount > 0) return 'Şimdi iptal ederseniz ${formatMoney(preview.refundAmount)} (%${preview.refundPercent}) iade edilir.';
    return 'Derse çok az kaldığı için iptal politikası gereği iade yapılmaz.';
  }

  List<Widget> _alerts(BuildContext context, LessonActions actions) {
    final s = booking.summary;
    final a = booking.actions;
    final items = <Widget>[];
    void add(Widget w) => items.addAll([w, const SizedBox(height: 12)]);

    if (s.status == BookingStatus.pendingPayment && a.canPay) {
      add(NoticeBox(
        tone: Tone.amber,
        title: 'Ödeme bekleniyor',
        message: booking.holdExpiresAt != null
            ? 'Saat ${formatTime(booking.holdExpiresAt!)}’e kadar sizin için ayrılı. Ödemeyi tamamlamazsanız saat serbest kalır.'
            : 'Ödemeyi tamamlamazsanız saat serbest kalır.',
        action: FilledButton.icon(
          style: FilledButton.styleFrom(minimumSize: const Size(0, 42)),
          onPressed: () => context.push(Routes.payment(booking.id)),
          icon: const Icon(Icons.credit_card_rounded),
          label: const Text('Ödemeyi tamamla'),
        ),
      ));
    }
    if (s.status == BookingStatus.pendingApproval && !asTeacher) {
      final deadline = s.isQuestion ? booking.question?.answerDeadline : s.approvalDeadline;
      add(NoticeBox(
        tone: Tone.sky,
        title: s.isQuestion ? 'Çözüm bekleniyor' : 'Öğretmen onayı bekleniyor',
        message: s.isQuestion
            ? 'Öğretmeniniz çözümü ${deadline != null ? 'en geç ${formatDateTime(deadline)} saatine kadar' : 'kısa süre içinde'} gönderecek. Gelmezse ödemenizin tamamı otomatik iade edilir.'
            : 'Öğretmeniniz ${deadline != null ? '${formatDateTime(deadline)} saatine kadar' : 'kısa süre içinde'} yanıt verecek.${s.isIntro ? '' : ' Onaylanmazsa ödemenizin tamamı otomatik iade edilir.'}',
      ));
    }
    if (s.status == BookingStatus.disputed && booking.disputeReason != null) {
      add(NoticeBox(tone: Tone.violet, title: 'Bildirim inceleniyor', message: '“${booking.disputeReason}” — Ekibimiz en kısa sürede sonuçlandıracak.'));
    }
    if (booking.rejectionReason != null) {
      add(NoticeBox(tone: Tone.rose, title: 'Reddedildi', message: '${booking.rejectionReason}${!asTeacher ? '\nÖdemenizin tamamı iade edilir.' : ''}'));
    }
    if (booking.cancelReason != null) {
      add(NoticeBox(tone: Tone.slate, title: 'İptal gerekçesi', message: booking.cancelReason!));
    }
    return items;
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.booking, required this.actions});

  final BookingDetail booking;
  final LessonActions actions;

  @override
  Widget build(BuildContext context) {
    final s = booking.summary;
    final deadline = s.approvalDeadline;
    return SectionCard(
      color: Theme.of(context).colorScheme.primaryContainer,
      title: s.isQuestion ? 'Soru çözüm bekliyor' : 'Yanıt bekleyen talep',
      subtitle: deadline != null ? '${formatDuration(deadline.difference(DateTime.now()))} içinde yanıtlayın (son: ${formatCompact(deadline)}).' : null,
      child: Row(
        children: [
          if (booking.actions.canApprove) ...[
            Expanded(child: FilledButton.icon(onPressed: actions.approve, icon: const Icon(Icons.check_rounded), label: const Text('Onayla'))),
            const SizedBox(width: 10),
          ],
          if (s.isQuestion && booking.actions.canSolve) ...[
            Expanded(
              child: Text('Çözümü aşağıdaki yazışma alanından gönderin.', style: TextStyle(color: Theme.of(context).colorScheme.onPrimaryContainer)),
            ),
            const SizedBox(width: 10),
          ],
          if (booking.actions.canReject)
            Expanded(
              child: OutlinedButton.icon(onPressed: actions.reject, icon: const Icon(Icons.close_rounded), label: const Text('Reddet')),
            ),
        ],
      ),
    );
  }
}

class _ClassroomCard extends ConsumerStatefulWidget {
  const _ClassroomCard({required this.booking});

  final BookingDetail booking;

  @override
  ConsumerState<_ClassroomCard> createState() => _ClassroomCardState();
}

class _ClassroomCardState extends ConsumerState<_ClassroomCard> {
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      final classroom = widget.booking.classroom!;
      final now = DateTime.now();
      // Sınıf açılış saati geldiyse ayrıntı yenilenir (Derse katıl düğmesi sunucudan gelir).
      if (!classroom.open && now.isAfter(classroom.opensAt) && now.isBefore(classroom.closesAt)) {
        _ticker?.cancel();
        ref.invalidate(bookingDetailProvider(widget.booking.id));
        return;
      }
      setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final classroom = widget.booking.classroom!;
    final scheme = Theme.of(context).colorScheme;
    final canJoin = widget.booking.actions.canJoin;
    final until = classroom.opensAt.difference(DateTime.now());
    return Card(
      color: scheme.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(Icons.videocam_rounded, color: scheme.primary),
                const SizedBox(width: 8),
                Text('Sanal sınıf', style: Theme.of(context).textTheme.titleMedium),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              canJoin
                  ? 'Sınıf açık, derse katılabilirsiniz. Kamera ve mikrofon izni istenir.'
                  : until.isNegative
                      ? 'Sınıf kapandı.'
                      : 'Sınıf ${formatDateTime(classroom.opensAt)} saatinde açılacak.',
              style: TextStyle(color: scheme.onPrimaryContainer),
            ),
            if (!canJoin && !until.isNegative) ...[
              const SizedBox(height: 10),
              Text(formatCountdown(until), style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: scheme.primary, fontFeatures: const [FontFeature.tabularFigures()])),
            ],
            if (canJoin) ...[
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: () => context.push(Routes.classroom(widget.booking.id)),
                icon: const Icon(Icons.login_rounded),
                label: const Text('Derse katıl'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PersonCard extends StatelessWidget {
  const _PersonCard({required this.booking, required this.asTeacher});

  final BookingDetail booking;
  final bool asTeacher;

  @override
  Widget build(BuildContext context) {
    final s = booking.summary;
    final scheme = Theme.of(context).colorScheme;
    if (asTeacher) {
      final parent = booking.parent;
      return SectionCard(
        title: 'Veli / öğrenci',
        child: Row(
          children: [
            Avatar(name: parent?.name ?? s.counterpart.name, size: 48),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(parent?.name ?? s.counterpart.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                  Text(
                    parent?.phone != null ? formatPhone(parent!.phone) : 'Telefon onaydan sonra görünür',
                    style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13),
                  ),
                ],
              ),
            ),
            if (parent?.phone != null)
              IconButton.filledTonal(
                tooltip: 'Ara',
                onPressed: () => openExternal(context, 'tel:${parent!.phone}'),
                icon: const Icon(Icons.call_rounded),
              ),
          ],
        ),
      );
    }
    return SectionCard(
      title: 'Öğretmen',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Avatar(name: s.counterpart.name, photoUrl: s.counterpart.photoUrl, size: 52),
              const SizedBox(width: 12),
              Expanded(child: Text(s.counterpart.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16))),
            ],
          ),
          if (s.counterpart.teacherSlug != null) ...[
            const SizedBox(height: 12),
            OutlinedButton(onPressed: () => context.push(Routes.teacher(s.counterpart.teacherSlug!)), child: const Text('Profili gör · tekrar ders al')),
          ],
        ],
      ),
    );
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.booking, required this.onReview});

  final BookingDetail booking;
  final VoidCallback? onReview;

  @override
  Widget build(BuildContext context) {
    final review = booking.review;
    final scheme = Theme.of(context).colorScheme;
    return SectionCard(
      title: review == null ? 'Öğretmeninizi değerlendirin' : 'Değerlendirmeniz',
      subtitle: review == null ? 'Puanınız diğer velilere yol gösterir.' : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (review != null) ...[
            Stars(rating: review.rating, size: 22),
            if (review.comment != null && review.comment!.isNotEmpty) ...[const SizedBox(height: 6), Text(review.comment!)],
            if (review.teacherReply != null) ...[
              const SizedBox(height: 8),
              Text('Öğretmenin cevabı: ${review.teacherReply}', style: TextStyle(color: scheme.onSurfaceVariant)),
            ],
            const SizedBox(height: 8),
          ],
          if (onReview != null)
            OutlinedButton.icon(
              onPressed: onReview,
              icon: const Icon(Icons.star_outline_rounded),
              label: Text(review == null ? 'Değerlendir' : 'Değerlendirmeyi düzenle'),
            ),
        ],
      ),
    );
  }
}

class _PaymentsCard extends StatelessWidget {
  const _PaymentsCard({required this.payments});

  final List<Payment> payments;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SectionCard(
      title: 'Ödeme',
      child: Column(
        children: [
          for (final p in payments) ...[
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(formatMoney(p.amount), style: const TextStyle(fontWeight: FontWeight.w800)),
                      Text(formatCompact(p.createdAt), style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12)),
                      if (p.failureReason != null) Text(p.failureReason!, style: TextStyle(color: scheme.error, fontSize: 12.5)),
                    ],
                  ),
                ),
                ToneBadge(label: p.statusLabel, tone: _paymentTone(p.status)),
              ],
            ),
            for (final r in p.refunds)
              Container(
                margin: const EdgeInsets.only(top: 6),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: scheme.surfaceContainerLow, borderRadius: BorderRadius.circular(10)),
                child: Row(
                  children: [
                    Expanded(child: Text('İade ${formatMoney(r.amount)}', style: const TextStyle(fontSize: 13))),
                    ToneBadge(label: r.statusLabel, tone: _paymentTone(r.status)),
                  ],
                ),
              ),
            if (p != payments.last) const Divider(height: 20),
          ],
        ],
      ),
    );
  }

  static Tone _paymentTone(String status) => switch (status) {
        'SUCCEEDED' => Tone.green,
        'FAILED' => Tone.rose,
        'REFUNDED' || 'PARTIALLY_REFUNDED' => Tone.sky,
        'PENDING' || 'PROCESSING' => Tone.amber,
        _ => Tone.slate,
      };
}

class _Timeline extends StatelessWidget {
  const _Timeline({required this.events});

  final List<BookingEvent> events;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SectionCard(
      title: 'Geçmiş',
      child: Column(
        children: [
          for (var i = 0; i < events.length; i++)
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(
                    width: 20,
                    child: Column(
                      children: [
                        const SizedBox(height: 4),
                        Container(width: 10, height: 10, decoration: BoxDecoration(color: scheme.primary, shape: BoxShape.circle)),
                        if (i != events.length - 1) Expanded(child: Container(width: 2, color: scheme.outlineVariant)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(events[i].statusLabel, style: const TextStyle(fontWeight: FontWeight.w700)),
                          if (events[i].note != null) Text(events[i].note!, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
                          Text(formatCompact(events[i].createdAt), style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12)),
                        ],
                      ),
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
