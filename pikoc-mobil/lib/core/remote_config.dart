import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';

/// Sitenin uygulamaya verdiği açılış ayarları (`GET /ayarlar`): sürüm, iletişim, duyuru, paketler, site sayfaları.
/// Metin, fiyat ve sınırlar uygulamaya gömülmez; sitede değişince bir sonraki açılışta günceli gelir.
/// Bağlantı yoksa son alınan ayar kullanılır.
class RemoteConfig {
  const RemoteConfig(this.data);

  final Json data;

  static const _cacheKey = 'pk_remote_config';

  Json get _app => (data['app'] as Map?)?.cast<String, dynamic>() ?? const {};
  Json get _site => (data['site'] as Map?)?.cast<String, dynamic>() ?? const {};
  Json get _koc => (data['piKoc'] as Map?)?.cast<String, dynamic>() ?? const {};

  String get appName => (_app['name'] as String?) ?? 'Pi Kampüs';
  String get minVersion => (_app['minVersion'] as String?) ?? '0.0.0';
  String get latestVersion => (_app['latestVersion'] as String?) ?? '0.0.0';
  String? get androidStoreUrl => (_app['store'] as Map?)?['android'] as String?;
  String? get iosStoreUrl => (_app['store'] as Map?)?['ios'] as String?;

  String get siteUrl => (_site['url'] as String?) ?? AppConfig.siteUrl;
  String? get contactEmail => _site['contactEmail'] as String?;
  String? get contactPhone => _site['contactPhone'] as String?;
  String? get whatsapp => _site['whatsapp'] as String?;

  String? get announcement => data['announcement'] as String?;
  bool get maintenance => (data['maintenance'] as Map?)?['on'] == true;
  String? get maintenanceMessage => (data['maintenance'] as Map?)?['message'] as String?;

  Json get freePlan => (_koc['free'] as Map?)?.cast<String, dynamic>() ?? const {};
  List<Json> get tiers => ((_koc['tiers'] as List?) ?? const []).whereType<Map>().map((m) => m.cast<String, dynamic>()).toList();
  List<Json> get features => ((_koc['features'] as List?) ?? const []).whereType<Map>().map((m) => m.cast<String, dynamic>()).toList();

  /// Uygulama içinde site sayfası olarak açılanlar: { key, title, path, url, auth }
  List<Json> get pages => ((data['pages'] as List?) ?? const []).whereType<Map>().map((m) => m.cast<String, dynamic>()).toList();

  Json? page(String key) {
    for (final p in pages) {
      if (p['key'] == key) return p;
    }
    return null;
  }

  /// Sunucudan alır; olmazsa son kaydedilen ayarı döndürür (hiç yoksa boş ayar).
  static Future<RemoteConfig> load(ApiClient api) async {
    final prefs = await SharedPreferences.getInstance();
    try {
      final data = await api.get('/ayarlar');
      if (data.isNotEmpty) {
        await prefs.setString(_cacheKey, jsonEncode(data));
        return RemoteConfig(data);
      }
    } catch (_) {
      // Çevrimdışı: son ayarla devam edilir
    }
    final cached = prefs.getString(_cacheKey);
    if (cached != null) {
      try {
        return RemoteConfig((jsonDecode(cached) as Map).cast<String, dynamic>());
      } catch (_) {}
    }
    return const RemoteConfig({});
  }
}

/// "1.2.10" > "1.2.9" karşılaştırması; geçersiz parça 0 sayılır.
int compareVersions(String a, String b) {
  // "1.0.0+5" gibi derleme numarası karşılaştırmaya girmez
  List<int> parts(String v) => v.split('+').first.split('.').map((p) => int.tryParse(p.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0).toList();
  final x = parts(a), y = parts(b);
  for (var i = 0; i < 3; i++) {
    final d = (i < x.length ? x[i] : 0) - (i < y.length ? y[i] : 0);
    if (d != 0) return d.sign;
  }
  return 0;
}

/// Uygulamanın kendi sürümü (pubspec'teki `version`, ör. 1.0.0)
Future<String> currentAppVersion() async {
  try {
    return (await PackageInfo.fromPlatform()).version;
  } catch (_) {
    return '0.0.0';
  }
}

/// Ayarı ağaçta paylaşır: `ConfigScope.of(context)`.
class ConfigScope extends InheritedWidget {
  const ConfigScope({super.key, required this.config, required this.version, required super.child});

  final RemoteConfig config;
  final String version;

  static RemoteConfig of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<ConfigScope>()?.config ?? const RemoteConfig({});
  static String versionOf(BuildContext context) => context.dependOnInheritedWidgetOfExactType<ConfigScope>()?.version ?? '0.0.0';

  @override
  bool updateShouldNotify(ConfigScope oldWidget) => !identical(config, oldWidget.config) || version != oldWidget.version;
}
