import 'package:file_selector/file_selector.dart';
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
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
    // Android WebView sayfadaki "dosya seç" alanını kendisi açmaz (profil fotoğrafı, belge, soru yükleme).
    await platform.setOnShowFileSelector(_pickFilesForPage);
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

/// Sayfanın `<input type="file">` isteği: yalnızca görsel isteniyorsa galeri/kamera, değilse dosya seçici.
Future<List<String>> _pickFilesForPage(FileSelectorParams params) async {
  final types = params.acceptTypes.map((t) => t.trim()).where((t) => t.isNotEmpty).toList();
  final mimeTypes = types.where((t) => t.contains('/')).toList();
  final extensions = types.where((t) => t.startsWith('.')).map((t) => t.substring(1)).toList();
  try {
    if (mimeTypes.isNotEmpty && extensions.isEmpty && mimeTypes.every((t) => t.startsWith('image/'))) {
      final picked = await ImagePicker().pickImage(
        source: params.isCaptureEnabled ? ImageSource.camera : ImageSource.gallery,
        maxWidth: 2400,
        imageQuality: 88,
      );
      return picked == null ? const [] : [Uri.file(picked.path).toString()];
    }
    final groups = types.isEmpty ? const <XTypeGroup>[] : [XTypeGroup(label: 'Dosya', mimeTypes: mimeTypes, extensions: extensions)];
    if (params.mode == FileSelectorMode.openMultiple) {
      final files = await openFiles(acceptedTypeGroups: groups);
      return files.map((f) => Uri.file(f.path).toString()).toList();
    }
    final file = await openFile(acceptedTypeGroups: groups);
    return file == null ? const [] : [Uri.file(file.path).toString()];
  } catch (error) {
    debugPrint('Dosya seçilemedi: $error');
    return const [];
  }
}
