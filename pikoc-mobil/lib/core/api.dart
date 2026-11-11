import 'dart:async';

import 'package:dio/dio.dart';

/// Sunucu adresi: varsayılan canlı site; geliştirmede
/// `--dart-define=API_BASE_URL=http://localhost:3000/api/mobil/v1` (adb reverse ile).
class AppConfig {
  AppConfig._();

  static const apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'https://pikampus.com/api/mobil/v1');

  /// Sitenin kökü (koç panelini tarayıcıda açmak için)
  static String get siteUrl => apiBaseUrl.replaceFirst(RegExp(r'/api/mobil/v1/?$'), '');
}

/// Sunucunun ortak hata biçimi: `{ error: { code, message, fields? } }`; mesaj kullanıcıya olduğu gibi gösterilir.
class ApiException implements Exception {
  const ApiException(this.code, this.message, {this.status, this.fields = const {}});

  final String code;
  final String message;
  final int? status;
  final Map<String, String> fields;

  bool get isOffline => code == 'NETWORK' || code == 'TIMEOUT';

  factory ApiException.fromResponse(int? status, Object? data) {
    if (data is Map && data['error'] is Map) {
      final error = data['error'] as Map;
      final fields = <String, String>{};
      if (error['fields'] is Map) {
        (error['fields'] as Map).forEach((key, value) {
          if (value != null) fields[key.toString()] = value.toString();
        });
      }
      return ApiException(
        (error['code'] ?? 'INTERNAL').toString(),
        (error['message'] ?? 'Beklenmeyen bir hata oluştu.').toString(),
        status: status,
        fields: fields,
      );
    }
    if (status == 404) return ApiException('NOT_FOUND', 'Aradığınız kayıt bulunamadı.', status: status);
    if (status != null && status >= 500) {
      return ApiException('INTERNAL', 'Sunucuda geçici bir sorun var. Lütfen biraz sonra tekrar deneyin.', status: status);
    }
    return ApiException('INTERNAL', 'Beklenmeyen bir hata oluştu.', status: status);
  }

  @override
  String toString() => message;
}

/// Hata nesnesinden kullanıcıya gösterilecek metin.
String errorText(Object error) => error is ApiException ? error.message : 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';

typedef Json = Map<String, dynamic>;

/// Mobil API istemcisi. Her istekte `Authorization: Bearer` eklenir; hatalar [ApiException] olarak fırlatılır.
class ApiClient {
  ApiClient({String? baseUrl})
      : _dio = Dio(
          BaseOptions(
            baseUrl: baseUrl ?? AppConfig.apiBaseUrl,
            connectTimeout: const Duration(seconds: 15),
            receiveTimeout: const Duration(seconds: 30),
            headers: {'Accept': 'application/json'},
          ),
        ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (token != null) options.headers['Authorization'] = 'Bearer $token';
          handler.next(options);
        },
      ),
    );
  }

  final Dio _dio;
  String? token;

  /// Oturum düştüğünde (401) ya da şifre değişikliği gerektiğinde oturum yöneticisi dinler.
  final events = StreamController<String>.broadcast();

  Future<Json> get(String path, {Map<String, dynamic>? query}) => _send(() => _dio.get<Object?>(path, queryParameters: query));
  Future<Json> post(String path, [Object? data]) => _send(() => _dio.post<Object?>(path, data: data ?? const <String, dynamic>{}));
  Future<Json> patch(String path, Object data) => _send(() => _dio.patch<Object?>(path, data: data));
  Future<Json> delete(String path) => _send(() => _dio.delete<Object?>(path));

  Future<Json> _send(Future<Response<Object?>> Function() request) async {
    try {
      final response = await request();
      final data = response.data;
      return data is Map<String, dynamic> ? data : <String, dynamic>{};
    } on DioException catch (error) {
      throw _map(error);
    }
  }

  ApiException _map(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const ApiException('TIMEOUT', 'Sunucu zamanında yanıt vermedi. İnternet bağlantınızı kontrol edip tekrar deneyin.');
      case DioExceptionType.connectionError:
        return const ApiException('NETWORK', 'İnternet bağlantısı yok gibi görünüyor. Bağlantınızı kontrol edip tekrar deneyin.');
      default:
        final response = error.response;
        if (response == null) return const ApiException('NETWORK', 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.');
        final exception = ApiException.fromResponse(response.statusCode, response.data);
        if (token != null && (exception.code == 'UNAUTHENTICATED' || exception.code == 'PASSWORD_CHANGE_REQUIRED' || exception.code == 'ACCOUNT_SUSPENDED')) {
          events.add(exception.code);
        }
        return exception;
    }
  }
}

/// JSON alanlarını güvenle okumak için kısa yardımcılar.
extension JsonRead on Json {
  String str(String key, [String fallback = '']) => this[key]?.toString() ?? fallback;
  String? strOrNull(String key) => this[key]?.toString();
  int integer(String key, [int fallback = 0]) => (this[key] as num?)?.toInt() ?? fallback;
  int? intOrNull(String key) => (this[key] as num?)?.toInt();
  double? numOrNull(String key) => (this[key] as num?)?.toDouble();
  bool flag(String key) => this[key] == true;
  Json obj(String key) => (this[key] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
  Json? objOrNull(String key) => (this[key] as Map?)?.cast<String, dynamic>();
  List<Json> list(String key) => ((this[key] as List?) ?? const []).whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
  List<String> strings(String key) => ((this[key] as List?) ?? const []).map((e) => e.toString()).toList();
}
