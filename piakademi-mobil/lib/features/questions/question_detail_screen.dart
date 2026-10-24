import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/format/dates.dart';
import '../../core/models/pool.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/avatar.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/media.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';
import 'my_questions_screen.dart';

/// Öğrencinin soru ayrıntısı: soru, öğretmenin çözümü, bir kez ek soru, puan ve sorun bildirme.
class QuestionDetailScreen extends ConsumerWidget {
  const QuestionDetailScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(leading: const AppBackButton(fallback: Routes.myQuestions), title: const Text('Soru')),
      body: AsyncBody<PoolQuestion>(
        value: ref.watch(myQuestionProvider(id)),
        onRetry: () => ref.invalidate(myQuestionProvider(id)),
        builder: (q) => RefreshIndicator(onRefresh: () async => ref.invalidate(myQuestionProvider(id)), child: _QuestionBody(question: q)),
      ),
    );
  }
}

class _QuestionBody extends ConsumerStatefulWidget {
  const _QuestionBody({required this.question});

  final PoolQuestion question;

  @override
  ConsumerState<_QuestionBody> createState() => _QuestionBodyState();
}

class _QuestionBodyState extends ConsumerState<_QuestionBody> {
  final _followUp = TextEditingController();
  int _rating = 0;
  bool _busy = false;

  PoolQuestion get q => widget.question;

  @override
  void dispose() {
    _followUp.dispose();
    super.dispose();
  }

