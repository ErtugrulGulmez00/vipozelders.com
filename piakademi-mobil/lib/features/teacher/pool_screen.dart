import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/format/dates.dart';
import '../../core/format/money.dart';
import '../../core/models/pool.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/states.dart';
import '../questions/my_questions_screen.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';

/// Öğretmenin soru havuzu: verdiği kademe ve derslere düşen açık sorular, üstlendikleri ve çözdükleri.
class TeacherPoolScreen extends ConsumerWidget {
  const TeacherPoolScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(leading: const AppBackButton(fallback: Routes.teacherHome), title: const Text('Soru havuzu')),
      body: AsyncBody<TeacherPool>(
        value: ref.watch(teacherPoolProvider),
        onRetry: () => ref.invalidate(teacherPoolProvider),
        builder: (pool) => RefreshIndicator(onRefresh: () async => ref.invalidate(teacherPoolProvider), child: _PoolBody(pool: pool)),
      ),
    );
  }
}

class _PoolBody extends ConsumerStatefulWidget {
  const _PoolBody({required this.pool});

  final TeacherPool pool;

  @override
  ConsumerState<_PoolBody> createState() => _PoolBodyState();
}

class _PoolBodyState extends ConsumerState<_PoolBody> {
  bool _busy = false;

  Future<void> _toggle(bool on) async {
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).setAnswersPool(on);
      bumpQuestions(ref);
      if (mounted) showSnack(context, on ? 'Soru havuzuna katıldınız.' : 'Soru havuzundan ayrıldınız; yeni soru bildirimi almayacaksınız.');
    } on ApiException catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.pool;
    final scheme = Theme.of(context).colorScheme;
    final claimed = p.mine.where((q) => q.status == 'CLAIMED').toList();
    final done = p.mine.where((q) => q.status != 'CLAIMED').toList();
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: p.answersPool,
                onChanged: _busy ? null : _toggle,
                title: const Text('Soru havuzuna katıl', style: TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text('Verdiğiniz kademe ve derslere düşen fotoğraflı soruları görür, üstlenip çözersiniz. Soru başı ${formatMoney(p.fee)}.'),
              ),
              Text(
                'Üstlendiğiniz soru ${p.claimMinutes} dakika sizde kalır; aynı anda en fazla ${p.maxActiveClaims} soru. '
                'Çözümü birkaç cümleyle açıklayın; yalnızca şık yazmak yeterli değil. İletişim bilgisi paylaşmak yasaktır.',
                style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13, height: 1.4),
              ),
              if (p.ratingCount > 0) ...[
                const SizedBox(height: 8),
                Text('Çözüm puanınız: ${p.ratingAvg?.toStringAsFixed(1) ?? '-'} (${p.ratingCount} puan)', style: const TextStyle(fontWeight: FontWeight.w600)),
              ],
            ],
          ),
        ),
        if (p.blocked) ...[
          const SizedBox(height: 12),
          const NoticeBox(tone: Tone.rose, message: 'Puanınız ya da haklı bulunan itirazlar nedeniyle soru havuzuna erişiminiz geçici olarak kapalı. Destek ekibiyle görüşün.'),
        ] else if (!p.eligible && p.answersPool) ...[
          const SizedBox(height: 12),
          const NoticeBox(tone: Tone.amber, message: 'Havuzdaki soruları görebilmek için profilinizin yayında (ve gerekiyorsa onaylı) olması ve aktif dersiniz olması gerekir.'),
        ],
        if (claimed.isNotEmpty) ...[
          const SectionTitle('Sizdeki sorular'),
          for (final q in claimed) _tile(context, q, q.claimExpiresAt == null ? null : '${formatTime(q.claimExpiresAt!)}’e kadar sizde'),
        ],
        SectionTitle('Havuzdaki sorular (${p.open.length})'),
        if (p.open.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Text(
              p.answersPool ? 'Şu an derslerinize uygun açık soru yok. Yeni soru gelince bildirim alırsınız.' : 'Havuza katılınca derslerinize uygun sorular burada görünür.',
              style: TextStyle(color: scheme.onSurfaceVariant),
            ),
          )
        else
          for (final q in p.open) _tile(context, q, q.expiresAt == null ? null : 'son ${formatCompact(q.expiresAt!)}'),
        if (done.isNotEmpty) ...[
          const SectionTitle('Son çözdükleriniz'),
          for (final q in done) _tile(context, q, null),
        ],
      ],
    );
  }

  Widget _tile(BuildContext context, PoolQuestion q, String? hint) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: QuestionTile(question: q, trailing: hint, onTap: () => context.push(Routes.poolQuestion(q.id))),
      );
}
