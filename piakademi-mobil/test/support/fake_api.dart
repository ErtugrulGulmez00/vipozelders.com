import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pikampus/core/api/api_client.dart';
import 'package:pikampus/core/auth/token_store.dart';
import 'package:pikampus/core/providers.dart';

import 'fixtures.dart';

class FakeResponse {
  const FakeResponse(this.body, {this.status = 200});

  final Object? body;
  final int status;
}

typedef FakeHandler = FakeResponse Function(RequestOptions request);

class _Route {
  _Route(this.method, this.pattern, this.handler);

  final String method;
  final RegExp pattern;
  final FakeHandler handler;
}

/// Sahte mobil API: istekleri yol desenine göre yanıtlar, yapılan istekleri kaydeder.
class FakeApi implements HttpClientAdapter {
  final _routes = <_Route>[];
  final requests = <RequestOptions>[];

  /// [path] `/api/mobil/v1` sonrası kısım için düzenli ifade (ör. `/rezervasyonlar/[^/]+`).
  void on(String method, String path, FakeHandler handler) => _routes.insert(0, _Route(method, RegExp('^$path\$'), handler));

  void json(String method, String path, Object? body, {int status = 200}) => on(method, path, (_) => FakeResponse(body, status: status));

  List<RequestOptions> calls(String method, String path) {
    final pattern = RegExp('^$path\$');
    return requests.where((r) => r.method == method && pattern.hasMatch(_path(r))).toList();
  }

  static String _path(RequestOptions r) => r.uri.path.replaceFirst('/api/mobil/v1', '');

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    if (requestStream != null) await requestStream.drain<void>();
    requests.add(options);
    final path = _path(options);
    for (final route in _routes) {
      if (route.method == options.method && route.pattern.hasMatch(path)) {
        final response = route.handler(options);
        if (response.status == 204) return ResponseBody.fromString('', 204);
        return ResponseBody.fromString(
          jsonEncode(response.body),
          response.status,
          headers: {
            Headers.contentTypeHeader: [Headers.jsonContentType],
          },
        );
      }
    }
    return ResponseBody.fromString(
      jsonEncode({
        'error': {'code': 'NOT_FOUND', 'message': 'Sahte API: ${options.method} $path tanımlı değil.'},
      }),
      404,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}

  /// Herkese açık uçlar (katalog, öğretmen listesi, profil, saatler).
  void withPublicData() {
    json('GET', '/katalog', catalogJson());
    json('GET', '/ogretmenler', {
      'items': [teacherCardJson()],
      'total': 1,
      'page': 1,
      'pageCount': 1,
    });
    json('GET', '/ogretmenler/ayse-yilmaz', teacherProfileJson());
    on('GET', '/ogretmenler/ayse-yilmaz/saatler', (_) => FakeResponse(slotsJson(DateTime.now().toUtc())));
  }
}

/// Uygulamayı sahte API ve bellek içi oturum deposuyla çalıştırmak için sağlayıcı değişiklikleri.
List<Override> fakeOverrides(FakeApi api, {MemoryKeyValueStore? store}) {
  final keyValue = store ?? MemoryKeyValueStore();
  return [
    keyValueStoreProvider.overrideWithValue(keyValue),
    apiClientProvider.overrideWith((ref) {
      final dio = Dio(BaseOptions(baseUrl: '$fakeBase/api/mobil/v1', responseType: ResponseType.json))..httpClientAdapter = api;
      final client = ApiClient(tokens: ref.watch(tokenStoreProvider), dio: dio);
      ref.onDispose(client.dispose);
      return client;
    }),
  ];
}
