import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/models/pool.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/photo_picker.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';
import '../teachers/pickers.dart';

/// Soru gönder (1 kredi): kademe ve ders, sorunun fotoğrafı, isteğe bağlı not.
class AskQuestionScreen extends ConsumerWidget {
  const AskQuestionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(leading: const AppBackButton(fallback: Routes.ask), title: const Text('Soru gönder')),
      body: AsyncBody<Credits>(
        value: ref.watch(creditsProvider),
        onRetry: () => ref.invalidate(creditsProvider),
        builder: (credits) {
          if (credits.balance < 1) {
            return EmptyView(
              icon: Icons.toll_rounded,
              title: 'Soru krediniz yok',
              message: 'Soru göndermek için önce bir kredi paketi alın.',
              action: FilledButton(onPressed: () => context.pushReplacement(Routes.ask), child: const Text('Paketleri gör')),
            );
          }
          if (credits.subjects.isEmpty) {
            return const EmptyView(icon: Icons.hourglass_empty_rounded, title: 'Şu an soru çözen öğretmenimiz yok', message: 'Çok yakında burada olacak; krediniz güvende.');
          }
          return _AskForm(credits: credits);
        },
      ),
    );
  }
}

class _AskForm extends ConsumerStatefulWidget {
  const _AskForm({required this.credits});

  final Credits credits;

  @override
  ConsumerState<_AskForm> createState() => _AskFormState();
}

class _AskFormState extends ConsumerState<_AskForm> {
  PoolSubject? _subject;
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

  Future<void> _submit() async {
    final problem = _subject == null
        ? 'Kademe ve dersi seçin.'
        : _photo == null
            ? 'Sorunun fotoğrafını ekleyin.'
            : null;
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
      _progress = 0;
    });
    try {
      final question = await ref.read(apiProvider).askQuestion(
            subject: _subject!,
            note: _note.text.trim(),
            image: _photo!.file,
            onProgress: (sent, total) {
              if (total > 0 && mounted) setState(() => _progress = sent / total);
            },
          );
      bumpQuestions(ref);
      if (!mounted) return;
      showSnack(context, 'Sorunuz gönderildi; bir öğretmen üstlenince bildirim alacaksınız.');
      context.pushReplacement(Routes.myQuestion(question.id));
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
    final scheme = Theme.of(context).colorScheme;
    final rules = widget.credits.rules;
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              NoticeBox(
                tone: Tone.brand,
                icon: Icons.photo_camera_rounded,
                message:
                    'Tek soru, net fotoğraf. Sorunuz bu kademe ve derste ders veren öğretmenlerimize düşer; ilk üstlenen en geç ${rules.answerHours} saat içinde adım adım çözer. Çözülmezse krediniz iade edilir.',
              ),
              const SizedBox(height: 18),
              Text('Kademe ve ders', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 8),
              PickerField(
                label: 'Seçin',
                value: _subject?.title,
                icon: Icons.menu_book_rounded,
                onTap: () async {
                  final picked = await pickOption<PoolSubject>(context, title: 'Kademe ve ders', options: widget.credits.subjects, labelOf: (s) => s.title, searchable: true);
                  if (picked?.value != null) setState(() => _subject = picked!.value);
                },
              ),
              const SizedBox(height: 18),
              Text('Sorunun fotoğrafı', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 4),
              Text('Soruyu şıklarıyla birlikte, tamamı görünecek şekilde çekin.', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
              const SizedBox(height: 8),
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
                decoration: const InputDecoration(
                  labelText: 'Not (isteğe bağlı)',
                  hintText: 'Örn: İkinci adımdan sonra nasıl devam edeceğimi bulamadım.',
                  helperText: 'Telefon, e-posta gibi iletişim bilgileri otomatik gizlenir.',
                ),
              ),
              if (_error != null) ...[const SizedBox(height: 8), NoticeBox(message: _error!, tone: Tone.rose)],
            ],
          ),
        ),
        SafeArea(
          top: false,
          child: Container(
            decoration: BoxDecoration(color: scheme.surface, border: Border(top: BorderSide(color: scheme.outlineVariant))),
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_progress != null) ...[LinearProgressIndicator(value: _progress), const SizedBox(height: 8)],
                Row(
                  children: [
                    Expanded(
                      child: Text('Kalan kredi: ${widget.credits.balance}', style: TextStyle(color: scheme.onSurfaceVariant, fontWeight: FontWeight.w600)),
                    ),
                    Expanded(child: BusyButton(busy: _busy, onPressed: _submit, label: 'Gönder · 1 kredi', icon: Icons.send_rounded)),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
