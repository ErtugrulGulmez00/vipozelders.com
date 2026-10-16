import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/format/dates.dart';
import '../../core/models/teacher_panel.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';

const _exceptionLabels = {'BLOCKED_DAY': 'Bütün gün kapalı', 'BLOCKED': 'Saat aralığı kapalı', 'EXTRA': 'Ek müsaitlik'};

/// Öğretmen takvimi: haftalık müsaitlik şablonu, dersler arası tampon süre, izin ve ek saatler.
class TeacherCalendarScreen extends ConsumerWidget {
  const TeacherCalendarScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final calendar = ref.watch(teacherCalendarProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Takvim'), actions: const [NotificationBell()]),
      body: AsyncBody(
        value: calendar,
        onRetry: () => ref.invalidate(teacherCalendarProvider),
        builder: (data) => _CalendarEditor(key: ValueKey(data), calendar: data),
      ),
    );
  }
}

class _Range {
  _Range(this.start, this.end);

  int start;
  int end;
}

class _CalendarEditor extends ConsumerStatefulWidget {
  const _CalendarEditor({super.key, required this.calendar});

  final TeacherCalendar calendar;

  @override
  ConsumerState<_CalendarEditor> createState() => _CalendarEditorState();
}

class _CalendarEditorState extends ConsumerState<_CalendarEditor> {
  late final Map<int, List<_Range>> _days = {
    for (var d = 1; d <= 7; d++)
      d: [
        for (final r in widget.calendar.rules.where((r) => r.weekday == d))
          if (timeToMinutes(r.start) != null && timeToMinutes(r.end) != null) _Range(timeToMinutes(r.start)!, timeToMinutes(r.end)!),
      ]..sort((a, b) => a.start.compareTo(b.start)),
  };
  late int _buffer = widget.calendar.bufferMinutes;
  bool _dirty = false;
  bool _saving = false;

  void _changed() => setState(() => _dirty = true);

