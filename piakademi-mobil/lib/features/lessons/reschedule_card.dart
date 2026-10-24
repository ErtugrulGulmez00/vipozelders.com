import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/format/dates.dart';
import '../../core/models/booking.dart';
import '../../core/models/teacher.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import '../booking/booking_screen.dart';
import '../shared/data.dart';

/// Erteleme: onaylı derste veli ya da öğretmen yeni saat önerir, karşı taraf kabul edince ders taşınır.
class RescheduleCard extends ConsumerStatefulWidget {
  const RescheduleCard({super.key, required this.booking, required this.teacherSlug});

  final BookingDetail booking;

  /// Öğretmenin takvimi (yeni saat seçmek için)
  final String? teacherSlug;

  @override
  ConsumerState<RescheduleCard> createState() => _RescheduleCardState();
}

class _RescheduleCardState extends ConsumerState<RescheduleCard> {
  bool _busy = false;

  Future<void> _run(String action, {DateTime? newStartAt, String? note, String? done}) async {
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).reschedule(widget.booking.id, action, newStartAt: newStartAt, note: note, requestId: widget.booking.reschedule.pendingId);
      bumpBookings(ref);
      if (mounted && done != null) showSnack(context, done);
    } on ApiException catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _propose() async {
    final slug = widget.teacherSlug;
    if (slug == null) return;
    final result = await showModalBottomSheet<(Slot, String)>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _ProposeSheet(slug: slug, duration: widget.booking.summary.durationMinutes),
    );
    if (result == null) return;
    await _run('request', newStartAt: result.$1.startAt, note: result.$2, done: 'Öneriniz karşı tarafa iletildi; kabul edilirse ders yeni saate taşınır.');
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.booking.reschedule;
    final scheme = Theme.of(context).colorScheme;
    if (r.hasPending) {
      final when = r.pendingStartAt == null ? '' : formatLessonRange(r.pendingStartAt!, r.pendingStartAt!.add(Duration(minutes: widget.booking.summary.durationMinutes)));
      return SectionCard(
        title: r.pendingMine ? 'Saat değişikliği öneriniz' : 'Saat değişikliği önerisi',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            NoticeBox(
              tone: Tone.amber,
              icon: Icons.event_repeat_rounded,
              message: '${r.pendingMine ? 'Karşı tarafın yanıtı bekleniyor' : 'Yeni saat önerildi'}: $when${r.pendingNote == null ? '' : '\nNot: “${r.pendingNote}”'}',
            ),
            const SizedBox(height: 10),
            if (r.pendingMine)
              BusyButton(busy: _busy, outlined: true, onPressed: () => _run('cancel', done: 'Öneri geri çekildi.'), label: 'Öneriyi geri çek')
            else
              Row(
                children: [
                  Expanded(child: BusyButton(busy: _busy, onPressed: () => _run('accept', done: 'Ders yeni saate taşındı.'), label: 'Kabul et', icon: Icons.check_rounded)),
                  const SizedBox(width: 8),
                  Expanded(child: BusyButton(busy: _busy, outlined: true, onPressed: () => _run('decline', done: 'Öneri reddedildi; ders eski saatinde.'), label: 'Reddet')),
                ],
              ),
          ],
        ),
      );
    }
    if (!r.allowed) return const SizedBox.shrink();
    return SectionCard(
      title: 'Saati değiştirmek mi istiyorsunuz?',
      subtitle: 'Yeni bir saat önerin; karşı taraf kabul ederse ders taşınır.${r.count > 0 ? ' Bu ders ${r.count} kez ertelendi.' : ''}',
      child: Align(
        alignment: Alignment.centerLeft,
        child: OutlinedButton.icon(
          onPressed: _busy || widget.teacherSlug == null ? null : _propose,
          icon: const Icon(Icons.event_repeat_rounded),
          label: Text('Yeni saat öner', style: TextStyle(color: scheme.primary)),
        ),
      ),
    );
  }
}

class _ProposeSheet extends StatefulWidget {
  const _ProposeSheet({required this.slug, required this.duration});

  final String slug;
  final int duration;

  @override
  State<_ProposeSheet> createState() => _ProposeSheetState();
}

class _ProposeSheetState extends State<_ProposeSheet> {
  String? _weekStart;
  String? _day;
  Slot? _slot;
  final _note = TextEditingController();

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Yeni saat öner', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            SlotPicker(
              slug: widget.slug,
              duration: widget.duration,
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
            TextField(controller: _note, maxLength: 300, decoration: const InputDecoration(labelText: 'Not (isteğe bağlı)', hintText: 'Örn: O gün okul gezisi var')),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: _slot == null ? null : () => Navigator.pop(context, (_slot!, _note.text.trim())),
              child: Text(_slot == null ? 'Saat seçin' : 'Öner: ${formatLessonRange(_slot!.startAt, _slot!.endAt)}'),
            ),
          ],
        ),
      ),
    );
  }
}
