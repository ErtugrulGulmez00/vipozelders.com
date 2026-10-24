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
import '../../core/widgets/badges.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';

/// Öğretmen: yanıt bekleyen ders talepleri ve çözüm bekleyen sorular.
class RequestsScreen extends ConsumerWidget {
  const RequestsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final revision = ref.watch(bookingsRevisionProvider);
    final api = ref.watch(apiProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Talepler'), actions: const [NotificationBell()]),
      body: PagedListView<BookingSummary>(
        key: ValueKey('talepler-$revision'),
        load: (page) async {
          final result = await api.bookings('talepler', page: page);
          return (result.items, result.nextPage);
        },
        empty: const EmptyView(icon: Icons.inbox_outlined, title: 'Yanıt bekleyen talep yok', message: 'Yeni bir ders talebi ya da fotoğrafla soru geldiğinde bildirim alırsınız.'),
        itemBuilder: (context, booking) => _RequestCard(booking: booking),
      ),
    );
  }
}

class _RequestCard extends ConsumerStatefulWidget {
  const _RequestCard({required this.booking});

  final BookingSummary booking;

  @override
  ConsumerState<_RequestCard> createState() => _RequestCardState();
}

class _RequestCardState extends ConsumerState<_RequestCard> {
  bool _busy = false;

  BookingSummary get b => widget.booking;

  Future<void> _approve() async {
    final ok = await confirmDialog(context, title: 'Talebi onayla', message: '${b.title} · ${formatLessonRange(b.startAt, b.endAt)}', confirmText: 'Onayla');
    if (!ok) return;
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).approve(b.id);
      bumpBookings(ref);
      if (mounted) showSnack(context, 'Ders onaylandı; veliye bildirim gitti.');
    } on ApiException catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reject() async {
    final reason = await reasonDialog(
      context,
      title: b.isQuestion ? 'Soruyu reddet' : 'Talebi reddet',
      message: 'Veliye ücretin tamamı otomatik iade edilir.',
      confirmText: 'Reddet',
      presets: const ['O saatte müsait değilim', 'Bu konu/seviye için uygun değilim', 'Diğer'],
      destructive: true,
    );
    if (reason == null) return;
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).reject(b.id, reason);
      bumpBookings(ref);
      if (mounted) showSnack(context, 'Talep reddedildi; veliye tam iade yapıldı.');
    } on ApiException catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final deadline = b.approvalDeadline;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push(Routes.lesson(b.id)),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(b.title, style: Theme.of(context).textTheme.titleMedium),
                        Text(b.serviceName, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(b.isIntro ? 'Ücretsiz' : formatMoney(b.amount), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                      Text(b.isIntro ? 'tanışma' : 'kazancınız', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 11.5)),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 10),
              if (b.isQuestion)
                Text('Fotoğrafla soru · çözüm bekliyor', style: TextStyle(color: scheme.primary, fontWeight: FontWeight.w700))
              else
                Row(
                  children: [
                    Icon(b.isOnline ? Icons.videocam_rounded : Icons.place_rounded, size: 18, color: scheme.onSurfaceVariant),
                    const SizedBox(width: 6),
                    Expanded(child: Text('${formatLessonRange(b.startAt, b.endAt)} · ${modeLabels[b.mode] ?? b.mode}', style: const TextStyle(fontWeight: FontWeight.w600))),
                  ],
                ),
              const SizedBox(height: 4),
              Text('Öğrenci: ${b.learnerName} · Veli/hesap: ${b.counterpart.name}', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
              if (deadline != null) ...[
                const SizedBox(height: 10),
                Align(
                  alignment: Alignment.centerLeft,
                  child: ToneBadge(label: '${formatDuration(deadline.difference(DateTime.now()))} içinde yanıtlayın', tone: Tone.amber, icon: Icons.schedule_rounded),
                ),
              ],
              const SizedBox(height: 14),
              if (_busy)
                const Center(child: Padding(padding: EdgeInsets.all(8), child: CircularProgressIndicator()))
              else
                Row(
                  children: [
                    if (b.isQuestion)
                      Expanded(child: FilledButton.icon(onPressed: () => context.push(Routes.lesson(b.id)), icon: const Icon(Icons.edit_note_rounded), label: const Text('Soruyu çöz')))
                    else
                      Expanded(child: FilledButton.icon(onPressed: _approve, icon: const Icon(Icons.check_rounded), label: const Text('Onayla'))),
                    const SizedBox(width: 10),
                    Expanded(child: OutlinedButton.icon(onPressed: _reject, icon: const Icon(Icons.close_rounded), label: const Text('Reddet'))),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}
