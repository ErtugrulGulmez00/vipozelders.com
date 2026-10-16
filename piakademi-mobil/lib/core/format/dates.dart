// Tarih ve saatler her zaman İstanbul saatiyle gösterilir (Türkiye 2016'dan beri sabit UTC+3);
// telefonun saat dilimi farklı olsa da ders saati değişmez.

const _istanbulOffset = Duration(hours: 3);

const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const monthShort = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const weekdayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const weekdayShort = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

/// Bir anın İstanbul'daki duvar saati (alanları İstanbul saatini gösteren UTC nesnesi).
DateTime istanbul(DateTime moment) => moment.toUtc().add(_istanbulOffset);

/// İstanbul'daki "şu an".
DateTime istanbulNow([DateTime? now]) => istanbul(now ?? DateTime.now());

String _two(int n) => n.toString().padLeft(2, '0');

/// "18:00"
String formatTime(DateTime moment) {
  final z = istanbul(moment);
  return '${_two(z.hour)}:${_two(z.minute)}';
}

/// "16 Ekim 2026"
String formatDate(DateTime moment) {
  final z = istanbul(moment);
  return '${z.day} ${monthNames[z.month - 1]} ${z.year}';
}

/// "16 Ekim 2026 Cuma 18:00"
String formatDateTime(DateTime moment) {
  final z = istanbul(moment);
  return '${z.day} ${monthNames[z.month - 1]} ${z.year} ${weekdayNames[z.weekday - 1]} ${formatTime(moment)}';
}

/// "16.10.2026 18:00"
String formatCompact(DateTime moment) {
  final z = istanbul(moment);
  return '${_two(z.day)}.${_two(z.month)}.${z.year} ${formatTime(moment)}';
}

/// "16 Eki Cum"
String formatShortDate(DateTime moment) {
  final z = istanbul(moment);
  return '${z.day} ${monthShort[z.month - 1]} ${weekdayShort[z.weekday - 1]}';
}

/// "16 Ekim Cuma · 18:00–19:00" (yıl bu yıl değilse eklenir)
String formatLessonRange(DateTime start, DateTime end, {DateTime? now}) {
  final z = istanbul(start);
  final year = z.year == istanbulNow(now).year ? '' : ' ${z.year}';
  return '${z.day} ${monthNames[z.month - 1]}$year ${weekdayNames[z.weekday - 1]} · ${formatTime(start)}–${formatTime(end)}';
}

/// Bildirim zamanı: "az önce", "5 dk önce", "3 saat önce", "dün 18:00", "12 Eki"
String formatRelative(DateTime moment, {DateTime? now}) {
  final current = now ?? DateTime.now();
  final diff = current.difference(moment);
  if (diff.inMinutes < 1) return 'az önce';
  if (diff.inMinutes < 60) return '${diff.inMinutes} dk önce';
  final today = dateString(current);
  final day = dateString(moment);
  if (day == today) return '${diff.inHours} saat önce';
  if (day == addDays(today, -1)) return 'dün ${formatTime(moment)}';
  final z = istanbul(moment);
  final sameYear = z.year == istanbulNow(current).year;
  return sameYear ? '${z.day} ${monthShort[z.month - 1]}' : '${z.day} ${monthShort[z.month - 1]} ${z.year}';
}

/// Kalan süre: "3 saat 20 dakika", "2 gün 4 saat", "1 dakikadan az"
String formatDuration(Duration duration) {
  final totalMinutes = duration.inSeconds <= 0 ? 0 : (duration.inSeconds / 60).round();
  final days = totalMinutes ~/ 1440;
  final hours = (totalMinutes % 1440) ~/ 60;
  final minutes = totalMinutes % 60;
  final parts = <String>[];
  if (days > 0) parts.add('$days gün');
  if (hours > 0) parts.add('$hours saat');
  if (minutes > 0 && days == 0) parts.add('$minutes dakika');
  return parts.isEmpty ? '1 dakikadan az' : parts.join(' ');
}

/// Geri sayım: "02:14:05" ya da "14:05"
String formatCountdown(Duration duration) {
  final total = duration.isNegative ? 0 : duration.inSeconds;
  final h = total ~/ 3600;
  final m = (total % 3600) ~/ 60;
  final s = total % 60;
  return h > 0 ? '${_two(h)}:${_two(m)}:${_two(s)}' : '${_two(m)}:${_two(s)}';
}

/// 45 → "45 dk", 60 → "1 saat", 90 → "1 saat 30 dk"
String durationLabel(int minutes) {
  if (minutes % 60 == 0) return '${minutes ~/ 60} saat';
  if (minutes > 60) return '${minutes ~/ 60} saat ${minutes % 60} dk';
  return '$minutes dk';
}

/// 1080 → "18:00"
String minutesToTime(int minutes) => '${_two(minutes ~/ 60)}:${_two(minutes % 60)}';

/// "18:30" → 1110; geçersizse null
int? timeToMinutes(String value) {
  final match = RegExp(r'^(\d{1,2}):(\d{2})$').firstMatch(value.trim());
  if (match == null) return null;
  final hours = int.parse(match.group(1)!);
  final minutes = int.parse(match.group(2)!);
  if (hours > 24 || minutes > 59 || (hours == 24 && minutes > 0)) return null;
  return hours * 60 + minutes;
}

// ---------------------------------------------------------------------------
// "YYYY-MM-DD" günleri (kurum ve takvim ekranları)
// ---------------------------------------------------------------------------

/// Bir anın İstanbul'daki günü: "2026-10-16"
String dateString(DateTime moment) {
  final z = istanbul(moment);
  return '${z.year}-${_two(z.month)}-${_two(z.day)}';
}

DateTime _parseDay(String day) {
  final parts = day.split('-').map(int.parse).toList();
  return DateTime.utc(parts[0], parts[1], parts[2]);
}

String _formatDay(DateTime utcDay) => '${utcDay.year}-${_two(utcDay.month)}-${_two(utcDay.day)}';

String addDays(String day, int days) => _formatDay(_parseDay(day).add(Duration(days: days)));

/// 1 = Pazartesi … 7 = Pazar
int isoWeekday(String day) => _parseDay(day).weekday;

/// Haftanın pazartesisi
String weekStartOf(String day) => addDays(day, 1 - isoWeekday(day));

bool isDayString(String value) => RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(value);

/// "2026-10-16" → "16 Ekim 2026"
String formatDayLong(String day) {
  final d = _parseDay(day);
  return '${d.day} ${monthNames[d.month - 1]} ${d.year}';
}

/// "2026-10-16" → "16 Eki"
String formatDayShort(String day) {
  final d = _parseDay(day);
  return '${d.day} ${monthShort[d.month - 1]}';
}

/// "2026-10-16" → "Cum 16.10"
String formatDayWithWeekday(String day) {
  final d = _parseDay(day);
  return '${weekdayShort[d.weekday - 1]} ${_two(d.day)}.${_two(d.month)}';
}

/// "2026-10-16" → "16.10.2026"
String formatDayNumeric(String day) {
  final d = _parseDay(day);
  return '${_two(d.day)}.${_two(d.month)}.${d.year}';
}

/// Takvim seçicisinden gelen yerel gün → "YYYY-MM-DD"
String dayFromPicker(DateTime picked) => '${picked.year}-${_two(picked.month)}-${_two(picked.day)}';

/// "YYYY-MM-DD" → takvim seçicisi için yerel tarih
DateTime pickerDate(String day) {
  final d = _parseDay(day);
  return DateTime(d.year, d.month, d.day);
}
