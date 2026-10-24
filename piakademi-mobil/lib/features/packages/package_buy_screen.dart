import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/format/dates.dart';
import '../../core/format/money.dart';
import '../../core/models/catalog.dart';
import '../../core/models/commerce.dart';
import '../../core/models/teacher.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/avatar.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/states.dart';
import '../booking/booking_screen.dart';
import '../shared/data.dart';
import '../shared/purchase_status_screen.dart';
import '../shared/widgets.dart';
import '../teachers/pickers.dart';

/// Paket ders: aynı ders ve sürede birden fazla ders peşin ve indirimli alınır; dersler takvimden "Paketimden kullan"
/// ile seçilir. [recurring] açıkken "her hafta bu saatte" düzenli ders: ödeme sonrası haftalık talepler kendiliğinden oluşur.
class PackageBuyScreen extends ConsumerWidget {
  const PackageBuyScreen({super.key, required this.slug, this.offeringId, this.recurring = false});

  final String slug;
  final String? offeringId;
  final bool recurring;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(teacherProfileProvider(slug));
    final catalog = ref.watch(catalogProvider);
    return Scaffold(
      appBar: AppBar(leading: const AppBackButton(), title: Text(recurring ? 'Düzenli ders' : 'Paket ders')),
      body: profile.when(
        loading: () => const LoadingView(),
        error: (error, _) => ErrorView(error: error, onRetry: () => ref.invalidate(teacherProfileProvider(slug))),
        data: (teacher) => catalog.when(
          loading: () => const LoadingView(),
          error: (error, _) => ErrorView(error: error, onRetry: () => ref.invalidate(catalogProvider)),
          data: (catalog) {
            final lessons = teacher.offerings.where((o) => o.durations.isNotEmpty).toList();
            if (!catalog.rules.packagesEnabled || lessons.isEmpty || (!recurring && teacher.packageOffers.isEmpty)) {
              return const EmptyView(icon: Icons.inventory_2_outlined, title: 'Bu öğretmen şu an paket satmıyor');
            }
            return _PackageForm(teacher: teacher, rules: catalog.rules, offerings: lessons, initialOfferingId: offeringId, recurring: recurring);
          },
        ),
      ),
    );
  }
}

class _PackageForm extends ConsumerStatefulWidget {
  const _PackageForm({required this.teacher, required this.rules, required this.offerings, this.initialOfferingId, required this.recurring});

  final TeacherProfile teacher;
  final Rules rules;
  final List<Offering> offerings;
  final String? initialOfferingId;
  final bool recurring;

  @override
  ConsumerState<_PackageForm> createState() => _PackageFormState();
}

class _PackageFormState extends ConsumerState<_PackageForm> {
  late Offering _offering = widget.offerings.firstWhere((o) => o.id == widget.initialOfferingId, orElse: () => widget.offerings.first);
  late int _duration = _offering.durations.any((d) => d.minutes == 60) ? 60 : _offering.durations.first.minutes;
  late int _lessons = widget.teacher.packageOffers.isNotEmpty ? widget.teacher.packageOffers.first.lessons : 4;
  String? _weekStart;
  String? _day;
  Slot? _slot;
  final _learner = TextEditingController();
  final _note = TextEditingController();
  bool _consent = false;
  bool _busy = false;
  String? _error;

  TeacherProfile get t => widget.teacher;

  @override
  void initState() {
    super.initState();
    final me = ref.read(sessionProvider).me;
    if (me != null && me.student?.accountType == 'STUDENT') _learner.text = me.firstName;
  }

  @override
  void dispose() {
    _learner.dispose();
    _note.dispose();
    super.dispose();
  }

  int get _listUnit => _offering.durations.firstWhere((d) => d.minutes == _duration, orElse: () => _offering.durations.first).price;
  int get _percent => packageDiscountFor(t.packageOffers, _lessons);
  int get _unit => (_listUnit * (100 - _percent) / 100).round();
  int get _total => _unit * _lessons;

  List<int> get _choices {
    final max = widget.rules.packageMaxLessons;
    final fromOffers = t.packageOffers.map((o) => o.lessons).where((n) => n >= 2 && n <= max);
    final base = widget.recurring ? [4, 8, 12] : <int>[];
    return {...fromOffers, ...base.where((n) => n <= max)}.toList()..sort();
  }