  Future<int?> _pickTime(int initial, String help) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: initial ~/ 60, minute: initial % 60),
      helpText: help,
      initialEntryMode: TimePickerEntryMode.dial,
      builder: (context, child) => MediaQuery(data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true), child: child!),
    );
    return picked == null ? null : picked.hour * 60 + picked.minute;
  }

  Future<void> _editRange(int day, [_Range? range]) async {
    final start = await _pickTime(range?.start ?? 9 * 60, 'Başlangıç saati');
    if (start == null || !mounted) return;
    final end = await _pickTime(range?.end ?? (start + 180).clamp(0, 24 * 60 - 1), 'Bitiş saati');
    if (end == null || !mounted) return;
    if (end - start < 30) {
      showSnack(context, 'Her aralık en az 30 dakika olmalı ve bitiş başlangıçtan sonra olmalı.', error: true);
      return;
    }
    final others = _days[day]!.where((r) => r != range);
    if (others.any((r) => start < r.end && end > r.start)) {
      showSnack(context, 'Aynı gün içindeki aralıklar çakışmamalı.', error: true);
      return;
    }
    setState(() {
      if (range == null) {
        _days[day]!.add(_Range(start, end));
      } else {
        range
          ..start = start
          ..end = end;
      }
      _days[day]!.sort((a, b) => a.start.compareTo(b.start));
      _dirty = true;
    });
  }

  void _copyMondayToWeekdays() {
    final monday = _days[1]!;
    setState(() {
      for (var d = 2; d <= 5; d++) {
        _days[d] = [for (final r in monday) _Range(r.start, r.end)];
      }
      _dirty = true;
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final rules = [
      for (final entry in _days.entries)
        for (final r in entry.value) AvailabilityRule(weekday: entry.key, start: minutesToTime(r.start), end: minutesToTime(r.end)),
    ];
    try {
      await ref.read(apiProvider).saveCalendar(rules, _buffer);
      if (!mounted) return;
      setState(() => _dirty = false);
      showSnack(context, 'Takviminiz kaydedildi. Boş saatleriniz velilere bu şablona göre gösterilir.');
      ref.invalidate(teacherCalendarProvider);
    } on ApiException catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _addException() async {
    final added = await showModalBottomSheet<bool>(context: context, isScrollControlled: true, useSafeArea: true, builder: (_) => const _ExceptionSheet());
    if (added ?? false) ref.invalidate(teacherCalendarProvider);
  }

  Future<void> _deleteException(AvailabilityException e) async {
    final ok = await confirmDialog(context, title: 'Kayıt silinsin mi?', message: '${formatDayLong(e.date)} · ${_exceptionLabels[e.kind] ?? e.kind}', confirmText: 'Sil', destructive: true);
    if (!ok) return;
    try {
      await ref.read(apiProvider).deleteAvailabilityException(e.id);
      ref.invalidate(teacherCalendarProvider);
    } on ApiException catch (error) {
      if (mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final calendar = widget.calendar;
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              Text(
                'Haftalık şablonunuzdaki aralıklar velilere boş saat olarak gösterilir. Onaylı dersler ve izinler bu saatleri otomatik kapatır.',
                style: TextStyle(color: scheme.onSurfaceVariant, height: 1.4),
              ),
              const SizedBox(height: 12),
              for (var day = 1; day <= 7; day++) ...[
                Card(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 10, 8, 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(child: Text(weekdayNames[day - 1], style: const TextStyle(fontWeight: FontWeight.w800))),
                            if (day == 1 && _days[1]!.isNotEmpty)
                              TextButton(onPressed: _copyMondayToWeekdays, child: const Text('Hafta içine kopyala')),
                            IconButton(tooltip: '${weekdayNames[day - 1]} için aralık ekle', onPressed: () => _editRange(day), icon: const Icon(Icons.add_circle_outline_rounded)),
                          ],
                        ),
                        if (_days[day]!.isEmpty)
                          Text('Kapalı', style: TextStyle(color: scheme.onSurfaceVariant))
                        else
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              for (final r in _days[day]!)
                                InputChip(
                                  label: Text('${minutesToTime(r.start)} – ${minutesToTime(r.end)}', style: const TextStyle(fontWeight: FontWeight.w700)),
                                  onPressed: () => _editRange(day, r),
                                  onDeleted: () => setState(() {
                                    _days[day]!.remove(r);
                                    _dirty = true;
                                  }),
                                  deleteButtonTooltipMessage: 'Kaldır',
                                ),
                            ],
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),
              ],
              const SizedBox(height: 8),
              SectionCard(
                title: 'Dersler arası ara',
                subtitle: 'Bir ders bittikten sonra yeni ders başlamadan önce bırakılacak süre',
                child: Wrap(
                  spacing: 8,
                  children: [
                    for (final option in calendar.bufferOptions)
                      ChoiceChip(
                        label: Text(option == 0 ? 'Ara yok' : '$option dk'),
                        selected: _buffer == option,
                        onSelected: (_) {
                          _buffer = option;
                          _changed();
                        },
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              SectionCard(
                title: 'İzinler ve ek saatler',
                subtitle: 'Tek seferlik kapalı gün/saat ya da şablon dışında ek müsaitlik',
                trailing: IconButton(tooltip: 'Ekle', onPressed: _addException, icon: const Icon(Icons.add_circle_outline_rounded)),
                padding: const EdgeInsets.fromLTRB(4, 8, 4, 8),
                child: calendar.exceptions.isEmpty
                    ? const Padding(padding: EdgeInsets.all(12), child: Text('İleri tarihli izin ya da ek saat yok.'))
                    : Column(
                        children: [
                          for (final e in calendar.exceptions)
                            ListTile(
                              leading: Icon(e.kind == 'EXTRA' ? Icons.add_alarm_rounded : Icons.event_busy_rounded, color: e.kind == 'EXTRA' ? const Color(0xFF059669) : scheme.error),
                              title: Text(formatDayLong(e.date)),
                              subtitle: Text([
                                _exceptionLabels[e.kind] ?? e.kind,
                                if (e.start != null && e.end != null) '${e.start} – ${e.end}',
                                if (e.note != null) e.note!,
                              ].join(' · ')),
                              trailing: IconButton(tooltip: 'Sil', onPressed: () => _deleteException(e), icon: const Icon(Icons.delete_outline_rounded)),
                            ),
                        ],
                      ),
              ),
            ],
          ),
        ),
        if (_dirty)
          SafeArea(
            top: false,
            child: Container(
              decoration: BoxDecoration(color: scheme.surface, border: Border(top: BorderSide(color: scheme.outlineVariant))),
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
              child: Row(
                children: [
                  const Expanded(child: ToneBadge(label: 'Kaydedilmemiş değişiklik var', tone: Tone.amber)),
                  const SizedBox(width: 12),
                  BusyButton(busy: _saving, onPressed: _save, label: 'Takvimi kaydet', icon: Icons.save_rounded),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _ExceptionSheet extends ConsumerStatefulWidget {
  const _ExceptionSheet();

  @override
  ConsumerState<_ExceptionSheet> createState() => _ExceptionSheetState();
}

class _ExceptionSheetState extends ConsumerState<_ExceptionSheet> {
  String _kind = 'BLOCKED_DAY';
  String _date = addDays(dateString(DateTime.now()), 1);
  int _start = 9 * 60;
  int _end = 12 * 60;
  final _note = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final today = dateString(DateTime.now());
    final picked = await showDatePicker(
      context: context,
      initialDate: pickerDate(_date),
      firstDate: pickerDate(today),
      lastDate: pickerDate(addDays(today, 180)),
      locale: const Locale('tr', 'TR'),
    );
    if (picked != null) setState(() => _date = dayFromPicker(picked));
  }

  Future<void> _pickTime(bool start) async {
    final value = start ? _start : _end;
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: value ~/ 60, minute: value % 60),
      builder: (context, child) => MediaQuery(data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true), child: child!),
    );
    if (picked == null) return;
    setState(() {
      if (start) {
        _start = picked.hour * 60 + picked.minute;
      } else {
        _end = picked.hour * 60 + picked.minute;
      }
    });
  }

  Future<void> _save() async {
    if (_kind != 'BLOCKED_DAY' && _end - _start < 30) {
      setState(() => _error = 'Saat aralığı en az 30 dakika olmalı.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(apiProvider).addAvailabilityException(
            date: _date,
            kind: _kind,
            start: _kind == 'BLOCKED_DAY' ? null : minutesToTime(_start),
            end: _kind == 'BLOCKED_DAY' ? null : minutesToTime(_end),
            note: _note.text.trim(),
          );
      if (!mounted) return;
      showSnack(context, 'Kaydedildi.');
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
            Text('İzin / ek saat', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final entry in _exceptionLabels.entries)
                  ChoiceChip(label: Text(entry.value), selected: _kind == entry.key, onSelected: (_) => setState(() => _kind = entry.key)),
              ],
            ),
            const SizedBox(height: 14),
            OutlinedButton.icon(onPressed: _pickDate, icon: const Icon(Icons.event_rounded), label: Text(formatDayLong(_date))),
            if (_kind != 'BLOCKED_DAY') ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: OutlinedButton(onPressed: () => _pickTime(true), child: Text('Başlangıç ${minutesToTime(_start)}'))),
                  const SizedBox(width: 10),
                  Expanded(child: OutlinedButton(onPressed: () => _pickTime(false), child: Text('Bitiş ${minutesToTime(_end)}'))),
                ],
              ),
            ],
            const SizedBox(height: 12),
            TextField(controller: _note, maxLength: 200, decoration: const InputDecoration(labelText: 'Not (isteğe bağlı)', hintText: 'Örn: Doktor randevusu')),
            if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
            BusyButton(busy: _busy, onPressed: _save, label: 'Kaydet'),
          ],
        ),
      ),
    );
  }
}
