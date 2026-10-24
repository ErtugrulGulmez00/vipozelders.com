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
import '../../core/widgets/photo_picker.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';

/// Aboneliklerim: dönem, günlük hak; aktif abonelikte öğretmene doğrudan soru gönderme ve yenileme.
class SubscriptionsScreen extends ConsumerWidget {
  const SubscriptionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(leading: const AppBackButton(fallback: Routes.account), title: const Text('Soru aboneliklerim')),
      body: AsyncBody<List<QuestionSubscription>>(
        value: ref.watch(subscriptionsProvider),
        onRetry: () => ref.invalidate(subscriptionsProvider),
        builder: (items) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(subscriptionsProvider),
          child: items.isEmpty
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: const [
                    SizedBox(height: 60),
                    EmptyView(
                      icon: Icons.subscriptions_outlined,
                      title: 'Aboneliğiniz yok',
                      message: 'Bazı öğretmenler aylık soru aboneliği sunar: soruları doğrudan öğretmene gider, kredi harcamaz. Öğretmen profilinde “Aylık soru aboneliği” bölümüne bakın.',
                    ),
                  ],
                )
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 12),
                  itemBuilder: (context, i) => _SubscriptionCard(sub: items[i]),
                ),
        ),
      ),
    );
  }
}

class _SubscriptionCard extends StatelessWidget {
  const _SubscriptionCard({required this.sub});

  final QuestionSubscription sub;

  @override
  Widget build(BuildContext context) {
    final s = sub;
    final scheme = Theme.of(context).colorScheme;
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Avatar(name: s.teacher.name, photoUrl: s.teacher.photoUrl, size: 40),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(s.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                    Text(s.teacher.name, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
                  ],
                ),
              ),
              ToneBadge(label: s.statusLabel, tone: s.running ? Tone.green : Tone.slate),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            [
              if (s.startsAt != null && s.endsAt != null) '${formatDate(s.startsAt!)} – ${formatDate(s.endsAt!)}',
              'Günde ${s.dailyLimit} soru',
              'Cevap ${s.answerHours} saat',
              formatMoney(s.price),
            ].join(' · '),
            style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13),
          ),
          if (s.running) ...[
            const SizedBox(height: 10),
            Text('Bugün kalan hakkınız: ${s.leftToday}', style: const TextStyle(fontWeight: FontWeight.w600)),
          ],
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (s.running)
                FilledButton.icon(
                  onPressed: s.leftToday > 0 ? () => context.push(Routes.subscriptionAsk(s.id)) : null,
                  icon: const Icon(Icons.add_a_photo_rounded, size: 18),
                  label: const Text('Soru sor'),
                ),
              if (s.planId != null && (s.running || s.status == 'ENDED'))
                OutlinedButton(onPressed: () => context.push(Routes.subscribe(s.teacher.slug, s.planId!)), child: Text(s.running ? 'Yenile' : 'Yeniden abone ol')),
              TextButton(onPressed: () => context.push(Routes.myQuestions), child: const Text('Sorularım')),
            ],
          ),
        ],
      ),
    );
  }
}

/// Abone olunan öğretmene soru: fotoğraf ve not; günlük hak sınırı sunucuda denetlenir.
class SubscriptionAskScreen extends ConsumerStatefulWidget {
  const SubscriptionAskScreen({super.key, required this.subscriptionId});

  final String subscriptionId;

  @override
  ConsumerState<SubscriptionAskScreen> createState() => _SubscriptionAskScreenState();
}

class _SubscriptionAskScreenState extends ConsumerState<SubscriptionAskScreen> {
  PickedMedia? _photo;
  final _note = TextEditingController();
  bool _busy = false;
  double? _progress;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_photo == null) {
      setState(() => _error = 'Sorunun fotoğrafını ekleyin.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _progress = 0;
    });
    try {
      final q = await ref.read(apiProvider).askSubscriptionQuestion(
            widget.subscriptionId,
            note: _note.text.trim(),
            image: _photo!.file,
            onProgress: (sent, total) {
              if (total > 0 && mounted) setState(() => _progress = sent / total);
            },
          );
      bumpQuestions(ref);
      if (!mounted) return;
      showSnack(context, 'Sorunuz öğretmeninize iletildi.');
      context.pushReplacement(Routes.myQuestion(q.id));
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _progress = null;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final subs = ref.watch(subscriptionsProvider).valueOrNull ?? const [];
    final sub = subs.where((s) => s.id == widget.subscriptionId).firstOrNull;
    return Scaffold(
      appBar: AppBar(leading: const AppBackButton(fallback: Routes.subscriptions), title: const Text('Öğretmenime soru')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          if (sub != null)
            NoticeBox(
              tone: Tone.brand,
              icon: Icons.subscriptions_rounded,
              message: '${sub.teacher.name} · ${sub.title}. Bugün kalan hakkınız ${sub.leftToday}; öğretmeniniz en geç ${sub.answerHours} saat içinde cevaplar.',
            ),
          const SizedBox(height: 16),
          if (_photo == null)
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(120)),
              onPressed: () async {
                final photo = await pickPhoto(context, title: 'Sorunun fotoğrafı');
                if (photo != null) setState(() => _photo = photo);
              },
              icon: const Icon(Icons.add_a_photo_outlined, size: 28),
              label: const Text('Fotoğraf çek / seç'),
            )
          else
            MediaPreview(media: _photo!, onRemove: () => setState(() => _photo = null), height: 260),
          const SizedBox(height: 16),
          TextField(
            controller: _note,
            maxLines: 3,
            maxLength: 1000,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(labelText: 'Not (isteğe bağlı)', helperText: 'İletişim bilgileri otomatik gizlenir.'),
          ),
          if (_error != null) ...[const SizedBox(height: 8), NoticeBox(message: _error!, tone: Tone.rose)],
          if (_progress != null) ...[const SizedBox(height: 8), LinearProgressIndicator(value: _progress)],
          const SizedBox(height: 16),
          BusyButton(busy: _busy, onPressed: _send, label: 'Gönder', icon: Icons.send_rounded),
        ],
      ),
    );
  }
}
