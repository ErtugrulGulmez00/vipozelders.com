import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/format/dates.dart';
import '../../core/models/booking.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/media.dart';
import '../../core/widgets/photo_picker.dart';
import '../shared/data.dart';

/// Fotoğrafla sorunun yazışması: soru, çözüm ve sonraki mesajlar; altında yeni mesaj alanı.
class QuestionThreadView extends StatelessWidget {
  const QuestionThreadView({super.key, required this.booking, required this.asTeacher});

  final BookingDetail booking;
  final bool asTeacher;

  @override
  Widget build(BuildContext context) {
    final thread = booking.question!;
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Soru ve çözüm', style: Theme.of(context).textTheme.titleMedium),
            if (thread.answerDeadline != null)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text('Çözüm için son: ${formatDateTime(thread.answerDeadline!)}. Gelmezse ücret iade edilir.', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
              ),
            const SizedBox(height: 12),
            if (thread.messages.isEmpty) Text('Henüz mesaj yok.', style: TextStyle(color: scheme.onSurfaceVariant)),
            for (final m in thread.messages) _MessageBubble(message: m),
            const SizedBox(height: 4),
            if (booking.actions.canMessage)
              _Composer(booking: booking, asTeacher: asTeacher)
            else
              Text('Bu soru için yazışma kapandı.', style: TextStyle(color: scheme.onSurfaceVariant)),
          ],
        ),
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});

  final QuestionMessage message;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final Color background;
    if (message.isSolution) {
      background = dark ? const Color(0xFF0B3B2E) : const Color(0xFFECFDF5);
    } else if (message.mine) {
      background = scheme.primaryContainer;
    } else {
      background = scheme.surfaceContainer;
    }
    return Align(
      alignment: message.mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        constraints: const BoxConstraints(maxWidth: 560),
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(14),
          border: message.isSolution ? Border.all(color: const Color(0xFF6EE7B7)) : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Flexible(
                  child: Text(
                    message.mine ? 'Siz' : message.authorName,
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                  ),
                ),
                const SizedBox(width: 8),
                Text(formatCompact(message.createdAt), style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
                if (message.isSolution) ...[const SizedBox(width: 8), const ToneBadge(label: 'Çözüm', tone: Tone.green)],
              ],
            ),
            if (message.body != null) ...[
              const SizedBox(height: 6),
              SelectableText(message.body!, style: const TextStyle(height: 1.45)),
            ],
            if (message.imageUrl != null) ...[
              const SizedBox(height: 8),
              AuthImage(url: message.imageUrl!, height: 260, semanticLabel: message.isSolution ? 'Çözüm fotoğrafı' : 'Soru fotoğrafı'),
            ],
            if (message.videoUrl != null) ...[
              const SizedBox(height: 8),
              AuthVideo(url: message.videoUrl!),
            ],
          ],
        ),
      ),
    );
  }
}

class _Composer extends ConsumerStatefulWidget {
  const _Composer({required this.booking, required this.asTeacher});

  final BookingDetail booking;
  final bool asTeacher;

  @override
  ConsumerState<_Composer> createState() => _ComposerState();
}

class _ComposerState extends ConsumerState<_Composer> {
  final _body = TextEditingController();
  PickedMedia? _image;
  PickedMedia? _video;
  late bool _isSolution = widget.booking.actions.canSolve;
  bool _busy = false;
  double? _progress;

  bool get _solving => widget.asTeacher && widget.booking.actions.canSolve;

  @override
  void dispose() {
    _body.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_body.text.trim().isEmpty && _image == null && _video == null) {
      showSnack(context, 'Mesaj yazın ya da fotoğraf/video ekleyin.', error: true);
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _progress = 0;
    });
    try {
      final solved = _solving && _isSolution;
      await ref.read(apiProvider).sendQuestionMessage(
            widget.booking.id,
            body: _body.text.trim(),
            image: _image?.file,
            video: _video?.file,
            isSolution: solved,
            onProgress: (sent, total) {
              if (total > 0 && mounted) setState(() => _progress = sent / total);
            },
          );
      _body.clear();
      setState(() {
        _image = null;
        _video = null;
      });
      bumpBookings(ref);
      if (mounted) showSnack(context, solved ? 'Çözüm gönderildi; öğrenciye bildirim gitti.' : 'Mesaj gönderildi.');
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Divider(height: 24),
        TextField(
          controller: _body,
          minLines: _solving ? 4 : 2,
          maxLines: 8,
          maxLength: 4000,
          textCapitalization: TextCapitalization.sentences,
          decoration: InputDecoration(
            labelText: _solving ? 'Çözüm açıklaması' : 'Mesajınız',
            hintText: widget.asTeacher
                ? (_solving ? 'Çözümü adım adım yazın; isterseniz fotoğrafını ya da kısa bir anlatım videosu ekleyin.' : 'Öğrencinin sorusunu yanıtlayın.')
                : 'Örn: 3. adımda neden 2 ile çarptık?',
          ),
        ),
        if (_image != null) ...[MediaPreview(media: _image!, onRemove: () => setState(() => _image = null), height: 160), const SizedBox(height: 8)],
        if (_video != null) ...[MediaPreview(media: _video!, onRemove: () => setState(() => _video = null)), const SizedBox(height: 8)],
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(minimumSize: const Size(0, 42)),
              onPressed: _busy
                  ? null
                  : () async {
                      final photo = await pickPhoto(context);
                      if (photo != null) setState(() => _image = photo);
                    },
              icon: const Icon(Icons.add_a_photo_outlined, size: 18),
              label: Text(_image == null ? 'Fotoğraf' : 'Fotoğrafı değiştir'),
            ),
            if (widget.asTeacher)
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(minimumSize: const Size(0, 42)),
                onPressed: _busy
                    ? null
                    : () async {
                        final video = await pickVideo(context);
                        if (video != null) setState(() => _video = video);
                      },
                icon: const Icon(Icons.videocam_outlined, size: 18),
                label: Text(_video == null ? 'Video' : 'Videoyu değiştir'),
              ),
          ],
        ),
        if (_solving)
          CheckboxListTile(
            value: _isSolution,
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            onChanged: (v) => setState(() => _isSolution = v ?? false),
            title: const Text('Bu mesaj sorunun çözümüdür (öğrenciye “çözüm geldi” bildirimi gider)', style: TextStyle(fontSize: 14)),
          ),
        if (_progress != null && _progress! > 0 && _progress! < 1) ...[const SizedBox(height: 8), LinearProgressIndicator(value: _progress)],
        const SizedBox(height: 10),
        BusyButton(busy: _busy, onPressed: _send, label: _solving && _isSolution ? 'Çözümü gönder' : 'Mesajı gönder', icon: Icons.send_rounded),
      ],
    );
  }
}
