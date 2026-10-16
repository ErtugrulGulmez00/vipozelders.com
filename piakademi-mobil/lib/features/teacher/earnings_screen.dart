import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/config.dart';
import '../../core/format/dates.dart';
import '../../core/format/money.dart';
import '../../core/models/teacher_panel.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';

/// Kazançlar: bekleyen / ödenebilir / ödenen, son hareketler, havaleler ve maskeli IBAN.
class EarningsScreen extends ConsumerWidget {
  const EarningsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final earnings = ref.watch(earningsProvider);
    return Scaffold(
      appBar: AppBar(leading: const AppBackButton(), title: const Text('Kazançlar')),
      body: AsyncBody(
        value: earnings,
        onRetry: () => ref.invalidate(earningsProvider),
        builder: (data) => RefreshIndicator(onRefresh: () => ref.refresh(earningsProvider.future), child: _Body(data: data)),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.data});

  final Earnings data;

  static Tone _tone(String bucket) => switch (bucket) {
        'AVAILABLE' => Tone.green,
        'PAID' => Tone.brand,
        _ => Tone.amber,
      };

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final b = data.balances;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.fromLTRB(16, 8, 16, 32 + MediaQuery.paddingOf(context).bottom),
      children: [
        Row(
          children: [
            Expanded(child: StatTile(label: 'Bekleyen', value: formatMoney(b.pending), hint: 'İtiraz süresi sonrası')),
            const SizedBox(width: 8),
            Expanded(child: StatTile(label: 'Ödenebilir', value: formatMoney(b.available), hint: 'Sıradaki havalede')),
          ],
        ),
        const SizedBox(height: 8),
        StatTile(label: 'Toplam ödenen', value: formatMoney(b.paid)),
        const SizedBox(height: 12),
        SectionCard(
          title: 'Ödeme hesabı',
          child: data.payoutAccount == null
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('IBAN bilginiz eksik. Hakedişlerin ödenebilmesi için web panelinden ekleyin.', style: TextStyle(color: scheme.onSurfaceVariant)),
                    TextButton.icon(
                      onPressed: () => openExternal(context, '${AppConfig.siteUrl}/ogretmen-paneli/kazanclar'),
                      icon: const Icon(Icons.open_in_new_rounded, size: 18),
                      label: const Text('IBAN ekle'),
                    ),
                  ],
                )
              : Column(
                  children: [
                    if (data.payoutAccount!.legalName != null) InfoRow(label: 'Hesap sahibi', value: data.payoutAccount!.legalName!),
                    InfoRow(label: 'IBAN', value: data.payoutAccount!.ibanMasked),
                  ],
                ),
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: 'Son hareketler',
          padding: const EdgeInsets.fromLTRB(4, 8, 4, 8),
          child: data.entries.isEmpty
              ? const Padding(padding: EdgeInsets.all(12), child: Text('Henüz hareket yok.'))
              : Column(
                  children: [
                    for (final e in data.entries)
                      ListTile(
                        dense: true,
                        onTap: e.bookingId == null ? null : () => context.push(Routes.lesson(e.bookingId!)),
                        title: Text(formatMoney(e.amount), style: TextStyle(fontWeight: FontWeight.w800, color: e.amount < 0 ? scheme.error : null)),
                        subtitle: Text('${e.description ?? ''}\n${formatCompact(e.createdAt)}'),
                        isThreeLine: true,
                        trailing: ToneBadge(label: e.bucketLabel, tone: _tone(e.bucket)),
                      ),
                  ],
                ),
        ),
        const SizedBox(height: 12),
        SectionCard(
          title: 'Yapılan ödemeler (havale)',
          padding: const EdgeInsets.fromLTRB(4, 8, 4, 8),
          child: data.payouts.isEmpty
              ? const Padding(padding: EdgeInsets.all(12), child: Text('Henüz ödeme yapılmadı.'))
              : Column(
                  children: [
                    for (final p in data.payouts)
                      ListTile(
                        dense: true,
                        leading: const Icon(Icons.account_balance_rounded),
                        title: Text(formatMoney(p.amount), style: const TextStyle(fontWeight: FontWeight.w800)),
                        subtitle: Text([formatDate(p.createdAt), if (p.reference != null) p.reference!].join(' · ')),
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}
