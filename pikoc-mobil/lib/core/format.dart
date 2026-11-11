import 'package:intl/intl.dart';

/// Tarih ve sayı biçimleri (İstanbul saatiyle gelen "YYYY-AA-GG" tarihler).
const weekdayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

DateTime parseDay(String ymd) {
  final p = ymd.split('-').map(int.parse).toList();
  return DateTime(p[0], p[1], p[2]);
}

String ymd(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// Cihazın bugünü (öğrenci girişlerinde tarih alanı için)
String todayYmd() => ymd(DateTime.now());

String addDays(String day, int n) => ymd(parseDay(day).add(Duration(days: n)));

/// "12 Kasım"
String dayMonth(String day) {
  final d = parseDay(day);
  return '${d.day} ${monthNames[d.month - 1]}';
}

/// "12.11"
String shortDate(String day) => '${day.substring(8)}.${day.substring(5, 7)}';

/// "Çarşamba, 12 Kasım"
String longDay(String day) {
  final d = parseDay(day);
  return '${weekdayNames[d.weekday - 1]}, ${d.day} ${monthNames[d.month - 1]}';
}

String timeOf(int minute) => '${(minute ~/ 60).toString().padLeft(2, '0')}:${(minute % 60).toString().padLeft(2, '0')}';

/// "her Çarşamba 18:00"
String meetingText(Map<String, dynamic>? meeting) {
  if (meeting == null) return '';
  final weekday = (meeting['weekday'] as num?)?.toInt();
  if (weekday == null || weekday < 1 || weekday > 7) return '';
  final minute = (meeting['minute'] as num?)?.toInt();
  return 'her ${weekdayNames[weekday - 1]}${minute != null ? ' ${timeOf(minute)}' : ''}';
}

/// "45 dk", "2 sa 15 dk"
String minutesText(int minutes) {
  if (minutes < 60) return '$minutes dk';
  final h = minutes ~/ 60;
  final m = minutes % 60;
  return m == 0 ? '$h sa' : '$h sa $m dk';
}

final _num = NumberFormat.decimalPattern('tr_TR');
final _net = NumberFormat('#,##0.##', 'tr_TR');

String numText(num value) => _num.format(value);
String netText(num value) => _net.format(value);
String percent(double? ratio) => ratio == null ? '—' : '%${(ratio * 100).round()}';

/// "00:42:07"
String clock(Duration d) {
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(d.inHours)}:${two(d.inMinutes % 60)}:${two(d.inSeconds % 60)}';
}
