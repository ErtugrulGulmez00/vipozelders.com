import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/api/pi_api.dart';
import '../../core/format/dates.dart';
import '../../core/format/money.dart';
import '../../core/models/catalog.dart';
import '../../core/models/teacher.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/avatar.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';
import '../teachers/pickers.dart';
import '../teachers/teacher_filters_sheet.dart';

final slotWeekProvider = FutureProvider.autoDispose.family<SlotWeek, (String, int, String?)>((ref, args) {
  return ref.watch(apiProvider).slots(args.$1, duration: args.$2, start: args.$3);
});

/// Randevu: ders → süre → şekil → gün ve saat → öğrenci bilgisi → özet ve onay → ödeme.
/// [intro] açıkken ücretsiz 15 dk online tanışma görüşmesi istenir (ödeme ve sözleşme onayı yok).
class BookingScreen extends ConsumerWidget {
  const BookingScreen({super.key, required this.slug, this.offeringId, this.intro = false});

  final String slug;
  final String? offeringId;
  final bool intro;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(teacherProfileProvider(slug));
    final catalog = ref.watch(catalogProvider);
    final session = ref.watch(sessionProvider);
    if (session.isTeacher) {
      return Scaffold(
        appBar: AppBar(leading: const AppBackButton(), title: Text(intro ? 'Ücretsiz tanışma' : 'Randevu al')),
        body: const EmptyView(
          icon: Icons.person_off_outlined,
          title: 'Randevu yalnızca veli/öğrenci hesabıyla alınabilir',
          message: 'Şu an öğretmen hesabıyla giriş yaptınız.',
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(leading: const AppBackButton(), title: Text(intro ? 'Ücretsiz tanışma' : 'Randevu al')),
      body: profile.when(
        loading: () => const LoadingView(),
        error: (error, _) => ErrorView(error: error, onRetry: () => ref.invalidate(teacherProfileProvider(slug))),
        data: (teacher) => catalog.when(
          loading: () => const LoadingView(),
          error: (error, _) => ErrorView(error: error, onRetry: () => ref.invalidate(catalogProvider)),
          data: (catalog) {
            final lessons = teacher.offerings.where((o) => o.durations.isNotEmpty).toList();
            if (lessons.isEmpty) {
              return const EmptyView(title: 'Bu öğretmenin randevu alınabilecek dersi yok', icon: Icons.event_busy_rounded);
            }
            if (intro && !teacher.offersIntro) {
              return const EmptyView(title: 'Bu öğretmen ücretsiz tanışma görüşmesi sunmuyor', icon: Icons.event_busy_rounded);
            }
            return _BookingForm(teacher: teacher, catalog: catalog, offerings: lessons, initialOfferingId: offeringId, intro: intro);
          },
        ),
      ),
    );
  }
}

class _BookingForm extends ConsumerStatefulWidget {
  const _BookingForm({required this.teacher, required this.catalog, required this.offerings, this.initialOfferingId, this.intro = false});

  final TeacherProfile teacher;
  final Catalog catalog;
  final List<Offering> offerings;
  final String? initialOfferingId;
  final bool intro;

  @override
  ConsumerState<_BookingForm> createState() => _BookingFormState();
}

class _BookingFormState extends ConsumerState<_BookingForm> {
  late Offering _offering = widget.offerings.firstWhere((o) => o.id == widget.initialOfferingId, orElse: () => widget.offerings.first);
  /// Tanışma görüşmesi 15 dakika ve online
  static const _introMinutes = 15;
  late int _duration = widget.intro ? _introMinutes : _defaultDuration(_offering);
  late String _mode = widget.intro || widget.teacher.offersOnline ? 'ONLINE' : 'IN_PERSON';
  String? _place;
  District? _district;
  String? _weekStart;
  String? _day;
  Slot? _slot;
  final _learner = TextEditingController();
  final _address = TextEditingController();
  final _note = TextEditingController();
  String? _grade;
  bool _consent = false;
  bool _busy = false;
  ApiException? _error;
  final _scroll = ScrollController();

  TeacherProfile get t => widget.teacher;

  @override
  void initState() {
    super.initState();
    final me = ref.read(sessionProvider).me;
    if (me != null && me.student?.accountType == 'STUDENT') _learner.text = me.firstName;
    if (t.inPersonAtStudentHome) {
      _place = 'STUDENT_HOME';
    } else if (t.inPersonAtTeacherPlace) {
      _place = 'TEACHER_PLACE';
    }
  }

  @override
  void dispose() {
    _learner.dispose();
    _address.dispose();
    _note.dispose();
    _scroll.dispose();
    super.dispose();
  }

