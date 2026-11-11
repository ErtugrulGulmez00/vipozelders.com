import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:pikoc/core/format.dart';

void main() {
  setUpAll(() => initializeDateFormatting('tr_TR'));

  test('süre ve tarih biçimleri', () {
    expect(minutesText(45), '45 dk');
    expect(minutesText(135), '2 sa 15 dk');
    expect(minutesText(120), '2 sa');
    expect(addDays('2026-11-30', 1), '2026-12-01');
    expect(dayMonth('2026-11-11'), '11 Kasım');
    expect(longDay('2026-11-11'), 'Çarşamba, 11 Kasım');
    expect(meetingText({'weekday': 1, 'minute': 1080}), 'her Pazartesi 18:00');
    expect(meetingText(null), '');
    expect(clock(const Duration(minutes: 62, seconds: 5)), '01:02:05');
  });

  test('sayı biçimleri', () {
    expect(netText(78.5), '78,5');
    expect(numText(1069), '1.069');
    expect(percent(0.756), '%76');
    expect(percent(null), '—');
  });
}
