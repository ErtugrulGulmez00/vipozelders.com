import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format/dates.dart';
import '../../core/models/pool.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/media.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';

/// Rozet rengi: soru durumu.
Tone poolTone(String status) => switch (status) {
      'OPEN' => Tone.amber,
      'CLAIMED' => Tone.sky,
      'ANSWERED' => Tone.green,
      'CLOSED' => Tone.brand,
      'REJECTED' => Tone.rose,
      'DISPUTED' => Tone.violet,
      _ => Tone.slate,
    };

/// Öğrencinin soru havuzuna gönderdiği sorular.
class MyQuestionsScreen extends ConsumerWidget {
  const MyQuestionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final revision = ref.watch(questionsRevisionProvider);
    return Scaffold(
      appBar: AppBar(leading: const AppBackButton(fallback: Routes.ask), title: const Text('Sorularım')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(Routes.ask),
        icon: const Icon(Icons.add_a_photo_rounded),
        label: const Text('Soru sor'),
      ),
      body: PagedListView<PoolQuestion>(
        key: ValueKey(revision),
        load: (page) async {
          final result = await ref.read(apiProvider).myQuestions(page: page);
          return (result.items, result.nextPage);
        },
        empty: EmptyView(
          icon: Icons.help_outline_rounded,
          title: 'Henüz soru göndermediniz',
          message: 'Takıldığınız sorunun fotoğrafını çekin, branş öğretmeni adım adım çözsün.',
          action: FilledButton(onPressed: () => context.push(Routes.ask), child: const Text('Soru sor')),
        ),
        itemBuilder: (context, q) => QuestionTile(question: q, onTap: () => context.push(Routes.myQuestion(q.id))),
      ),
    );
  }
}

/// Soru kartı (öğrenci ve öğretmen listeleri).
class QuestionTile extends StatelessWidget {
  const QuestionTile({super.key, required this.question, required this.onTap, this.trailing});

  final PoolQuestion question;
  final VoidCallback onTap;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    final q = question;
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: scheme.outlineVariant)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(
                  width: 72,
                  height: 72,
                  child: q.imageUrl == null ? ColoredBox(color: scheme.surfaceContainerHighest) : AuthImage(url: q.imageUrl!, height: 72, fit: BoxFit.cover, zoomable: false),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(q.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text(
                      [q.code, formatRelative(q.createdAt), ?trailing].join(' · '),
                      style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12),
                    ),
                    if (q.note != null) ...[
                      const SizedBox(height: 4),
                      Text(q.note!, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
                    ],
                    const SizedBox(height: 6),
                    ToneBadge(label: q.statusLabel, tone: poolTone(q.status)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