  static int _defaultDuration(Offering o) => o.durations.any((d) => d.minutes == 60) ? 60 : o.durations.first.minutes;

  int get _price => widget.intro ? 0 : _offering.durations.firstWhere((d) => d.minutes == _duration, orElse: () => _offering.durations.first).price;

  List<Grade> get _grades => widget.catalog.levels.where((l) => l.id == _offering.level.id).expand((l) => l.grades).toList();

  void _selectOffering(Offering o) {
    setState(() {
      _offering = o;
      if (!widget.intro && !o.durations.any((d) => d.minutes == _duration)) {
        _duration = _defaultDuration(o);
        _slot = null;
      }
      _grade = null;
    });
  }

  String? _validate() {
    if (_slot == null) return 'Ders için bir gün ve saat seçin.';
    if (_mode == 'IN_PERSON') {
      if (_place == null) return 'Yüz yüze dersin nerede yapılacağını seçin.';
      if (_place == 'STUDENT_HOME' && (_district == null || _address.text.trim().isEmpty)) return 'Yüz yüze ders için ilçe ve adres gerekli.';
    }
    if (_learner.text.trim().length < 2) return 'Dersin kimin için olduğunu yazın.';
    if (!widget.intro && !_consent) return 'Ön bilgilendirme formunu ve mesafeli satış sözleşmesini onaylayın.';
    return null;
  }

