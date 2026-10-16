import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/format/dates.dart';
import '../../core/format/money.dart';
import '../../core/models/booking.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import '../shared/data.dart';

enum _Outcome { checking, success, failed, expired, timeout, other }

/// "Ödemeniz kontrol ediliyor": ders durumu 3 saniyede bir (en çok 3 dakika) sorgulanır.
class PaymentStatusScreen extends ConsumerStatefulWidget {
  const PaymentStatusScreen({super.key, required this.bookingId, this.pollInterval = const Duration(seconds: 3), this.maxWait = const Duration(minutes: 3)});

  final String bookingId;
  final Duration pollInterval;
  final Duration maxWait;

  @override
  ConsumerState<PaymentStatusScreen> createState() => _PaymentStatusScreenState();
}

class _PaymentStatusScreenState extends ConsumerState<PaymentStatusScreen> {
  _Outcome _outcome = _Outcome.checking;
  BookingDetail? _booking;
  Timer? _timer;
  late final DateTime _deadline = DateTime.now().add(widget.maxWait);
  bool _retrying = false;
  String? _networkProblem;

  @override
  void initState() {
    super.initState();
    _check();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _check() async {
    try {
      final booking = await ref.read(apiProvider).booking(widget.bookingId);
      if (!mounted) return;
      _networkProblem = null;
      final outcome = _evaluate(booking);
      setState(() {
        _booking = booking;
        _outcome = outcome;
      });
      if (outcome == _Outcome.checking) _schedule();
      if (outcome != _Outcome.checking) bumpBookings(ref);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _networkProblem = error.message);
      _schedule();
    }
  }

  void _schedule() {
    if (DateTime.now().isAfter(_deadline)) {
      setState(() => _outcome = _Outcome.timeout);
      return;
    }
    _timer?.cancel();
    _timer = Timer(widget.pollInterval, _check);
  }

  _Outcome _evaluate(BookingDetail booking) {
    switch (booking.status) {
      case BookingStatus.pendingApproval:
      case BookingStatus.confirmed:
      case BookingStatus.completed:
        return _Outcome.success;
      case BookingStatus.expired:
        return _Outcome.expired;
      case BookingStatus.pendingPayment:
        final last = booking.lastPayment;
        if (last != null && last.status == 'FAILED') return _Outcome.failed;
        return _Outcome.checking;
      default:
        return _Outcome.other;
    }
  }

