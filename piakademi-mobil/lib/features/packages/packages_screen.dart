import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/format/dates.dart';
import '../../core/format/money.dart';
import '../../core/models/commerce.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/avatar.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';

/// Paketlerim: kalan ders, paketten alınan dersler, ders alma ve iade.
class PackagesScreen extends ConsumerWidget {
  const PackagesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(leading: const AppBackButton(fallback: Routes.account), title: const Text('Paketlerim')),
      body: AsyncBody<List<LessonPackage>>(
        value: ref.watch(packagesProvider),
        onRetry: () => ref.invalidate(packagesProvider),
        builder: (items) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(packagesProvider),
          child: items.isEmpty
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: const [
                    SizedBox(height: 60),
                    EmptyView(
                      icon: Icons.inventory_2_outlined,
                      title: 'Henüz paketiniz yok',
                      message: 'Öğretmen profilindeki “Paket ders” ile dersleri peşin ve indirimli alabilir, “Düzenli ders” ile her hafta aynı saati ayırabilirsiniz.',
                    ),
                  ],
                )
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 12),
                  itemBuilder: (context, i) => _PackageCard(pkg: items[i]),
                ),
        ),
      ),
    );
  }
}

class _PackageCard extends ConsumerStatefulWidget {
  const _PackageCard({required this.pkg});

  final LessonPackage pkg;

  @override
  ConsumerState<_PackageCard> createState() => _PackageCardState();
}

class _PackageCardState extends ConsumerState<_PackageCard> {
  bool _busy = false;

  Future<void> _refund() async {
    final p = widget.pkg;
    final ok = await confirmDialog(
      context,
      title: 'Kalan dersleri iade et',
      message: '${p.left} kullanılmamış ders için ${formatMoney(p.refund.amount)} kartınıza iade edilecek ve paket kapanacak. Kullanılan dersler indirimsiz ücretten düşülür.',
      confirmText: 'İade iste',
    );
    if (!ok || !mounted) return;
    setState(() => _busy = true);
    try {
      final message = await ref.read(apiProvider).refundPackage(p.id);
      if (!mounted) return;
      showSnack(context, message);
      bumpPurchases(ref);
    } on ApiException catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.pkg;
    final scheme = Theme.of(context).colorScheme;
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Avatar(name: p.teacher.name, photoUrl: p.teacher.photoUrl, size: 40),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(p.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                    Text('${p.teacher.name} · ${durationLabel(p.durationMinutes)}${p.recurring ? ' · düzenli' : ''}', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
                  ],
                ),
              ),
              ToneBadge(label: p.active ? 'Aktif' : (p.status == 'PAID' ? 'Süresi doldu' : p.statusLabel), tone: p.active ? Tone.green : Tone.slate),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Text('${p.left}', style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800)),
              const SizedBox(width: 6),
              Text('/ ${p.lessonCount} ders kaldı', style: TextStyle(color: scheme.onSurfaceVariant)),
              const Spacer(),
              Text(formatMoney(p.price), style: const TextStyle(fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            [
              p.code,
              if (p.discountPercent > 0) '%${p.discountPercent} indirim',
              if (p.expiresAt != null) 'Son kullanma ${formatDate(p.expiresAt!)}',
              if (p.refundedAmount > 0) '${formatMoney(p.refundedAmount)} iade',
            ].join(' · '),
            style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12),
          ),
          if (p.bookings.isNotEmpty) ...[
            const Divider(height: 24),
            for (final b in p.bookings)
              InkWell(
                onTap: () => context.push(Routes.lesson(b.id)),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      const Icon(Icons.event_rounded, size: 18),
                      const SizedBox(width: 8),
                      Expanded(child: Text(formatLessonRange(b.startAt, b.endAt), style: const TextStyle(fontSize: 13))),
                      Text(b.statusLabel, style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
                    ],
                  ),
                ),
              ),
          ],
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              if (p.active && p.left > 0)
                FilledButton.icon(
                  onPressed: () => context.push(Routes.booking(p.teacher.slug, offeringId: p.offeringId)),
                  icon: const Icon(Icons.event_available_rounded, size: 18),
                  label: const Text('Ders al'),
                ),
              if (p.refund.allowed) OutlinedButton(onPressed: _busy ? null : _refund, child: Text('${formatMoney(p.refund.amount)} iade iste')),
            ],
          ),
          if (p.active && !p.refund.allowed && p.refund.reason != null && p.left > 0)
            Padding(padding: const EdgeInsets.only(top: 6), child: Text(p.refund.reason!, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12))),
        ],
      ),
    );
  }
}