  Future<void> _submit() async {
    final problem = _validate();
    if (problem != null) {
      setState(() => _error = ApiException(code: 'VALIDATION', message: problem));
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await ref.read(apiProvider).createBooking(
            BookingRequest(
              offeringId: _offering.id,
              startAt: _slot!.startAt,
              durationMinutes: _duration,
              mode: _mode,
              learnerName: _learner.text.trim(),
              learnerGrade: _grade,
              inPersonPlace: _mode == 'IN_PERSON' ? _place : null,
              districtId: _mode == 'IN_PERSON' && _place == 'STUDENT_HOME' ? _district?.id : null,
              address: _mode == 'IN_PERSON' && _place == 'STUDENT_HOME' ? _address.text.trim() : null,
              note: _note.text.trim(),
              intro: widget.intro,
            ),
          );
      bumpBookings(ref);
      if (!mounted) return;
      final payment = result.payment;
      if (payment == null) {
        // Ücretsiz tanışma: ödeme yok, öğretmenin onayı beklenir.
        showSnack(context, 'Tanışma isteğiniz öğretmene iletildi; onaylayınca bildirim alacaksınız.');
        context.pushReplacement(Routes.lesson(result.booking.id));
      } else {
        context.pushReplacement(Routes.payment(result.booking.id), extra: payment);
      }
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error);
      // Saat az önce dolduysa takvim yenilenir.
      if (error.code == 'RULE_VIOLATION') {
        ref.invalidate(slotWeekProvider);
        setState(() => _slot = null);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final rules = widget.catalog.rules;
    return Column(
      children: [
        Expanded(
          child: ListView(
            controller: _scroll,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              Row(
                children: [
                  Avatar(name: t.name, photoUrl: t.photoUrl, size: 48),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(t.name, style: Theme.of(context).textTheme.titleMedium),
                        Text(t.headline ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
                      ],
                    ),
                  ),
                ],
              ),
              const _StepTitle(number: 1, title: 'Ders'),
              PickerField(
                label: 'Ders seçin',
                value: '${_offering.title} · ${_offering.service.name}',
                icon: Icons.menu_book_rounded,
                onTap: widget.offerings.length < 2
                    ? null
                    : () async {
                        final picked = await pickOption<Offering>(context, title: 'Ders', options: widget.offerings, labelOf: (o) => '${o.title} · ${o.service.name}');
                        if (picked?.value != null) _selectOffering(picked!.value!);
                      },
              ),
              if (widget.intro) ...[
                const SizedBox(height: 16),
                const NoticeBox(
                  tone: Tone.green,
                  icon: Icons.waving_hand_rounded,
                  title: 'Ücretsiz 15 dakika · online',
                  message: 'Öğretmenle tanışın, hedefinizi konuşun; ücret alınmaz. Öğretmen onaylayınca görüşme sanal sınıfta yapılır.',
                ),
              ],
              if (!widget.intro) ...[
              const _StepTitle(number: 2, title: 'Süre'),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final d in _offering.durations)
                    ChoiceChip(
                      label: Text('${durationLabel(d.minutes)} · ${formatMoney(d.price)}'),
                      selected: _duration == d.minutes,
                      onSelected: (_) => setState(() {
                        _duration = d.minutes;
                        _slot = null;
                      }),
                    ),
                ],
              ),
              const _StepTitle(number: 3, title: 'Ders şekli'),
              Wrap(
                spacing: 8,
                children: [
                  if (t.offersOnline)
                    ChoiceChip(
                      showCheckmark: false,
                      avatar: const Icon(Icons.videocam_rounded, size: 18),
                      label: const Text('Online'),
                      selected: _mode == 'ONLINE',
                      onSelected: (_) => setState(() => _mode = 'ONLINE'),
                    ),
                  if (t.offersInPerson)
                    ChoiceChip(
                      showCheckmark: false,
                      avatar: const Icon(Icons.place_rounded, size: 18),
                      label: const Text('Yüz yüze'),
                      selected: _mode == 'IN_PERSON',
                      onSelected: (_) => setState(() => _mode = 'IN_PERSON'),
                    ),
                ],
              ),
              if (_mode == 'ONLINE')
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text('Ders uygulamadaki sanal sınıfta yapılır: kamera, mikrofon, sohbet ve ortak beyaz tahta.', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
                ),
              if (_mode == 'IN_PERSON') ...[
                const SizedBox(height: 12),
                _InPersonDetails(
                  teacher: t,
                  place: _place,
                  district: _district,
                  address: _address,
                  onPlace: (p) => setState(() => _place = p),
                  onDistrict: (d) => setState(() => _district = d),
                ),
              ],
              ],
              _StepTitle(number: widget.intro ? 2 : 4, title: 'Gün ve saat'),
              _SlotPicker(
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
              _StepTitle(number: widget.intro ? 3 : 5, title: 'Ders kimin için?'),
              TextField(
                controller: _learner,
                textCapitalization: TextCapitalization.words,
                decoration: InputDecoration(
                  labelText: 'Öğrencinin adı',
                  helperText: 'Kendiniz için alıyorsanız kendi adınızı yazın.',
                  errorText: _error?.field('learnerName'),
                ),
              ),
              const SizedBox(height: 12),
              PickerField(
                label: 'Sınıfı (isteğe bağlı)',
                value: _grade,
                icon: Icons.school_outlined,
                onTap: () async {
                  final options = [..._grades.map((g) => g.name), 'Diğer'];
                  final picked = await pickOption<String>(context, title: 'Sınıf', options: options, labelOf: (s) => s, allowClear: true, clearLabel: 'Belirtmek istemiyorum');
                  if (picked != null) setState(() => _grade = picked.value);
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _note,
                maxLines: 3,
                maxLength: 1000,
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(
                  labelText: 'Öğretmene not (isteğe bağlı)',
                  hintText: 'Örn: ${_offering.subject.name} dersinde hangi konularda zorlanıyor, hedefi ne?',
                ),
              ),
              _StepTitle(number: widget.intro ? 4 : 6, title: 'Özet'),
              _Summary(
                teacher: t,
                offering: _offering,
                duration: _duration,
                mode: _mode,
                slot: _slot,
                price: _price,
                intro: widget.intro,
              ),
              const SizedBox(height: 12),
              if (!widget.intro) ...[
              NoticeBox(
                tone: Tone.sky,
                icon: Icons.verified_user_outlined,
                message:
                    'Saat, ödeme için ${rules.paymentHoldMinutes} dakika boyunca size ayrılır. Öğretmen ${rules.approvalWindowHours} saat içinde onaylar; onaylamazsa ödemenin tamamı iade edilir. Dersten ${rules.fullRefundHours} saat öncesine kadar ücretsiz iptal, ${rules.partialRefundHours} saat öncesine kadar %${rules.partialRefundPercent} iade.',
              ),
              const SizedBox(height: 8),
              CheckboxListTile(
                value: _consent,
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                onChanged: (v) => setState(() => _consent = v ?? false),
                title: ConsentText(onOpen: (slug) => context.push(Routes.page(slug))),
              ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 8),
                NoticeBox(message: _error!.message, tone: Tone.rose),
              ],
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
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(widget.intro ? 'Ücretsiz' : formatMoney(_price), style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w800)),
                      Text(widget.intro ? 'Tanışma · ${durationLabel(_duration)}' : 'KDV dahil · ${durationLabel(_duration)}', style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
                    ],
                  ),
                ),
                Expanded(
                  child: BusyButton(busy: _busy, onPressed: _submit, label: widget.intro ? 'Tanışma iste' : 'Ödemeye geç', icon: widget.intro ? Icons.send_rounded : Icons.lock_rounded),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _StepTitle extends StatelessWidget {
  const _StepTitle({required this.number, required this.title});

  final int number;
  final String title;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(top: 22, bottom: 10),
      child: Row(
        children: [
          CircleAvatar(radius: 12, backgroundColor: scheme.primary, child: Text('$number', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w800))),
          const SizedBox(width: 10),
          Text(title, style: Theme.of(context).textTheme.titleMedium),
        ],
      ),
    );
  }
}

