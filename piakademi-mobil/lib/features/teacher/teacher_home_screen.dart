import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format/money.dart';
import '../../core/models/teacher_panel.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/rating.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';

/// Öğretmen ana ekranı: bekleyen talepler, yaklaşan dersler, puan, bakiye, profil eksikleri.
class TeacherHomeScreen extends ConsumerWidget {
  const TeacherHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(sessionProvider.select((s) => s.me));
    final summary = ref.watch(teacherSummaryProvider);
    return Scaffold(
      appBar: AppBar(
        title: Text('Merhaba ${me?.firstName ?? ''}'),
        actions: const [NotificationBell()],
      ),
      body: AsyncBody(
        value: summary,
        onRetry: () => ref.invalidate(teacherSummaryProvider),
        builder: (data) => RefreshIndicator(
          onRefresh: () => ref.refresh(teacherSummaryProvider.future),
          child: _Body(data: data),
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.data});

  final TeacherSummary data;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.fromLTRB(16, 8, 16, 32 + MediaQuery.paddingOf(context).bottom),
      children: [
        const MaintenanceBanner(),
        if (!data.published || data.missing.isNotEmpty) ...[
          NoticeBox(
            tone: data.published ? Tone.sky : Tone.amber,
            title: data.published ? 'Profilinizi güçlendirin' : 'Profiliniz henüz yayında değil',
            message: data.missing.isEmpty ? 'Profiliniz yönetici onayından sonra yayınlanır.' : 'Eksikler: ${data.missing.map((c) => c.label).join(', ')}.',
            action: TextButton.icon(
              onPressed: () => context.push(Routes.teacherWeb('/ogretmen-paneli/profil', 'Profil ve fotoğraf')),
              icon: const Icon(Icons.edit_outlined, size: 18),
              label: const Text('Profili tamamla'),
            ),
          ),
          const SizedBox(height: 12),
        ],
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 1.45,
          children: [
            StatTile(
              icon: Icons.inbox_rounded,
              label: 'Bekleyen talep',
              value: '${data.pendingRequests.length}',
              hint: data.pendingRequests.isEmpty ? 'Yanıt bekleyen yok' : 'Hemen yanıtlayın',
              onTap: () => context.go(Routes.teacherRequests),
            ),
            StatTile(
              icon: Icons.star_rounded,
              label: 'Puanınız',
              value: data.ratingCount > 0 ? formatRating(data.ratingAvg) : '—',
              hint: '${data.ratingCount} yorum · ${data.completedLessons} ders',
              onTap: () => context.push(Routes.teacherReviews),
            ),
            StatTile(
              icon: Icons.hourglass_top_rounded,
              label: 'Bekleyen kazanç',
              value: formatMoney(data.balances.pending),
              hint: 'İtiraz süresi dolunca serbest kalır',
              onTap: () => context.push(Routes.earnings),
            ),
            StatTile(
              icon: Icons.account_balance_wallet_rounded,
              label: 'Ödenebilir',
              value: formatMoney(data.balances.available),
              hint: 'Ödenen ${formatMoney(data.balances.paid)}',
              onTap: () => context.push(Routes.earnings),
            ),
          ],
        ),
        const SizedBox(height: 8),
        SectionTitle(
          'Yanıt bekleyen talepler',
          padding: const EdgeInsets.fromLTRB(4, 16, 0, 8),
          action: data.pendingRequests.isEmpty ? null : TextButton(onPressed: () => context.go(Routes.teacherRequests), child: const Text('Tümü')),
        ),
        if (data.pendingRequests.isEmpty)
          Text('Yanıt bekleyen talep yok.', style: TextStyle(color: scheme.onSurfaceVariant))
        else
          for (final b in data.pendingRequests.take(3)) Padding(padding: const EdgeInsets.only(bottom: 10), child: BookingTile(booking: b, teacherView: true)),
        SectionTitle(
          'Yaklaşan dersler',
          padding: const EdgeInsets.fromLTRB(4, 16, 0, 8),
          action: TextButton(onPressed: () => context.go(Routes.teacherLessons), child: const Text('Tümü')),
        ),
        if (data.upcoming.isEmpty)
          Text('Yaklaşan onaylı ders yok.', style: TextStyle(color: scheme.onSurfaceVariant))
        else
          for (final b in data.upcoming) Padding(padding: const EdgeInsets.only(bottom: 10), child: BookingTile(booking: b, teacherView: true)),
        const SizedBox(height: 16),
        Card(
          child: Column(
            children: [
              ListTile(leading: const Icon(Icons.payments_outlined), title: const Text('Kazançlar'), trailing: const Icon(Icons.chevron_right_rounded), onTap: () => context.push(Routes.earnings)),
              const Divider(height: 1),
              ListTile(leading: const Icon(Icons.reviews_outlined), title: const Text('Yorumlar'), trailing: const Icon(Icons.chevron_right_rounded), onTap: () => context.push(Routes.teacherReviews)),
              const Divider(height: 1),
              ListTile(leading: const Icon(Icons.calendar_month_outlined), title: const Text('Müsaitlik takvimi'), trailing: const Icon(Icons.chevron_right_rounded), onTap: () => context.go(Routes.teacherCalendar)),
            ],
          ),
        ),
      ],
    );
  }
}