  Future<void> _retry() async {
    setState(() => _retrying = true);
    try {
      final link = await ref.read(apiProvider).retryPayment(widget.bookingId);
      if (!mounted) return;
      context.pushReplacement(Routes.payment(widget.bookingId), extra: link);
    } on ApiException catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => _retrying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final booking = _booking;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) context.go(Routes.lessons);
      },
      child: Scaffold(
        appBar: AppBar(
          automaticallyImplyLeading: false,
          title: const Text('Ödeme sonucu'),
          actions: [IconButton(tooltip: 'Kapat', onPressed: () => context.go(Routes.lessons), icon: const Icon(Icons.close_rounded))],
        ),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              const SizedBox(height: 24),
              _Illustration(outcome: _outcome),
              const SizedBox(height: 24),
              ..._content(context, booking),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _content(BuildContext context, BookingDetail? booking) {
    final scheme = Theme.of(context).colorScheme;
    final title = Theme.of(context).textTheme.headlineSmall;
    final muted = TextStyle(color: scheme.onSurfaceVariant, height: 1.45, fontSize: 15);
    final isQuestion = booking?.summary.isQuestion ?? false;
    switch (_outcome) {
      case _Outcome.checking:
        return [
          Text('Ödemeniz kontrol ediliyor', textAlign: TextAlign.center, style: title),
          const SizedBox(height: 8),
          Text('Bankanızdan onay bekleniyor. Bu birkaç saniye sürebilir; lütfen bu ekranı kapatmayın.', textAlign: TextAlign.center, style: muted),
          if (_networkProblem != null) ...[const SizedBox(height: 12), NoticeBox(message: _networkProblem!, tone: Tone.amber)],
          const SizedBox(height: 24),
          const Center(child: CircularProgressIndicator()),
        ];
      case _Outcome.success:
        final b = booking!;
        final confirmed = b.status == BookingStatus.confirmed;
        return [
          Text(isQuestion ? 'Sorunuz öğretmene iletildi' : (confirmed ? 'Dersiniz onaylandı' : 'Ödemeniz alındı'), textAlign: TextAlign.center, style: title),
          const SizedBox(height: 8),
          Text(
            isQuestion
                ? 'Öğretmeniniz çözümü ${b.question?.answerDeadline != null ? 'en geç ${formatDateTime(b.question!.answerDeadline!)} saatine kadar' : 'kısa süre içinde'} gönderecek; gelmezse ödemenizin tamamı iade edilir.'
                : confirmed
                    ? 'Ders saatinde “Derse katıl” düğmesiyle sanal sınıfa girebilirsiniz.'
                    : 'Öğretmeniniz ${b.summary.approvalDeadline != null ? formatDateTime(b.summary.approvalDeadline!) : 'kısa süre'} saatine kadar onaylayacak. Onaylamazsa ödemenizin tamamı otomatik iade edilir.',
            textAlign: TextAlign.center,
            style: muted,
          ),
          const SizedBox(height: 20),
          _BookingSummaryCard(booking: b),
          const SizedBox(height: 20),
          FilledButton(onPressed: () => context.go(Routes.lesson(b.id)), child: Text(isQuestion ? 'Soruma git' : 'Dersime git')),
          const SizedBox(height: 10),
          OutlinedButton(onPressed: () => context.go(Routes.explore), child: const Text('Ana sayfaya dön')),
        ];
      case _Outcome.failed:
        final reason = booking?.lastPayment?.failureReason;
        return [
          Text('Ödeme tamamlanamadı', textAlign: TextAlign.center, style: title),
          const SizedBox(height: 8),
          Text(reason ?? 'Bankanız ödemeyi onaylamadı. Kart bilgilerinizi kontrol edip tekrar deneyebilirsiniz.', textAlign: TextAlign.center, style: muted),
          if (booking?.holdExpiresAt != null) ...[
            const SizedBox(height: 8),
            Text('Saat ${formatTime(booking!.holdExpiresAt!)}’e kadar sizin için ayrılı.', textAlign: TextAlign.center, style: muted),
          ],
          const SizedBox(height: 24),
          BusyButton(busy: _retrying, onPressed: _retry, label: 'Tekrar dene', icon: Icons.refresh_rounded),
          const SizedBox(height: 10),
          OutlinedButton(onPressed: () => context.go(Routes.lessons), child: const Text('Derslerime git')),
        ];
      case _Outcome.expired:
        return [
          Text('Ödeme süresi doldu', textAlign: TextAlign.center, style: title),
          const SizedBox(height: 8),
          Text('Saat sizin için ayrılı tutuluyordu ama süre doldu. Lütfen yeni bir saat seçin.', textAlign: TextAlign.center, style: muted),
          const SizedBox(height: 24),
          if (booking?.summary.counterpart.teacherSlug != null)
            FilledButton(onPressed: () => context.go(Routes.teacher(booking!.summary.counterpart.teacherSlug!)), child: const Text('Yeni saat seç')),
          const SizedBox(height: 10),
          OutlinedButton(onPressed: () => context.go(Routes.lessons), child: const Text('Derslerime git')),
        ];
      case _Outcome.timeout:
        return [
          Text('Ödeme henüz tamamlanmadı', textAlign: TextAlign.center, style: title),
          const SizedBox(height: 8),
          Text(
            'Ödeme sayfasını tamamlamadan kapattıysanız saat ${booking?.holdExpiresAt != null ? formatTime(booking!.holdExpiresAt!) : 'kısa bir süre'}’e kadar sizin için ayrılı kalır; ödemeyi tamamlayabilirsiniz.',
            textAlign: TextAlign.center,
            style: muted,
          ),
          const SizedBox(height: 24),
          if (booking?.actions.canPay ?? false) BusyButton(busy: _retrying, onPressed: _retry, label: 'Ödemeyi tamamla', icon: Icons.credit_card_rounded),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: () {
              setState(() => _outcome = _Outcome.checking);
              _check();
            },
            child: const Text('Tekrar kontrol et'),
          ),
          TextButton(onPressed: () => context.go(Routes.lessons), child: const Text('Derslerime git')),
        ];
      case _Outcome.other:
        final b = booking!;
        return [
          Text(b.summary.statusLabel, textAlign: TextAlign.center, style: title),
          const SizedBox(height: 24),
          FilledButton(onPressed: () => context.go(Routes.lesson(b.id)), child: const Text('Ayrıntıları gör')),
        ];
    }
  }
}

class _Illustration extends StatelessWidget {
  const _Illustration({required this.outcome});

  final _Outcome outcome;

  @override
  Widget build(BuildContext context) {
    final (icon, tone) = switch (outcome) {
      _Outcome.success => (Icons.check_rounded, Tone.green),
      _Outcome.failed => (Icons.close_rounded, Tone.rose),
      _Outcome.expired => (Icons.timer_off_rounded, Tone.slate),
      _Outcome.timeout => (Icons.hourglass_bottom_rounded, Tone.amber),
      _Outcome.other => (Icons.info_outline_rounded, Tone.sky),
      _Outcome.checking => (Icons.credit_card_rounded, Tone.brand),
    };
    final colors = ToneColors.of(tone, Theme.of(context).brightness);
    return Center(
      child: Container(
        width: 96,
        height: 96,
        decoration: BoxDecoration(color: colors.background, shape: BoxShape.circle),
        child: Icon(icon, size: 48, color: colors.foreground),
      ),
    );
  }
}

class _BookingSummaryCard extends StatelessWidget {
  const _BookingSummaryCard({required this.booking});

  final BookingDetail booking;

  @override
  Widget build(BuildContext context) {
    final s = booking.summary;
    return SectionCard(
      child: Column(
        children: [
          InfoRow(label: 'Ders', value: s.title),
          InfoRow(label: 'Öğretmen', value: s.counterpart.name),
          if (!s.isQuestion) InfoRow(label: 'Zaman', value: formatLessonRange(s.startAt, s.endAt)),
          InfoRow(label: 'Randevu no', value: s.code),
          InfoRow(label: 'Ödenen', value: formatMoney(booking.price)),
        ],
      ),
    );
  }
}