class _InPersonDetails extends ConsumerWidget {
  const _InPersonDetails({required this.teacher, required this.place, required this.district, required this.address, required this.onPlace, required this.onDistrict});

  final TeacherProfile teacher;
  final String? place;
  final District? district;
  final TextEditingController address;
  final ValueChanged<String> onPlace;
  final ValueChanged<District?> onDistrict;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = teacher;
    final scheme = Theme.of(context).colorScheme;
    final serviceDistricts = t.serviceDistricts.map((d) => District(id: d.id, name: d.name, slug: '')).toList();
    final cityDistricts = serviceDistricts.isEmpty && t.city != null ? ref.watch(districtsProvider(t.city!.id)) : null;
    final districts = serviceDistricts.isNotEmpty ? serviceDistricts : (cityDistricts?.valueOrNull ?? const <District>[]);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 8,
          children: [
            if (t.inPersonAtStudentHome)
              ChoiceChip(label: const Text('Öğrencinin adresinde'), selected: place == 'STUDENT_HOME', onSelected: (_) => onPlace('STUDENT_HOME')),
            if (t.inPersonAtTeacherPlace)
              ChoiceChip(label: const Text('Öğretmenin yerinde'), selected: place == 'TEACHER_PLACE', onSelected: (_) => onPlace('TEACHER_PLACE')),
          ],
        ),
        if (place == 'TEACHER_PLACE')
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              'Öğretmenin adresi ders onaylandıktan sonra ders ayrıntısında paylaşılır${t.district != null ? ' (${t.district!.name}${t.city != null ? ', ${t.city!.name}' : ''})' : ''}.',
              style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13),
            ),
          ),
        if (place == 'STUDENT_HOME') ...[
          const SizedBox(height: 12),
          PickerField(
            label: cityDistricts?.isLoading ?? false ? 'İlçeler yükleniyor…' : 'İlçe seçin',
            value: district?.name,
            icon: Icons.place_outlined,
            onTap: districts.isEmpty
                ? null
                : () async {
                    final picked = await pickOption<District>(context, title: 'İlçe', options: districts, labelOf: (d) => d.name, searchable: districts.length > 10);
                    if (picked?.value != null) onDistrict(picked!.value);
                  },
          ),
          const SizedBox(height: 12),
          TextField(
            controller: address,
            maxLines: 2,
            maxLength: 500,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(labelText: 'Açık adres', hintText: 'Mahalle, cadde/sokak, bina ve daire no'),
          ),
          Text('Adresiniz yalnızca öğretmen dersi onayladıktan sonra öğretmene gösterilir.', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12.5)),
        ],
      ],
    );
  }
}

class _SlotPicker extends ConsumerWidget {
  const _SlotPicker({
    required this.slug,
    required this.duration,
    required this.weekStart,
    required this.selectedDay,
    required this.selected,
    required this.onWeek,
    required this.onDay,
    required this.onSlot,
  });