  Future<void> _run(String action, [Map<String, dynamic> extra = const {}, String? done]) async {
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).questionAction(q.id, action, extra);
      bumpQuestions(ref);
      if (mounted && done != null) showSnack(context, done);
    } on ApiException catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel() async {
    final ok = await confirmDialog(context, title: 'Soruyu geri çek', message: 'Soru havuzdan kaldırılır ve krediniz iade edilir.', confirmText: 'Geri çek', destructive: true);
    if (ok) await _run('cancel', const {}, 'Soru geri çekildi, krediniz iade edildi.');
  }

  Future<void> _dispute() async {
    final reason = await reasonDialog(
      context,
      title: 'Çözümde sorun bildir',
      message: 'Çözüm yanlış ya da eksikse ekibimiz inceler; haklı bulunursa krediniz iade edilir.',
      confirmText: 'Bildir',
      hint: 'Neyin yanlış ya da eksik olduğunu kısaca yazın',
      minLength: 10,
    );
    if (reason != null) await _run('dispute', {'reason': reason}, 'Bildiriminiz alındı; ekibimiz inceleyip size dönecek.');
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final answer = q.answer;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Row(
          children: [
            Expanded(child: Text(q.title, style: Theme.of(context).textTheme.titleLarge)),
            ToneBadge(label: q.statusLabel, tone: poolTone(q.status)),
          ],
        ),
        const SizedBox(height: 4),
        Text('${q.code} · ${formatDateTime(q.createdAt)}', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
        const SizedBox(height: 12),
        if (q.status == 'OPEN' || q.status == 'CLAIMED')
          NoticeBox(
            tone: q.status == 'OPEN' ? Tone.amber : Tone.sky,
            icon: Icons.hourglass_top_rounded,
            message: q.status == 'OPEN'
                ? 'Sorunuz öğretmen bekliyor. ${q.expiresAt == null ? '' : '${formatDateTime(q.expiresAt!)} saatine kadar çözülmezse krediniz iade edilir.'}'
                : 'Bir öğretmen sorunuzu üstlendi ve çözüyor; çözüm gelince bildirim alacaksınız.',
          ),
        if (q.rejectReason != null && q.status == 'REJECTED') NoticeBox(tone: Tone.rose, title: 'Soru çözülemedi, krediniz iade edildi', message: 'Öğretmenin notu: “${q.rejectReason}”. Soruyu net ve tek soru olacak şekilde tekrar gönderebilirsiniz.'),
        if (q.status == 'DISPUTED') const NoticeBox(tone: Tone.violet, message: 'Bildiriminiz inceleniyor; sonuçlanınca bildirim alacaksınız.'),
        if (q.resolutionNote != null && q.status != 'DISPUTED') NoticeBox(tone: Tone.slate, title: 'İnceleme sonucu', message: q.resolutionNote!),
        const SizedBox(height: 12),
        SectionCard(
          title: 'Sorunuz',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (q.imageUrl != null) AuthImage(url: q.imageUrl!, height: 260, semanticLabel: 'Soru fotoğrafı'),
              if (q.note != null) ...[const SizedBox(height: 10), Text(q.note!)],
            ],
          ),
        ),
        if (answer != null) ...[
          const SizedBox(height: 12),
          SectionCard(
            title: 'Öğretmenin çözümü',
            subtitle: answer.answeredAt == null ? null : formatDateTime(answer.answeredAt!),
            trailing: q.teacherName == null ? null : Avatar(name: q.teacherName!, photoUrl: q.teacherPhotoUrl, size: 36),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (q.teacherName != null) Text(q.teacherName!, style: const TextStyle(fontWeight: FontWeight.w600)),
                if (answer.text != null) ...[const SizedBox(height: 8), SelectableText(answer.text!, style: const TextStyle(height: 1.45))],
                if (answer.imageUrl != null) ...[const SizedBox(height: 10), AuthImage(url: answer.imageUrl!, height: 260, semanticLabel: 'Çözüm fotoğrafı')],
                if (answer.videoUrl != null) ...[const SizedBox(height: 10), AuthVideo(url: answer.videoUrl!)],
              ],
            ),
          ),
          if (answer.followUp != null) ...[
            const SizedBox(height: 12),
            SectionCard(
              title: 'Ek sorunuz',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(answer.followUp!.text),
                  const SizedBox(height: 10),
                  answer.followUp!.answer == null
                      ? Text('Öğretmenin cevabı bekleniyor.', style: TextStyle(color: scheme.onSurfaceVariant))
                      : NoticeBox(tone: Tone.green, title: 'Öğretmenin cevabı', message: answer.followUp!.answer!),
                ],
              ),
            ),
          ],
        ],
        if (q.can('canFollowUp')) ...[
          const SizedBox(height: 12),
          SectionCard(
            title: 'Anlamadığınız yeri sorun (bir kez)',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _followUp,
                  maxLines: 3,
                  maxLength: 1000,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(hintText: 'Örn: Üçüncü adımda neden 2 ile çarptık?'),
                ),
                BusyButton(
                  busy: _busy,
                  outlined: true,
                  icon: Icons.send_rounded,
                  label: 'Ek soruyu gönder',
                  onPressed: () {
                    final text = _followUp.text.trim();
                    if (text.length < 3) {
                      showSnack(context, 'Takıldığınız yeri yazın.', error: true);
                      return;
                    }
                    _run('followUp', {'body': text}, 'Ek sorunuz öğretmene iletildi.');
                  },
                ),
              ],
            ),
          ),
        ],
        if (q.can('canRate')) ...[
          const SizedBox(height: 12),
          SectionCard(
            title: q.rating == null ? 'Çözümü puanlayın' : 'Puanınız',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    for (var i = 1; i <= 5; i++)
                      IconButton(
                        tooltip: '$i puan',
                        onPressed: _busy ? null : () => setState(() => _rating = i),
                        icon: Icon((_rating == 0 ? (q.rating ?? 0) : _rating) >= i ? Icons.star_rounded : Icons.star_outline_rounded, color: const Color(0xFFF59E0B), size: 32),
                      ),
                  ],
                ),
                if (_rating > 0 && _rating != q.rating)
                  BusyButton(busy: _busy, onPressed: () => _run('rate', {'rating': _rating}, 'Teşekkürler, puanınız kaydedildi.'), label: 'Puanla'),
              ],
            ),
          ),
        ],
        if (q.can('canDispute')) ...[
          const SizedBox(height: 12),
          TextButton.icon(
            onPressed: _busy ? null : _dispute,
            icon: const Icon(Icons.report_gmailerrorred_rounded),
            label: Text(q.disputeUntil == null ? 'Çözümde sorun bildir' : 'Çözümde sorun bildir (${formatDateTime(q.disputeUntil!)} saatine kadar)'),
          ),
        ],
        if (q.can('canCancel')) ...[
          const SizedBox(height: 12),
          BusyButton(busy: _busy, onPressed: _cancel, label: 'Soruyu geri çek', outlined: true, destructive: true, icon: Icons.undo_rounded),
        ],
      ],
    );
  }
}
