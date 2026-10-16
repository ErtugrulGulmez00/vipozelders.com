/// Sunucunun ortak hata biçimi: `{ error: { code, message, fields? } }`.
class ApiException implements Exception {
  const ApiException({
    required this.code,
    required this.message,
    this.status,
    this.fields = const {},
    this.extra = const {},
  });

  final String code;

  /// Kullanıcıya olduğu gibi gösterilecek Türkçe metin.
  final String message;
  final int? status;

  /// Form alanı → hata metni.
  final Map<String, String> fields;

  /// Ek alanlar (ör. CLASSROOM_CLOSED için `opensAt`).
  final Map<String, dynamic> extra;

  static const network = 'NETWORK';
  static const timeout = 'TIMEOUT';

  bool get isOffline => code == network || code == timeout;
  bool get isUnauthenticated => code == 'UNAUTHENTICATED';

  String? field(String name) => fields[name];

  factory ApiException.fromResponse(int? status, Object? data) {
    if (data is Map && data['error'] is Map) {
      final error = data['error'] as Map;
      final fields = <String, String>{};
      if (error['fields'] is Map) {
        (error['fields'] as Map).forEach((key, value) {
          if (value != null) fields[key.toString()] = value.toString();
        });
      }
      final extra = <String, dynamic>{};
      error.forEach((key, value) {
        if (key != 'code' && key != 'message' && key != 'fields') extra[key.toString()] = value;
      });
      return ApiException(
        code: (error['code'] ?? 'INTERNAL').toString(),
        message: (error['message'] ?? 'Beklenmeyen bir hata oluştu.').toString(),
        status: status,
        fields: fields,
        extra: extra,
      );
    }
    if (status == 404) {
      return ApiException(code: 'NOT_FOUND', message: 'Aradığınız kayıt bulunamadı.', status: status);
    }
    if (status != null && status >= 500) {
      return ApiException(
        code: 'INTERNAL',
        message: 'Sunucuda geçici bir sorun var. Lütfen biraz sonra tekrar deneyin.',
        status: status,
      );
    }
    return ApiException(code: 'INTERNAL', message: 'Beklenmeyen bir hata oluştu.', status: status);
  }

  @override
  String toString() => 'ApiException($code, $status): $message';
}

/// Hata nesnesinden kullanıcıya gösterilecek metin.
String errorMessage(Object error) {
  if (error is ApiException) return error.message;
  return 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';
}
