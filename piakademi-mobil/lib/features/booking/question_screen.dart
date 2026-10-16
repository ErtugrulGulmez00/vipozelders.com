import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/format/money.dart';
import '../../core/models/catalog.dart';
import '../../core/models/teacher.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/avatar.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/photo_picker.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';
import '../teachers/pickers.dart';
import 'booking_screen.dart';

/// Fotoğrafla soru: soru başı ücret ödenir, öğretmen süresi içinde yazılı/fotoğraflı/videolu çözüm gönderir.
class QuestionScreen extends ConsumerWidget {
  const QuestionScreen({super.key, required this.slug, this.offeringId});

  final String slug;
  final String? offeringId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(teacherProfileProvider(slug));
    final catalog = ref.watch(catalogProvider);
    return Scaffold(
      appBar: AppBar(leading: const AppBackButton(), title: const Text('Fotoğrafla soru sor')),
      body: profile.when(
        loading: () => const LoadingView(),
        error: (error, _) => ErrorView(error: error, onRetry: () => ref.invalidate(teacherProfileProvider(slug))),
        data: (teacher) => catalog.when(
          loading: () => const LoadingView(),
          error: (error, _) => ErrorView(error: error, onRetry: () => ref.invalidate(catalogProvider)),
          data: (catalog) {
            final offerings = teacher.offerings.where((o) => o.acceptsQuestions).toList();
            if (offerings.isEmpty) {
              return const EmptyView(icon: Icons.no_photography_outlined, title: 'Bu öğretmen fotoğrafla soru kabul etmiyor');
            }
            return _QuestionForm(teacher: teacher, catalog: catalog, offerings: offerings, initialOfferingId: offeringId);
          },
        ),
      ),
    );
  }
}

class _QuestionForm extends ConsumerStatefulWidget {
  const _QuestionForm({required this.teacher, required this.catalog, required this.offerings, this.initialOfferingId});

  final TeacherProfile teacher;
  final Catalog catalog;
  final List<Offering> offerings;
  final String? initialOfferingId;

  @override
  ConsumerState<_QuestionForm> createState() => _QuestionFormState();
}

class _QuestionFormState extends ConsumerState<_QuestionForm> {
  late Offering _offering = widget.offerings.firstWhere((o) => o.id == widget.initialOfferingId, orElse: () => widget.offerings.first);
  PickedMedia? _photo;
  final _note = TextEditingController();
  final _learner = TextEditingController();
  String? _grade;
  bool _consent = false;
  bool _busy = false;
  double? _progress;
  ApiException? _error;

  @override
  void initState() {
    super.initState();
    final me = ref.read(sessionProvider).me;
    if (me != null && me.student?.accountType == 'STUDENT') _learner.text = me.firstName;
  }

