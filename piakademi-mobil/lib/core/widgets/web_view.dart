import 'package:flutter/foundation.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

/// Site, user-agent'ta bunu görünce menü, alt bilgi ve çerez bandını gizler (uygulama görünümü).
const appUserAgentMarker = 'PiKampusApp/1.0';

/// Ödeme, sanal sınıf ve yasal sayfalar için ortak WebView ayarları.
///
/// * JavaScript açık, medya kullanıcı dokunuşu beklemeden oynar (sanal sınıf sesi/görüntüsü).
/// * Sayfanın kamera/mikrofon isteği uygulama izni verildiyse onaylanır.
/// * Android'de 3D Secure formları için üçüncü taraf çerezlere izin verilir.
/// * User-agent'a [appUserAgentMarker] eklenir (bankaların tanıdığı tarayıcı kimliği korunur).
Future<WebViewController> createAppWebView({
  required NavigationDelegate delegate,
  bool media = false,
}) async {
  late final PlatformWebViewControllerCreationParams params;
  if (!kIsWeb && WebViewPlatform.instance is WebKitWebViewPlatform) {
    params = WebKitWebViewControllerCreationParams(
      allowsInlineMediaPlayback: true,
      mediaTypesRequiringUserAction: const <PlaybackMediaTypes>{},
    );
  } else {
    params = const PlatformWebViewControllerCreationParams();
  }

  final controller = WebViewController.fromPlatformCreationParams(
    params,
    onPermissionRequest: media ? (request) => request.grant() : null,
  );
  await controller.setJavaScriptMode(JavaScriptMode.unrestricted);
  await controller.setNavigationDelegate(delegate);

  final platform = controller.platform;
  if (platform is AndroidWebViewController) {
    await platform.setMediaPlaybackRequiresUserGesture(false);
    await AndroidWebViewCookieManager(const PlatformWebViewCookieManagerCreationParams()).setAcceptThirdPartyCookies(platform, true);
  }
  if (platform is WebKitWebViewController) {
    await platform.setAllowsBackForwardNavigationGestures(false);
  }
  try {
    final agent = await controller.getUserAgent();
    if (agent != null && !agent.contains('PiKampusApp')) await controller.setUserAgent('$agent $appUserAgentMarker');
  } catch (_) {
    // Kimlik okunamazsa sayfa yine açılır; yalnızca site menüsü görünür kalır.
  }
  return controller;
}
