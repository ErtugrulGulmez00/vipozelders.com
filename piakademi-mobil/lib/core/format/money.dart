/// Kuruş → "₺1.250" ya da "₺1.250,50" (sitedeki biçimle aynı).
String formatMoney(int kurus) {
  final negative = kurus < 0;
  final abs = kurus.abs();
  final lira = abs ~/ 100;
  final cents = abs % 100;
  final grouped = _group(lira);
  final text = cents == 0 ? '₺$grouped' : '₺$grouped,${cents.toString().padLeft(2, '0')}';
  return negative ? '-$text' : text;
}

String? formatMoneyOrNull(int? kurus) => kurus == null ? null : formatMoney(kurus);

String _group(int value) {
  final digits = value.toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write('.');
    buffer.write(digits[i]);
  }
  return buffer.toString();
}

/// Kullanıcının yazdığı TL tutarını sayıya çevirir: "1.250", "1250", "1250,50" → 1250 (TL, tam sayı).
int? parseLira(String value) {
  final cleaned = value.trim().replaceAll(RegExp(r'\s|₺|tl|TL'), '');
  if (cleaned.isEmpty) return null;
  final normalized = cleaned.contains(',') ? cleaned.replaceAll('.', '').replaceAll(',', '.') : cleaned.replaceAll('.', '');
  final number = double.tryParse(normalized);
  if (number == null || number < 0) return null;
  return number.round();
}

/// 0.734 → "%73"
String formatPercent(double rate) => '%${(rate * 100).round()}';

/// Net: 86.0 → "86", 86.25 → "86,25"
String formatNet(num? net) {
  if (net == null) return '—';
  final rounded = (net * 100).round() / 100;
  if (rounded == rounded.roundToDouble()) return rounded.round().toString();
  return rounded.toStringAsFixed(2).replaceAll(RegExp(r'0+$'), '').replaceAll('.', ',');
}