  @override
  void dispose() {
    _note.dispose();
    _learner.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    String? problem;
    if (_photo == null) {
      problem = 'Sorunun fotoğrafını ekleyin.';
    } else if (_learner.text.trim().length < 2) {
      problem = 'Sorunun kimin için olduğunu yazın.';
    } else if (!_consent) {
      problem = 'Ön bilgilendirme formunu ve mesafeli satış sözleşmesini onaylayın.';
    }
    if (problem != null) {
      setState(() => _error = ApiException(code: 'VALIDATION', message: problem!));
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
      _progress = 0;
    });
    try {
      final result = await ref.read(apiProvider).createQuestion(
            offeringId: _offering.id,
            learnerName: _learner.text.trim(),
            learnerGrade: _grade,
            note: _note.text.trim(),
            image: _photo!.file,
            onProgress: (sent, total) {
              if (total > 0 && mounted) setState(() => _progress = sent / total);
            },
          );
      bumpBookings(ref);
      if (!mounted) return;
      context.pushReplacement(Routes.payment(result.booking.id), extra: result.payment);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error);
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
    final t = widget.teacher;
    final scheme = Theme.of(context).colorScheme;
    final hours = widget.catalog.rules.questionAnswerHours;
    final grades = widget.catalog.levels.where((l) => l.id == _offering.level.id).expand((l) => l.grades).map((g) => g.name).toList();
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              Row(
                children: [
                  Avatar(name: t.name, photoUrl: t.photoUrl, size: 48),
                  const SizedBox(width: 12),
                  Expanded(child: Text(t.name, style: Theme.of(context).textTheme.titleMedium)),
                ],
              ),
              const SizedBox(height: 16),
              NoticeBox(
                tone: Tone.brand,
                icon: Icons.photo_camera_rounded,
                message: 'Öğretmen çözümü $hours saat içinde yazılı, fotoğraflı ya da videolu olarak gönderir; anlamadığınız yeri ona yazabilirsiniz. Süresinde çözülmezse ücretin tamamı iade edilir.',
              ),
              const SizedBox(height: 18),
              Text('Ders', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 8),
              PickerField(
                label: 'Ders seçin',
                value: '${_offering.title} · ${formatMoney(_offering.questionPrice!)}',
                icon: Icons.menu_book_rounded,
                onTap: widget.offerings.length < 2
                    ? null
                    : () async {
                        final picked = await pickOption<Offering>(context, title: 'Ders', options: widget.offerings, labelOf: (o) => '${o.title} · ${formatMoney(o.questionPrice!)}');
                        if (picked?.value != null) setState(() => _offering = picked!.value!);
                      },
              ),
              const SizedBox(height: 18),
              Text('Sorunun fotoğrafı', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 4),
              Text('Soruyu şıklarıyla birlikte net ve tam çekin.', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
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
                MediaPreview(media: _photo!, onRemove: () => setState(() => _photo = null), height: 240),
              const SizedBox(height: 16),
              TextField(
                controller: _note,
                maxLines: 3,
                maxLength: 1000,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  labelText: 'Not (isteğe bağlı)',
                  hintText: 'Örn: İkinci adımdan sonra nasıl devam edeceğimi bulamadım.',
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _learner,
                textCapitalization: TextCapitalization.words,
                decoration: InputDecoration(labelText: 'Öğrencinin adı', errorText: _error?.field('learnerName')),
              ),
              const SizedBox(height: 12),
              PickerField(
                label: 'Sınıfı (isteğe bağlı)',
                value: _grade,
                icon: Icons.school_outlined,
                onTap: () async {
                  final picked = await pickOption<String>(context, title: 'Sınıf', options: [...grades, 'Diğer'], labelOf: (s) => s, allowClear: true, clearLabel: 'Belirtmek istemiyorum');
                  if (picked != null) setState(() => _grade = picked.value);
                },
              ),
              const SizedBox(height: 16),
              SectionCard(
                child: Column(
                  children: [
                    InfoRow(label: 'Ders', value: _offering.title),
                    InfoRow(label: 'Çözüm süresi', value: 'en geç $hours saat'),
                    const Divider(height: 20),
                    Row(
                      children: [
                        const Expanded(child: Text('Soru başı ücret (KDV dahil)', style: TextStyle(fontWeight: FontWeight.w600))),
                        Text(formatMoney(_offering.questionPrice!), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              CheckboxListTile(
                value: _consent,
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                onChanged: (v) => setState(() => _consent = v ?? false),
                title: ConsentText(onOpen: (slug) => context.push(Routes.page(slug))),
              ),
              if (_error != null) NoticeBox(message: _error!.message, tone: Tone.rose),
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
                if (_progress != null) ...[
                  LinearProgressIndicator(value: _progress),
                  const SizedBox(height: 8),
                ],
                SizedBox(
                  width: double.infinity,
                  child: BusyButton(busy: _busy, onPressed: _submit, label: 'Ödemeye geç · ${formatMoney(_offering.questionPrice!)}', icon: Icons.lock_rounded),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
