import 'package:flutter_test/flutter_test.dart';
import 'package:pikampus/core/format/dates.dart';
import 'package:pikampus/core/format/money.dart';
import 'package:pikampus/core/format/text.dart';

void main() {
  group('para', () {
    test('kuruş → sitedeki biçim', () {
      expect(formatMoney(125000), '₺1.250');
      expect(formatMoney(125050), '₺1.250,50');
      expect(formatMoney(60000), '₺600');
      expect(formatMoney(12750), '₺127,50');
      expect(formatMoney(0), '₺0');
      expect(formatMoney(100000000), '₺1.000.000');
      expect(formatMoney(-4500), '-₺45');
    });

    test('TL girişi', () {
      expect(parseLira('1.250'), 1250);
      expect(parseLira('1250'), 1250);
      expect(parseLira('₺ 900'), 900);
      expect(parseLira('1250,50'), 1251);
      expect(parseLira(''), isNull);
      expect(parseLira('abc'), isNull);
    });

    test('net ve yüzde', () {
      expect(formatNet(86.01), '86,01');
      expect(formatNet(20), '20');
      expect(formatNet(8.666), '8,67');
      expect(formatNet(null), '—');
      expect(formatPercent(0.734), '%73');
    });
  });

  group('tarih (İstanbul saati)', () {
    final start = DateTime.utc(2026, 10, 17, 8); // 11:00 İstanbul
    final end = DateTime.utc(2026, 10, 17, 9);

    test('saat ve gün UTC+3 gösterilir', () {
      expect(formatTime(start), '11:00');
      expect(formatDate(start), '17 Ekim 2026');
      expect(formatDateTime(start), '17 Ekim 2026 Cumartesi 11:00');
      expect(formatCompact(start), '17.10.2026 11:00');
      expect(dateString(DateTime.utc(2026, 10, 16, 22)), '2026-10-17');
    });

    test('ders aralığı (bu yıl ise yıl yazılmaz)', () {
      expect(formatLessonRange(start, end, now: DateTime.utc(2026, 10, 16)), '17 Ekim Cumartesi · 11:00–12:00');
      expect(formatLessonRange(start, end, now: DateTime.utc(2025, 1, 1)), '17 Ekim 2026 Cumartesi · 11:00–12:00');
    });

    test('süreler', () {
      expect(durationLabel(45), '45 dk');
      expect(durationLabel(60), '1 saat');
      expect(durationLabel(90), '1 saat 30 dk');
      expect(formatDuration(const Duration(hours: 11, minutes: 52)), '11 saat 52 dakika');
      expect(formatDuration(const Duration(days: 2, hours: 3, minutes: 10)), '2 gün 3 saat');
      expect(formatDuration(Duration.zero), '1 dakikadan az');
      expect(formatCountdown(const Duration(minutes: 5, seconds: 7)), '05:07');
      expect(formatCountdown(const Duration(hours: 1, minutes: 2, seconds: 3)), '01:02:03');
    });

    test('günler', () {
      expect(addDays('2026-10-31', 1), '2026-11-01');
      expect(isoWeekday('2026-10-16'), 5);
      expect(weekStartOf('2026-10-18'), '2026-10-12');
      expect(formatDayLong('2026-10-16'), '16 Ekim 2026');
      expect(formatDayWithWeekday('2026-10-16'), 'Cum 16.10');
      expect(minutesToTime(1010), '16:50');
      expect(timeToMinutes('18:30'), 1110);
      expect(timeToMinutes('25:00'), isNull);
    });

    test('göreli zaman', () {
      final now = DateTime.utc(2026, 10, 16, 9);
      expect(formatRelative(now.subtract(const Duration(seconds: 20)), now: now), 'az önce');
      expect(formatRelative(now.subtract(const Duration(minutes: 5)), now: now), '5 dk önce');
      expect(formatRelative(now.subtract(const Duration(hours: 3)), now: now), '3 saat önce');
      expect(formatRelative(DateTime.utc(2026, 10, 15, 20, 10), now: now), 'dün 23:10');
      expect(formatRelative(DateTime.utc(2026, 9, 1, 9), now: now), '1 Eyl');
    });
  });

  group('metin', () {
    test('Türkçe büyük harf ve baş harfler', () {
      expect(trUpper('istanbul'), 'İSTANBUL');
      expect(initialsOf('ayşe yılmaz'), 'AY');
      expect(initialsOf('ıhlamur'), 'I');
      expect(searchKey('Çağrı Öztürk'), 'cagri ozturk');
      expect(formatPhone('05321112233'), '0532 111 22 33');
    });
  });
}
