import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/format/dates.dart';
import '../../core/models/center.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/media.dart';
import '../../core/widgets/photo_picker.dart';
import '../shared/data.dart';
import '../teachers/pickers.dart';

Tone _questionTone(String status) => switch (status) {
      'ANSWERED' => Tone.green,
      'IN_PERSON' => Tone.sky,
      _ => Tone.amber,
    };

/// Kurum öğretmenine fotoğrafla soru (ücretsiz, kurum hizmeti).
class CenterQuestionsTab extends ConsumerWidget {
  const CenterQuestionsTab({super.key, required this.data});

  final CenterChild data;

  Future<void> _ask(BuildContext context, WidgetRef ref) async {
    final sent = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _AskSheet(guardianId: data.id, subjects: data.questionSubjects.isEmpty ? const ['Matematik', 'Türkçe', 'Fen Bilimleri', 'Diğer'] : data.questionSubjects),
    );
    if (sent ?? false) ref.invalidate(centerChildProvider(data.id));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    return RefreshIndicator(
      onRefresh: () => ref.refresh(centerChildProvider(data.id).future),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(16, 16, 16, 32 + MediaQuery.paddingOf(context).bottom),
        children: [
          SectionCard(
            title: 'Öğretmene soru sor',
            subtitle: 'Takıldığın sorunun fotoğrafını gönder; öğretmen çözümü yazı, fotoğraf ya da videoyla gönderir ya da derste anlatır.',
            child: FilledButton.icon(onPressed: () => _ask(context, ref), icon: const Icon(Icons.add_a_photo_rounded), label: const Text('Soru gönder')),
          ),
          const SizedBox(height: 12),
          if (data.questions.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text('Henüz soru gönderilmedi.', textAlign: TextAlign.center, style: TextStyle(color: scheme.onSurfaceVariant)),
            ),
          for (final q in data.questions) Padding(padding: const EdgeInsets.only(bottom: 12), child: _QuestionCard(guardianId: data.id, question: q)),
        ],
      ),
    );
  }
}

class _QuestionCard extends ConsumerWidget {
  const _QuestionCard({required this.guardianId, required this.question});

  final String guardianId;
  final CenterQuestion question;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final q = question;
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(child: Text(q.subject, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15))),
                ToneBadge(label: questionStatusLabels[q.status] ?? q.status, tone: _questionTone(q.status)),
              ],
            ),
            Text(formatCompact(q.createdAt), style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12)),
            if (q.note != null) ...[const SizedBox(height: 6), Text(q.note!)],
            if (q.imageUrl != null) ...[const SizedBox(height: 8), AuthImage(url: q.imageUrl!, height: 200, semanticLabel: 'Soru fotoğrafı')],
            if (q.status != 'OPEN') ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: q.status == 'ANSWERED' ? ToneColors.of(Tone.green, Theme.of(context).brightness).background : scheme.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      [q.status == 'IN_PERSON' ? 'Derste anlatılacak' : 'Çözüm', if (q.answeredBy != null) q.answeredBy!, if (q.answeredAt != null) formatCompact(q.answeredAt!)].join(' · '),
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                    ),
                    if (q.answerText != null) ...[const SizedBox(height: 6), SelectableText(q.answerText!, style: const TextStyle(height: 1.45))],
                    if (q.answerImageUrl != null) ...[const SizedBox(height: 8), AuthImage(url: q.answerImageUrl!, height: 220, semanticLabel: 'Çözüm fotoğrafı')],
                    if (q.answerVideoUrl != null) ...[const SizedBox(height: 8), AuthVideo(url: q.answerVideoUrl!)],
                  ],
                ),
              ),
            ],
            if (q.status == 'OPEN' && q.mine)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () async {
                    final ok = await confirmDialog(context, title: 'Soru geri çekilsin mi?', message: 'Henüz cevaplanmadığı için soruyu silebilirsiniz.', confirmText: 'Geri çek', destructive: true);
                    if (!ok) return;
                    try {
                      await ref.read(apiProvider).withdrawCenterQuestion(guardianId, q.id);
                      ref.invalidate(centerChildProvider(guardianId));
                      if (context.mounted) showSnack(context, 'Soru geri çekildi.');
                    } on ApiException catch (error) {
                      if (context.mounted) showError(context, error);
                    }
                  },
                  child: const Text('Geri çek'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _AskSheet extends ConsumerStatefulWidget {
  const _AskSheet({required this.guardianId, required this.subjects});

  final String guardianId;
  final List<String> subjects;

  @override
  ConsumerState<_AskSheet> createState() => _AskSheetState();
}

class _AskSheetState extends ConsumerState<_AskSheet> {
  String? _subject;
  PickedMedia? _photo;
  final _note = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_subject == null) {
      setState(() => _error = 'Dersi seçin.');
      return;
    }
    if (_photo == null) {
      setState(() => _error = 'Sorunun fotoğrafını ekleyin.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(apiProvider).askCenterQuestion(widget.guardianId, subject: _subject!, note: _note.text.trim(), image: _photo!.file);
      if (!mounted) return;
      showSnack(context, 'Sorun öğretmene iletildi. Çözüm gelince bildirim alacaksın.');
      Navigator.pop(context, true);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.viewInsetsOf(context).bottom + 20),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Soru gönder', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 14),
            PickerField(
              label: 'Ders seçin',
              value: _subject,
              icon: Icons.menu_book_rounded,
              onTap: () async {
                final picked = await pickOption<String>(context, title: 'Ders', options: widget.subjects, labelOf: (s) => s);
                if (picked?.value != null) setState(() => _subject = picked!.value);
              },
            ),
            const SizedBox(height: 12),
            if (_photo == null)
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(110)),
                onPressed: () async {
                  final photo = await pickPhoto(context, title: 'Sorunun fotoğrafı');
                  if (photo != null) setState(() => _photo = photo);
                },
                icon: const Icon(Icons.add_a_photo_outlined, size: 28),
                label: const Text('Fotoğraf çek / seç'),
              )
            else
              MediaPreview(media: _photo!, onRemove: () => setState(() => _photo = null)),
            const SizedBox(height: 12),
            TextField(
              controller: _note,
              maxLines: 3,
              maxLength: 500,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(labelText: 'Not (isteğe bağlı)', hintText: 'Nerede takıldığını yaz'),
            ),
            if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
            BusyButton(busy: _busy, onPressed: _send, label: 'Gönder', icon: Icons.send_rounded),
          ],
        ),
      ),
    );
  }
}
