import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api/api_exception.dart';
import '../../core/format/money.dart';
import '../../core/models/booking.dart';
import '../../core/providers.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/rating.dart';
import '../shared/data.dart';

/// Ders ayrıntısındaki işlemler. Her işlemden sonra listeler ve ayrıntı yenilenir.
class LessonActions {
  LessonActions(this.context, this.ref, this.booking);

  final BuildContext context;
  final WidgetRef ref;
  final BookingDetail booking;

  Future<bool> _run(Future<void> Function() action, String success) async {
    try {
      await action();
      bumpBookings(ref);
      if (context.mounted) showSnack(context, success);
      return true;
    } on ApiException catch (error) {
      if (context.mounted) showError(context, error);
      return false;
    }
  }

  /// Veli iptali: iade tutarı önceden gösterilir.
  Future<void> cancelByStudent() async {
    final preview = booking.actions.cancelPreview;
    final refund = preview?.refundAmount ?? 0;
    final message = refund >= booking.price && refund > 0
        ? 'Şimdi iptal ederseniz ödediğiniz ${formatMoney(booking.price)} tamamen iade edilir.'
        : refund > 0
            ? 'Şimdi iptal ederseniz ${formatMoney(refund)} (%${preview?.refundPercent ?? 0}) iade edilir.'
            : 'Derse çok az kaldığı için iptal politikası gereği iade yapılmaz.';
    final reason = await reasonDialog(
      context,
      title: booking.summary.isQuestion ? 'Soruyu iptal et' : 'Randevuyu iptal et',
      message: message,
      confirmText: 'İptal et',
      hint: 'Kısa bir iptal gerekçesi yazın',
      minLength: 3,
      destructive: true,
    );
    if (reason == null) return;
    await _run(() => ref.read(apiProvider).cancel(booking.id, reason), 'Randevunuz iptal edildi.');
  }

  /// Öğretmen iptali: öğrenciye tam iade yapılır.
  Future<void> cancelByTeacher() async {
    final reason = await reasonDialog(
      context,
      title: 'Dersi iptal et',
      message: 'Öğrenciye ücretin tamamı iade edilir. Gerekçeniz öğrenciye iletilir.',
      confirmText: 'Dersi iptal et',
      hint: 'Öğrenciye iletilecek iptal gerekçesi',
      minLength: 5,
      destructive: true,
    );
    if (reason == null) return;
    await _run(() => ref.read(apiProvider).cancel(booking.id, reason), 'Ders iptal edildi; öğrenciye tam iade yapıldı.');
  }

  Future<void> approve() async {
    final ok = await confirmDialog(
      context,
      title: 'Talebi onayla',
      message: 'Ders onaylanınca saat takviminizde dolar ve veliye bildirim gider.',
      confirmText: 'Onayla',
    );
    if (!ok) return;
    await _run(() => ref.read(apiProvider).approve(booking.id), 'Ders onaylandı.');
  }

  Future<void> reject() async {
    final reason = await reasonDialog(
      context,
      title: booking.summary.isQuestion ? 'Soruyu reddet' : 'Talebi reddet',
      message: 'Veliye ücretin tamamı otomatik iade edilir.',
      confirmText: 'Reddet',
      presets: const ['O saatte müsait değilim', 'Bu konu/seviye için uygun değilim', 'Diğer'],
      hint: 'Gerekçenizi yazın',
      minLength: 3,
      destructive: true,
    );
    if (reason == null) return;
    await _run(() => ref.read(apiProvider).reject(booking.id, reason), 'Talep reddedildi; veliye tam iade yapıldı.');
  }

  Future<void> dispute() async {
    final reason = await reasonDialog(
      context,
      title: 'Sorun bildir',
      message: 'Ekibimiz inceleyip sonuçlandırana kadar öğretmene ödeme yapılmaz.',
      confirmText: 'Bildir',
      hint: 'Yaşadığınız sorunu anlatın (en az 10 karakter)',
      minLength: 10,
    );
    if (reason == null) return;
    await _run(() => ref.read(apiProvider).dispute(booking.id, reason), 'Bildiriminiz alındı. En kısa sürede dönüş yapacağız.');
  }

