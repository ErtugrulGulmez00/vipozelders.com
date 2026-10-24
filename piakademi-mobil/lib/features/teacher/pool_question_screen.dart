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
import '../../core/widgets/badges.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/media.dart';
import '../../core/widgets/photo_picker.dart';
import '../../core/widgets/states.dart';
import '../questions/my_questions_screen.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';

/// Havuz sorusu (öğretmen): üstlen → çöz (yazı + isteğe bağlı fotoğraf/video) ya da geri çevir / bırak; ek soruya cevap.
/// Öğrencinin adı gösterilmez.
class PoolQuestionScreen extends ConsumerWidget {
  const PoolQuestionScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(leading: const AppBackButton(fallback: Routes.teacherPool), title: const Text('Havuz sorusu')),
      body: AsyncBody<PoolQuestion>(
        value: ref.watch(poolQuestionProvider(id)),
        onRetry: () => ref.invalidate(poolQuestionProvider(id)),
        builder: (q) => _PoolQuestionBody(question: q),
      ),
    );
  }
}

class _PoolQuestionBody extends ConsumerStatefulWidget {
  const _PoolQuestionBody({required this.question});

  final PoolQuestion question;

  @override
  ConsumerState<_PoolQuestionBody> createState() => _PoolQuestionBodyState();
}

class _PoolQuestionBodyState extends ConsumerState<_PoolQuestionBody> {
  final _answer = TextEditingController();
  final _followUp = TextEditingController();
  PickedMedia? _image;
  PickedMedia? _video;
  bool _busy = false;
  double? _progress;

  PoolQuestion get q => widget.question;

  @override
  void dispose() {
    _answer.dispose();
    _followUp.dispose();
    super.dispose();
  }

