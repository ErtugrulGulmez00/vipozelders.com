import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Oturum anahtarının saklandığı yer (testlerde bellek içi sürüm kullanılır).
abstract class KeyValueStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class SecureKeyValueStore implements KeyValueStore {
  SecureKeyValueStore() : _storage = const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) async {
    try {
      return await _storage.read(key: key);
    } catch (_) {
      // Anahtar deposu bozulduysa (ör. uygulama yedekten geri yüklendi) temiz oturumla devam edilir.
      return null;
    }
  }

  @override
  Future<void> write(String key, String value) => _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) async {
    try {
      await _storage.delete(key: key);
    } catch (_) {}
  }
}

class MemoryKeyValueStore implements KeyValueStore {
  final Map<String, String> values = {};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String value) async => values[key] = value;

  @override
  Future<void> delete(String key) async => values.remove(key);
}

/// Bearer anahtarını bellekte tutar ve güvenli depoya yazar.
class TokenStore {
  TokenStore(this._store);

  static const _key = 'pk_session_token';
  static const _pushKey = 'pk_push_token';
  static const _viewKey = 'pk_view';

  final KeyValueStore _store;
  String? _token;

  String? get token => _token;
  bool get hasToken => _token != null && _token!.isNotEmpty;

  Future<String?> load() async {
    _token = await _store.read(_key);
    return _token;
  }

  Future<void> save(String token) async {
    _token = token;
    await _store.write(_key, token);
  }

  Future<void> clear() async {
    _token = null;
    await _store.delete(_key);
  }

  /// Bu cihazın son kaydedilen push (FCM) anahtarı; çıkışta sunucudan silinir.
  Future<String?> pushToken() => _store.read(_pushKey);
  Future<void> savePushToken(String token) => _store.write(_pushKey, token);
  Future<void> clearPushToken() => _store.delete(_pushKey);

  /// Son açılan taraf (kurum / özel ders görünümü); açılışta aynı taraf açılır.
  Future<String?> viewPreference() => _store.read(_viewKey);
  Future<void> saveViewPreference(String view) => _store.write(_viewKey, view);
  Future<void> clearViewPreference() => _store.delete(_viewKey);
}