  final String slug;
  final int duration;
  final String? weekStart;
  final String? selectedDay;
  final Slot? selected;
  final ValueChanged<String?> onWeek;
  final ValueChanged<String> onDay;
  final ValueChanged<Slot> onSlot;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final week = ref.watch(slotWeekProvider((slug, duration, weekStart)));
    final scheme = Theme.of(context).colorScheme;
    final maxDays = ref.watch(catalogProvider).valueOrNull?.rules.maxAdvanceDays ?? 30;
    return week.when(
      loading: () => const SizedBox(height: 160, child: Center(child: CircularProgressIndicator())),
      error: (error, _) => ErrorView(error: error, compact: true, onRetry: () => ref.invalidate(slotWeekProvider((slug, duration, weekStart)))),
      data: (week) {
        final days = week.days;
        if (days.isEmpty) return const Text('Takvim yüklenemedi.');
        final today = dateString(DateTime.now());
        final current = days.firstWhere((d) => d.date == selectedDay, orElse: () => days.firstWhere((d) => d.availableCount > 0, orElse: () => days.first));
        final canGoBack = week.startDate.compareTo(today) > 0;
        final canGoForward = addDays(week.startDate, 7).compareTo(addDays(today, maxDays)) <= 0;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                IconButton(
                  tooltip: 'Önceki hafta',
                  onPressed: canGoBack ? () => onWeek(addDays(week.startDate, -7).compareTo(today) <= 0 ? null : addDays(week.startDate, -7)) : null,
                  icon: const Icon(Icons.chevron_left_rounded),
                ),
                Expanded(
                  child: Text(
                    '${formatDayShort(days.first.date)} – ${formatDayShort(days.last.date)}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                IconButton(
                  tooltip: 'Sonraki hafta',
                  onPressed: canGoForward ? () => onWeek(addDays(week.startDate, 7)) : null,
                  icon: const Icon(Icons.chevron_right_rounded),
                ),
              ],
            ),
            SizedBox(
              height: 78,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: days.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (context, i) {
                  final day = days[i];
                  final active = day.date == current.date;
                  final empty = day.availableCount == 0;
                  return Semantics(
                    button: true,
                    selected: active,
                    label: '${day.weekday} ${day.day}, ${day.availableCount} boş saat',
                    child: InkWell(
                      borderRadius: BorderRadius.circular(14),
                      onTap: () => onDay(day.date),
                      child: Container(
                        width: 64,
                        decoration: BoxDecoration(
                          color: active ? scheme.primary : scheme.surface,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: active ? scheme.primary : scheme.outlineVariant),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(day.weekday, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: active ? Colors.white70 : scheme.onSurfaceVariant)),
                            const SizedBox(height: 2),
                            Text(day.day, style: TextStyle(fontWeight: FontWeight.w800, color: active ? Colors.white : (empty ? scheme.onSurfaceVariant : scheme.onSurface))),
                            const SizedBox(height: 2),
                            Text(
                              empty ? 'dolu' : '${day.availableCount} boş',
                              style: TextStyle(fontSize: 11, color: active ? Colors.white70 : (empty ? scheme.onSurfaceVariant : const Color(0xFF059669)), fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 12),
            if (current.slots.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text('Bu gün için müsait saat yok. Başka bir gün seçin.', style: TextStyle(color: scheme.onSurfaceVariant)),
              )
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final slot in current.slots)
                    ChoiceChip(
                      label: Text(slot.time),
                      selected: selected?.startAt == slot.startAt,
                      onSelected: slot.available ? (_) => onSlot(slot) : null,
                      labelStyle: TextStyle(
                        decoration: slot.available ? null : TextDecoration.lineThrough,
                        color: slot.available ? null : scheme.onSurfaceVariant,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                ],
              ),
            if (selected != null)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text('Seçilen: ${formatLessonRange(selected!.startAt, selected!.endAt)}', style: TextStyle(color: scheme.primary, fontWeight: FontWeight.w700)),
              ),
          ],
        );
      },
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.teacher, required this.offering, required this.duration, required this.mode, required this.slot, required this.price, this.intro = false});

  final TeacherProfile teacher;
  final Offering offering;
  final int duration;
  final String mode;
  final Slot? slot;
  final int price;
  final bool intro;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        children: [
          InfoRow(label: 'Öğretmen', value: teacher.name),
          InfoRow(label: 'Ders', value: intro ? '${offering.title} · Ücretsiz tanışma' : '${offering.title} · ${offering.service.name}'),
          InfoRow(label: 'Zaman', value: slot == null ? 'Saat seçilmedi' : formatLessonRange(slot!.startAt, slot!.endAt)),
          InfoRow(label: 'Süre', value: durationLabel(duration)),
          InfoRow(label: 'Şekil', value: mode == 'ONLINE' ? 'Online (sanal sınıf)' : 'Yüz yüze'),
          const Divider(height: 20),
          Row(
            children: [
              Expanded(child: Text(intro ? 'Ücret' : 'Toplam (KDV dahil)', style: const TextStyle(fontWeight: FontWeight.w600))),
              Text(intro ? 'Ücretsiz' : formatMoney(price), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            ],
          ),
        ],
      ),
    );
  }
}

/// Ön bilgilendirme formu ve mesafeli satış sözleşmesi onay metni.
class ConsentText extends StatelessWidget {
  const ConsentText({super.key, required this.onOpen});

  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context) {
    final link = TextStyle(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.w700, decoration: TextDecoration.underline);
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: 'Ön Bilgilendirme Formu', style: link, recognizer: TapGestureRecognizer()..onTap = () => onOpen('on-bilgilendirme-formu')),
          const TextSpan(text: ' ile '),
          TextSpan(text: 'Mesafeli Satış Sözleşmesi', style: link, recognizer: TapGestureRecognizer()..onTap = () => onOpen('mesafeli-satis-sozlesmesi')),
          const TextSpan(text: '’ni okudum ve onaylıyorum.'),
        ],
      ),
      style: const TextStyle(fontSize: 14, height: 1.4),
    );
  }
}