  Future<void> _buy() async {
    String? problem;
    if (widget.recurring && _slot == null) problem = 'İlk dersin gün ve saatini seçin.';
    if (widget.recurring && _learner.text.trim().length < 2) problem = 'Dersin kimin için olduğunu yazın.';
    if (!_consent) problem = 'Ön bilgilendirme formunu ve mesafeli satış sözleşmesini onaylayın.';
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final (pkg, payment) = await ref.read(apiProvider).buyPackage(
            offeringId: _offering.id,
            durationMinutes: _duration,
            lessons: widget.recurring ? null : _lessons,
            recurring: widget.recurring
                ? {
                    'startAt': _slot!.startAt.toUtc().toIso8601String(),
                    'weeks': _lessons,
                    'learnerName': _learner.text.trim(),
                    if (_note.text.trim().isNotEmpty) 'note': _note.text.trim(),
                  }
                : null,
          );
      if (!mounted) return;
      context.pushReplacement(Routes.purchasePayment(PurchaseKind.package, pkg.id), extra: payment);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
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
              const SizedBox(height: 12),
              NoticeBox(
                tone: Tone.brand,
                icon: widget.recurring ? Icons.event_repeat_rounded : Icons.inventory_2_outlined,
                message: widget.recurring
                    ? 'Her hafta aynı gün ve saatte ders: ödeme sonrası haftalık talepler öğretmene kendiliğinden gider. Uygun olmayan haftalar paketinizde kalır, dilediğiniz saati seçersiniz.'
                    : 'Dersleri peşin ve indirimli alın; öğretmenin takviminden saat seçip “Paketimden kullan” ile ödemesiz ders isteyin. Paket ${widget.rules.packageValidityMonths} ay geçerlidir; kullanılmayan dersler iade edilebilir.',
              ),
              const SizedBox(height: 16),
              Text('Ders', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 8),
              PickerField(
                label: 'Ders seçin',
                value: '${_offering.title} · ${_offering.service.name}',
                icon: Icons.menu_book_rounded,
                onTap: widget.offerings.length < 2
                    ? null
                    : () async {
                        final picked = await pickOption<Offering>(context, title: 'Ders', options: widget.offerings, labelOf: (o) => '${o.title} · ${o.service.name}');
                        if (picked?.value != null) {
                          setState(() {
                            _offering = picked!.value!;
                            if (!_offering.durations.any((d) => d.minutes == _duration)) _duration = _offering.durations.first.minutes;
                            _slot = null;
                          });
                        }
                      },
              ),
              const SizedBox(height: 16),
              Text('Ders süresi', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  for (final d in _offering.durations)
                    ChoiceChip(
                      label: Text(durationLabel(d.minutes)),
                      selected: _duration == d.minutes,
                      onSelected: (_) => setState(() {
                        _duration = d.minutes;
                        _slot = null;
                      }),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              Text(widget.recurring ? 'Kaç hafta?' : 'Kaç ders?', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final n in _choices)
                    ChoiceChip(
                      label: Text('$n ${widget.recurring ? 'hafta' : 'ders'}${packageDiscountFor(t.packageOffers, n) > 0 ? ' · %${packageDiscountFor(t.packageOffers, n)}' : ''}'),
                      selected: _lessons == n,
                      onSelected: (_) => setState(() => _lessons = n),
                    ),
                ],
              ),
              if (widget.recurring) ...[
                const SizedBox(height: 16),
                Text('İlk ders (her hafta bu gün ve saatte)', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 8),
                SlotPicker(
                  slug: t.slug,
                  duration: _duration,
                  weekStart: _weekStart,
                  selectedDay: _day,
                  selected: _slot,
                  onWeek: (start) => setState(() {
                    _weekStart = start;
                    _day = null;
                  }),
                  onDay: (day) => setState(() => _day = day),
                  onSlot: (slot) => setState(() => _slot = slot),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _learner,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(labelText: 'Öğrencinin adı', helperText: 'Kendiniz için alıyorsanız kendi adınızı yazın.'),
                ),
                const SizedBox(height: 12),
                TextField(controller: _note, maxLines: 2, maxLength: 1000, decoration: const InputDecoration(labelText: 'Öğretmene not (isteğe bağlı)')),
              ],
              const SizedBox(height: 16),
              SectionCard(
                child: Column(
                  children: [
                    InfoRow(label: 'Ders', value: '${_offering.title} · ${durationLabel(_duration)}'),
                    InfoRow(label: widget.recurring ? 'Hafta' : 'Ders sayısı', value: '$_lessons'),
                    InfoRow(label: 'Ders başı', value: _percent > 0 ? '${formatMoney(_unit)} (%$_percent indirim, normali ${formatMoney(_listUnit)})' : formatMoney(_unit)),
                    if (widget.recurring && _slot != null) InfoRow(label: 'İlk ders', value: formatLessonRange(_slot!.startAt, _slot!.endAt)),
                    const Divider(height: 20),
                    Row(
                      children: [
                        const Expanded(child: Text('Toplam (KDV dahil)', style: TextStyle(fontWeight: FontWeight.w600))),
                        Text(formatMoney(_total), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
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
              if (_error != null) NoticeBox(message: _error!, tone: Tone.rose),
            ],
          ),
        ),
        SafeArea(
          top: false,
          child: Container(
            decoration: BoxDecoration(color: scheme.surface, border: Border(top: BorderSide(color: scheme.outlineVariant))),
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
            child: Row(
              children: [
                Expanded(child: Text(formatMoney(_total), style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w800))),
                Expanded(child: BusyButton(busy: _busy, onPressed: _buy, label: 'Ödemeye geç', icon: Icons.lock_rounded)),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