  Future<void> review() async {
    final existing = booking.review;
    final result = await showModalBottomSheet<(int, String)>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _ReviewSheet(initialRating: existing?.rating ?? 0, initialComment: existing?.comment ?? '', teacherName: booking.summary.counterpart.name),
    );
    if (result == null) return;
    await _run(() => ref.read(apiProvider).review(booking.id, rating: result.$1, comment: result.$2), 'Değerlendirmeniz kaydedildi. Teşekkürler!');
  }

  /// Takvime ekleme: Google Takvim bağlantısı ya da takvim dosyası (.ics; iPhone'da "Takvime ekle").
  Future<void> addToCalendar() async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      useSafeArea: true,
      builder: (context) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Padding(padding: EdgeInsets.fromLTRB(20, 0, 20, 8), child: Text('Takvime ekle', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
          ListTile(leading: const Icon(Icons.event_rounded), title: const Text('Google Takvim'), onTap: () => Navigator.pop(context, 'google')),
          ListTile(
            leading: const Icon(Icons.file_download_outlined),
            title: const Text('Takvim dosyası (.ics)'),
            subtitle: const Text('iPhone Takvim, Outlook ve diğer uygulamalar'),
            onTap: () => Navigator.pop(context, 'ics'),
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
    if (choice == null || !context.mounted) return;
    if (choice == 'google') {
      await openExternal(context, googleCalendarUrl(booking));
      return;
    }
    try {
      final ics = await ref.read(apiProvider).calendarFile(booking.id);
      if (ics.isEmpty) throw const ApiException(code: 'INTERNAL', message: 'Takvim dosyası alınamadı.');
      await SharePlus.instance.share(
        ShareParams(
          files: [XFile.fromData(Uint8List.fromList(utf8.encode(ics)), mimeType: 'text/calendar', name: 'ders-${booking.summary.code}.ics')],
          fileNameOverrides: ['ders-${booking.summary.code}.ics'],
          subject: 'Pi Kampüs dersi',
        ),
      );
    } on ApiException catch (error) {
      if (context.mounted) showError(context, error);
    }
  }
}

/// Sitedeki "Google Takvim" bağlantısıyla aynı biçim.
String googleCalendarUrl(BookingDetail booking) {
  final s = booking.summary;
  String stamp(DateTime d) => '${d.toUtc().toIso8601String().replaceAll(RegExp(r'[-:]'), '').split('.').first}Z';
  final location = booking.location?.text;
  return Uri.https('calendar.google.com', '/calendar/render', {
    'action': 'TEMPLATE',
    'text': '${s.levelName} ${s.subjectName} dersi (Pi Kampüs)',
    'dates': '${stamp(s.startAt)}/${stamp(s.endAt)}',
    'details': [
      '${s.isOnline ? 'Online ders' : 'Yüz yüze ders'} · ${s.counterpart.name}',
      'Öğrenci: ${s.learnerName}',
      if (s.isOnline) 'Derse Pi Kampüs uygulamasından “Derse katıl” ile girebilirsiniz.',
      'Randevu no: ${s.code}',
    ].join('\n'),
    'location': s.isOnline ? 'Pi Kampüs sanal sınıf' : (location ?? ''),
  }).toString();
}

class _ReviewSheet extends StatefulWidget {
  const _ReviewSheet({required this.initialRating, required this.initialComment, required this.teacherName});

  final int initialRating;
  final String initialComment;
  final String teacherName;

  @override
  State<_ReviewSheet> createState() => _ReviewSheetState();
}

class _ReviewSheetState extends State<_ReviewSheet> {
  late int _rating = widget.initialRating;
  late final _comment = TextEditingController(text: widget.initialComment);
  String? _error;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.viewInsetsOf(context).bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('${widget.teacherName} adlı öğretmeni değerlendirin', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          Text('Puanınız diğer velilere yol gösterir. Öğretmen başına bir değerlendirme yapılır; sonradan güncelleyebilirsiniz.', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
          const SizedBox(height: 12),
          StarInput(value: _rating, onChanged: (v) => setState(() => _rating = v)),
          const SizedBox(height: 12),
          TextField(
            controller: _comment,
            maxLines: 4,
            maxLength: 1500,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(labelText: 'Yorumunuz (isteğe bağlı)', hintText: 'Ders nasıl geçti? Öğretmenin anlatımı, iletişimi…'),
          ),
          if (_error != null) Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: () {
              if (_rating == 0) {
                setState(() => _error = '1 ile 5 arasında puan verin.');
                return;
              }
              Navigator.pop(context, (_rating, _comment.text.trim()));
            },
            child: const Text('Gönder'),
          ),
        ],
      ),
    );
  }
}
