/// Türkçe büyük harf (i → İ, ı → I).
String trUpper(String value) => value.replaceAll('i', 'İ').replaceAll('ı', 'I').toUpperCase();

/// Türkçe küçük harf (I → ı, İ → i).
String trLower(String value) => value.replaceAll('I', 'ı').replaceAll('İ', 'i').toLowerCase();

/// Arama için sadeleştirme: küçük harf, Türkçe karakterler ASCII.
String searchKey(String value) => trLower(value)
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u')
    .trim();

/// "Ayşe Yılmaz" → "AY"
String initialsOf(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return '?';
  final first = String.fromCharCode(parts.first.runes.first);
  final last = parts.length > 1 ? String.fromCharCode(parts.last.runes.first) : '';
  return trUpper('$first$last');
}

/// 05321112233 → 0532 111 22 33
String formatPhone(String? phone) {
  if (phone == null || phone.isEmpty) return '';
  final digits = phone.replaceAll(RegExp(r'\D'), '');
  if (digits.length == 11 && digits.startsWith('0')) {
    return '${digits.substring(0, 4)} ${digits.substring(4, 7)} ${digits.substring(7, 9)} ${digits.substring(9)}';
  }
  return phone;
}
