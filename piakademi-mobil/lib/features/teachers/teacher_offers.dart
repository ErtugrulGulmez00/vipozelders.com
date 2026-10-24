import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format/money.dart';
import '../../core/models/teacher.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/widgets/cards.dart';
import '../groups/group_screens.dart';

/// Öğretmen profilindeki satış seçenekleri: paket ders, düzenli ders, aylık soru aboneliği ve grup dersleri.
class TeacherOffers extends ConsumerWidget {
  const TeacherOffers({super.key, required this.teacher, required this.canBuy});

  final TeacherProfile teacher;

  /// Öğretmen hesabı satın alamaz (yalnızca görür)
  final bool canBuy;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = teacher;
    final rules = ref.watch(catalogProvider).valueOrNull?.rules;
    final scheme = Theme.of(context).colorScheme;
    final hasLessons = t.offerings.any((o) => o.durations.isNotEmpty);
    final packages = (rules?.packagesEnabled ?? false) && hasLessons;
    final children = <Widget>[];

    if (packages && (t.packageOffers.isNotEmpty || t.offersOnline)) {
      children.add(SectionCard(
        title: 'Paket ve düzenli ders',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (t.packageOffers.isNotEmpty) ...[
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final o in t.packageOffers)
                    Chip(avatar: const Icon(Icons.local_offer_outlined, size: 18), label: Text(o.percent > 0 ? '${o.lessons} derste %${o.percent} indirim' : '${o.lessons} derslik paket')),
                ],
              ),
              const SizedBox(height: 8),
              Text('Dersleri peşin alın, takvimden “Paketimden kullan” ile seçin.', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
            ],
            if (t.myPackages.isNotEmpty) ...[
              const SizedBox(height: 8),
              for (final p in t.myPackages)
                Text('Paketiniz: ${p.levelName} ${p.subjectName} · ${p.left} ders kaldı', style: const TextStyle(fontWeight: FontWeight.w600)),
            ],
            if (canBuy) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (t.packageOffers.isNotEmpty)
                    FilledButton.tonalIcon(onPressed: () => context.push(Routes.packageBuy(t.slug)), icon: const Icon(Icons.inventory_2_outlined, size: 18), label: const Text('Paket al')),
                  if (t.offersOnline)
                    OutlinedButton.icon(
                      onPressed: () => context.push(Routes.packageBuy(t.slug, recurring: true)),
                      icon: const Icon(Icons.event_repeat_rounded, size: 18),
                      label: const Text('Her hafta aynı saat'),
                    ),
                ],
              ),
            ],
          ],
        ),
      ));
    }

    if (t.questionPlans.isNotEmpty) {
      children.add(SectionCard(
        title: 'Aylık soru aboneliği',
        subtitle: 'Sorularınız havuza düşmeden doğrudan bu öğretmene gider, kredi harcamaz.',
        child: Column(
          children: [
            for (final p in t.questionPlans)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.subscriptions_outlined),
                title: Text(p.title, style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle: Text('Günde ${p.dailyLimit} soru · en geç ${p.answerHours} saatte cevap · ${p.days} gün'),
                trailing: canBuy
                    ? FilledButton.tonal(onPressed: () => context.push(Routes.subscribe(t.slug, p.id)), child: Text(formatMoney(p.price)))
                    : Text(formatMoney(p.price), style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
          ],
        ),
      ));
    }

    if (t.groupCourses.isNotEmpty) {
      children.add(SectionCard(
        title: 'Grup dersleri',
        subtitle: 'Küçük gruplarla canlı ders; kişi başı ücret.',
        child: Column(
          children: [
            for (final c in t.groupCourses) Padding(padding: const EdgeInsets.only(bottom: 8), child: GroupCourseTile(course: c)),
          ],
        ),
      ));
    }

    if (children.isEmpty) return const SizedBox.shrink();
    return Column(
      children: [
        for (final child in children) ...[const SizedBox(height: 12), child],
      ],
    );
  }
}