  Future<void> _action(String action, [Map<String, dynamic> extra = const {}, String? done]) async {
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).poolAction(q.id, action, extra);
      bumpQuestions(ref);
      if (!mounted) return;
      if (done != null) showSnack(context, done);
      if (action == 'release' || action == 'reject') context.pop();
    } on ApiException catch (error) {
      if (mounted) showError(context, error);
      bumpQuestions(ref);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reject() async {
    final reason = await reasonDialog(
      context,
      title: 'Soruyu geri çevir',
      message: 'Soru tek soru değilse ya da okunmuyorsa geri çevirin; öğrencinin kredisi iade edilir, size ödeme yapılmaz.',
      confirmText: 'Geri çevir',
      presets: const ['Fotoğraf okunmuyor', 'Birden fazla soru var', 'Soru eksik / şıklar görünmüyor'],
      destructive: true,
    );
    if (reason != null) await _action('reject', {'reason': reason}, 'Soru geri çevrildi; öğrencinin kredisi iade edildi.');
  }

  Future<void> _submitAnswer() async {
    final text = _answer.text.trim();
    if (text.length < 20) {
      showSnack(context, 'Çözümü en az birkaç cümleyle açıklayın (en az 20 karakter).', error: true);
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _progress = 0;
    });
    try {
      await ref.read(apiProvider).answerPoolQuestion(
            q.id,
            body: text,
            image: _image?.file,
            video: _video?.file,
            onProgress: (sent, total) {
              if (total > 0 && mounted) setState(() => _progress = sent / total);
            },
          );
      bumpQuestions(ref);
      if (mounted) showSnack(context, 'Çözüm gönderildi; öğrenciye bildirim gitti.');
    } on ApiException catch (error) {
      if (mounted) showError(context, error);
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
    final scheme = Theme.of(context).colorScheme;
    final answer = q.answer;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Row(
          children: [
            Expanded(child: Text(q.title, style: Theme.of(context).textTheme.titleLarge)),
            ToneBadge(label: q.statusLabel, tone: poolTone(q.status)),
          ],
        ),
        const SizedBox(height: 4),
        Text('${q.code} · ${formatDateTime(q.createdAt)} · ${formatMoney(q.fee)}', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
        if (q.can('canAnswer') && q.claimExpiresAt != null) ...[
          const SizedBox(height: 12),
          NoticeBox(tone: Tone.sky, icon: Icons.timer_outlined, message: 'Soru sizde: ${formatTime(q.claimExpiresAt!)} saatine kadar çözmezseniz havuza geri döner.'),
        ],
        const SizedBox(height: 12),
        SectionCard(
          title: 'Soru',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (q.imageUrl != null) AuthImage(url: q.imageUrl!, height: 300, semanticLabel: 'Soru fotoğrafı'),
              if (q.note != null) ...[const SizedBox(height: 10), Text('Öğrencinin notu: ${q.note}')],
            ],
          ),
        ),
        if (q.can('canClaim')) ...[
          const SizedBox(height: 16),
          BusyButton(busy: _busy, onPressed: () => _action('claim', const {}, 'Soru sizde; çözümü gönderin.'), label: 'Üstlen ve çöz', icon: Icons.back_hand_rounded),
        ],
        if (q.can('canAnswer')) ...[
          const SizedBox(height: 12),
          SectionCard(
            title: 'Çözüm',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _answer,
                  maxLines: 8,
                  minLines: 4,
                  maxLength: 5000,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(hintText: 'Çözümü adım adım açıklayın. İletişim bilgisi paylaşmayın.'),
                ),
                if (_image != null) MediaPreview(media: _image!, onRemove: () => setState(() => _image = null), height: 180),
                if (_video != null) ...[const SizedBox(height: 8), MediaPreview(media: _video!, onRemove: () => setState(() => _video = null), height: 120)],
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: [
                    if (_image == null)
                      OutlinedButton.icon(
                        onPressed: () async {
                          final photo = await pickPhoto(context, title: 'Çözüm fotoğrafı');
                          if (photo != null) setState(() => _image = photo);
                        },
                        icon: const Icon(Icons.add_a_photo_outlined, size: 18),
                        label: const Text('Fotoğraf'),
                      ),
                    if (_video == null)
                      OutlinedButton.icon(
                        onPressed: () async {
                          final video = await pickVideo(context);
                          if (video != null) setState(() => _video = video);
                        },
                        icon: const Icon(Icons.videocam_outlined, size: 18),
                        label: const Text('Video'),
                      ),
                  ],
                ),
                if (_progress != null) ...[const SizedBox(height: 8), LinearProgressIndicator(value: _progress)],
                const SizedBox(height: 12),
                BusyButton(busy: _busy, onPressed: _submitAnswer, label: 'Çözümü gönder', icon: Icons.send_rounded),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(child: TextButton(onPressed: _busy ? null : () => _action('release', const {}, 'Soru havuza geri bırakıldı.'), child: const Text('Havuza bırak'))),
              Expanded(child: TextButton(onPressed: _busy ? null : _reject, style: TextButton.styleFrom(foregroundColor: scheme.error), child: const Text('Geri çevir'))),
            ],
          ),
        ],
        if (answer != null && q.mine) ...[
          const SizedBox(height: 12),
          SectionCard(
            title: 'Çözümünüz',
            subtitle: answer.answeredAt == null ? null : formatDateTime(answer.answeredAt!),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (answer.text != null) SelectableText(answer.text!, style: const TextStyle(height: 1.45)),
                if (answer.imageUrl != null) ...[const SizedBox(height: 10), AuthImage(url: answer.imageUrl!, height: 220)],
                if (answer.videoUrl != null) ...[const SizedBox(height: 10), AuthVideo(url: answer.videoUrl!)],
                if (q.rating != null) ...[const SizedBox(height: 10), Text('Öğrencinin puanı: ${q.rating}/5', style: const TextStyle(fontWeight: FontWeight.w600))],
                if (q.releaseAt != null && q.status == 'ANSWERED') ...[
                  const SizedBox(height: 6),
                  Text('Hakedişiniz ${formatDateTime(q.releaseAt!)} sonrasında serbest kalır.', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
                ],
              ],
            ),
          ),
          if (answer.followUp != null) ...[
            const SizedBox(height: 12),
            SectionCard(
              title: 'Öğrencinin ek sorusu',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(answer.followUp!.text),
                  const SizedBox(height: 10),
                  if (answer.followUp!.answer != null)
                    NoticeBox(tone: Tone.green, title: 'Cevabınız', message: answer.followUp!.answer!)
                  else if (q.can('canAnswerFollowUp')) ...[
                    TextField(controller: _followUp, maxLines: 4, maxLength: 3000, textCapitalization: TextCapitalization.sentences, decoration: const InputDecoration(hintText: 'Cevabınızı yazın')),
                    BusyButton(
                      busy: _busy,
                      label: 'Cevabı gönder',
                      icon: Icons.send_rounded,
                      onPressed: () {
                        final text = _followUp.text.trim();
                        if (text.length < 5) {
                          showSnack(context, 'Cevabı yazın.', error: true);
                          return;
                        }
                        _action('followUpAnswer', {'body': text}, 'Cevabınız öğrenciye iletildi.');
                      },
                    ),
                  ],
                ],
              ),
            ),
          ],
          if (q.disputeReason != null) ...[
            const SizedBox(height: 12),
            NoticeBox(tone: Tone.violet, title: 'Öğrencinin itirazı', message: q.resolutionNote == null ? q.disputeReason! : '${q.disputeReason}\n\nSonuç: ${q.resolutionNote}'),
          ],
        ],
      ],
    );
  }
}
