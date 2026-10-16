// Sunucudan gelen JSON'u güvenle okumak için yardımcılar. Eksik ya da beklenmeyen tipteki
// alanlar uygulamayı çökertmez; varsayılan değer kullanılır.

typedef Json = Map<String, dynamic>;

Json asJson(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return value.map((key, v) => MapEntry(key.toString(), v));
  return const {};
}

Json? asJsonOrNull(Object? value) => value is Map ? asJson(value) : null;

List<T> asList<T>(Object? value, T Function(Json json) parse) {
  if (value is! List) return const [];
  return value.whereType<Map>().map((item) => parse(asJson(item))).toList(growable: false);
}

List<String> asStringList(Object? value) {
  if (value is! List) return const [];
  return value.where((item) => item != null).map((item) => item.toString()).toList(growable: false);
}

String asString(Object? value, [String fallback = '']) {
  if (value == null) return fallback;
  return value.toString();
}

String? asStringOrNull(Object? value) {
  if (value == null) return null;
  final text = value.toString();
  return text.isEmpty ? null : text;
}

int asInt(Object? value, [int fallback = 0]) {
  if (value is int) return value;
  if (value is num) return value.round();
  if (value is String) return int.tryParse(value) ?? num.tryParse(value)?.round() ?? fallback;
  return fallback;
}

int? asIntOrNull(Object? value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.round();
  if (value is String) return int.tryParse(value);
  return null;
}

double asDouble(Object? value, [double fallback = 0]) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

double? asDoubleOrNull(Object? value) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}

bool asBool(Object? value, [bool fallback = false]) {
  if (value is bool) return value;
  if (value is num) return value != 0;
  if (value is String) return value == 'true' || value == '1';
  return fallback;
}

/// ISO 8601 anı (UTC olarak saklanır).
DateTime? asDate(Object? value) {
  if (value is! String || value.isEmpty) return null;
  return DateTime.tryParse(value)?.toUtc();
}

DateTime asDateOr(Object? value, DateTime fallback) => asDate(value) ?? fallback;
