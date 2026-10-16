import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'config.dart';
import 'router/app_router.dart';

final deepLinksProvider = Provider<DeepLinks>((ref) {
  final links = DeepLinks(ref);
  ref.onDispose(links.dispose);
  return links;
});

/// Sitenin bağlantıları (kurum daveti, ders, öğretmen profili) uygulamada açılır.
/// Android App Links / iOS Universal Links ayarlandığında tarayıcı yerine uygulama açılır;
/// `pikampus://` şeması her zaman çalışır.
class DeepLinks {
  DeepLinks(this._ref);

  final Ref _ref;
  StreamSubscription<Uri>? _sub;

  void start() {
    if (kIsWeb) return;
    try {
      _sub = AppLinks().uriLinkStream.listen(open, onError: (_) {});
    } catch (error) {
      debugPrint('Bağlantı dinleyicisi başlatılamadı: $error');
    }
  }

  /// Bağlantıyı uygulama içi adrese çevirip açar.
  void open(Uri uri) {
    final location = locationFor(uri);
    if (location == null) return;
    Future<void>.delayed(const Duration(milliseconds: 200), () => _ref.read(routerProvider).push(location));
  }

  static String? locationFor(Uri uri) {
    final isApp = uri.scheme == 'pikampus';
    final isSite = (uri.scheme == 'https' || uri.scheme == 'http') && (uri.host == AppConfig.siteHost || uri.host == 'www.${AppConfig.siteHost}');
    if (!isApp && !isSite) return null;
    // pikampus://kurum-davet/abc → host "kurum-davet", path "/abc"
    final path = isApp ? '/${uri.host}${uri.path}' : uri.path;
    final normalized = Uri(path: path.isEmpty ? '/' : path, queryParameters: uri.queryParameters.isEmpty ? null : uri.queryParameters);
    final mapped = mapWebPath(normalized);
    if (mapped != null) return mapped;
    if (RegExp(r'^/(kurum-davet|ogretmen|ogretmenler|ders|kurum)(/|$)').hasMatch(normalized.path)) return normalized.toString();
    return null;
  }

  void dispose() => _sub?.cancel();
}
