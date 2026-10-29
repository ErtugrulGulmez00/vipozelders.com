import 'dart:async';

import 'package:dio/dio.dart';

import '../auth/token_store.dart';
import '../config.dart';
import 'api_exception.dart';

/// Oturum durumunu etkileyen sunucu yanıtları (oturum yöneticisi dinler).
enum AuthEvent { unauthenticated, passwordChangeRequired, accountBlocked }

/// Mobil API istemcisi. Her istekte `Authorization: Bearer` eklenir; hatalar [ApiException] olarak fırlatılır.
class ApiClient {
  ApiClient({required this.tokens, Dio? dio, String? baseUrl})
      : _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: baseUrl ?? AppConfig.apiBaseUrl,
                connectTimeout: const Duration(seconds: 15),
                receiveTimeout: const Duration(seconds: 30),
                sendTimeout: const Duration(seconds: 120),
                headers: {'Accept': 'application/json'},
                responseType: ResponseType.json,
              ),
            ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = tokens.token;
          if (token != null && !options.headers.containsKey('Authorization')) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  final TokenStore tokens;
  final Dio _dio;
  final _events = StreamController<AuthEvent>.broadcast();

  Stream<AuthEvent> get events => _events.stream;
  Dio get dio => _dio;
  String get baseUrl => _dio.options.baseUrl;

  /// Özel dosyalar (soru fotoğrafı, çözüm videosu) için başlık.
  Map<String, String> get authHeaders {
    final token = tokens.token;
    return token == null ? const {} : {'Authorization': 'Bearer $token'};
  }

  Future<T> get<T>(String path, {Map<String, dynamic>? query}) =>
      _send<T>(() => _dio.get<Object?>(path, queryParameters: _clean(query)));

  Future<T> post<T>(String path, {Object? data, Map<String, dynamic>? query}) =>
      _send<T>(() => _dio.post<Object?>(path, data: data ?? const <String, dynamic>{}, queryParameters: _clean(query)));

  Future<T> put<T>(String path, {Object? data}) => _send<T>(() => _dio.put<Object?>(path, data: data));

  Future<T> patch<T>(String path, {Object? data}) => _send<T>(() => _dio.patch<Object?>(path, data: data));

  Future<T> delete<T>(String path, {Map<String, dynamic>? query}) =>
      _send<T>(() => _dio.delete<Object?>(path, queryParameters: _clean(query)));

  /// Fotoğraf/video yükleme (multipart/form-data).
  Future<T> postMultipart<T>(String path, FormData form, {void Function(int sent, int total)? onProgress}) =>
      _send<T>(() => _dio.post<Object?>(path, data: form, onSendProgress: onProgress));

  Map<String, dynamic>? _clean(Map<String, dynamic>? query) {
    if (query == null) return null;
    final result = <String, dynamic>{};
    query.forEach((key, value) {
      if (value == null) return;
      if (value is String && value.isEmpty) return;
      result[key] = value;
    });
    return result;
  }

  Future<T> _send<T>(Future<Response<Object?>> Function() request) async {
    try {
      final response = await request();
      return response.data as T;
    } on DioException catch (error) {
      throw _map(error);
    }
  }

  ApiException _map(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
        return const ApiException(
          code: ApiException.timeout,
          message: 'Sunucu zamanında yanıt vermedi. İnternet bağlantınızı kontrol edip tekrar deneyin.',
        );
      case DioExceptionType.connectionError:
        return const ApiException(
          code: ApiException.network,
          message: 'İnternet bağlantısı yok gibi görünüyor. Bağlantınızı kontrol edip tekrar deneyin.',
        );
      case DioExceptionType.cancel:
        return const ApiException(code: 'CANCELLED', message: 'İstek iptal edildi.');
      case DioExceptionType.badCertificate:
        return const ApiException(code: ApiException.network, message: 'Güvenli bağlantı kurulamadı.');
      case DioExceptionType.badResponse:
      case DioExceptionType.unknown:
        final response = error.response;
        if (response == null) {
          return const ApiException(
            code: ApiException.network,
            message: 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.',
          );
        }
        final exception = ApiException.fromResponse(response.statusCode, response.data);
        final sentToken = error.requestOptions.headers.containsKey('Authorization');
        if (exception.code == 'UNAUTHENTICATED' && sentToken) {
          _events.add(AuthEvent.unauthenticated);
        } else if (exception.code == 'PASSWORD_CHANGE_REQUIRED') {
          _events.add(AuthEvent.passwordChangeRequired);
        } else if (sentToken &&
            (exception.code == 'ACCOUNT_SUSPENDED' || exception.code == 'ADMIN_NOT_SUPPORTED')) {
          _events.add(AuthEvent.accountBlocked);
        }
        return exception;
    }
  }

  void dispose() => _events.close();
}
