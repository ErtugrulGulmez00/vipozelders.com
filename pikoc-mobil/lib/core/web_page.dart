import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

import 'api.dart';
import 'remote_config.dart';
import 'session.dart';

/// Site, user-agent'ta bunu görünce menüsünü, alt bilgisini ve çerez bandını gizler (uygulama görünümü).
const appUserAgentMarker = 'PiKampusApp/1.0';

/// Sitenin bir sayfasını uygulama içinde açar. [authPath] verilirse (ör. "/koc/abonelik") önce tek kullanımlık
/// web oturumu bağlantısı alınır; kullanıcı yeniden giriş yapmaz. Site dışı bağlantılar telefonun tarayıcısında açılır.
class WebPageScreen extends StatefulWidget {
  const WebPageScreen({super.key, required this.title, this.url, this.authPath}) : assert(url != null || authPath != null);

  final String title;
  final String? url;
  final String? authPath;

  /// Ayarlardaki sayfa anahtarıyla aç (ör. "paketler", "kvkk")
  static void openKey(BuildContext context, String key) {
    final page = ConfigScope.of(context).page(key);
    if (page == null) return;
    open(context, page);
  }

  static void open(BuildContext context, Json page) {
    final auth = page['auth'] == true;
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => WebPageScreen(title: (page['title'] as String?) ?? '', url: auth ? null : page['url'] as String?, authPath: auth ? page['path'] as String? : null),
      ),
    );
  }

  @override
  State<WebPageScreen> createState() => _WebPageScreenState();
}

class _WebPageScreenState extends State<WebPageScreen> {
  WebViewController? _controller;
  String? _error;
  int _progress = 0;
  late String _siteHost;

  @override
  void initState() {
    super.initState();
    _siteHost = Uri.parse(AppConfig.siteUrl).host;
    _start();
  }

  Future<void> _start() async {
    setState(() => _error = null);
    try {
      var url = widget.url;
      if (widget.authPath != null) {
        final res = await SessionScope.read(context).api.post('/web-oturum', {'path': widget.authPath});
        url = res['url'] as String?;
      }
      if (url == null) throw const ApiException('INTERNAL', 'Sayfa açılamadı.');
      final controller = await _create();
      await controller.loadRequest(Uri.parse(url));
      if (mounted) setState(() => _controller = controller);
    } catch (error) {
      if (mounted) setState(() => _error = errorText(error));
    }
  }

  Future<WebViewController> _create() async {
    final PlatformWebViewControllerCreationParams params = !kIsWeb && WebViewPlatform.instance is WebKitWebViewPlatform
        ? WebKitWebViewControllerCreationParams(allowsInlineMediaPlayback: true)
        : const PlatformWebViewControllerCreationParams();
    final controller = WebViewController.fromPlatformCreationParams(params);
    await controller.setJavaScriptMode(JavaScriptMode.unrestricted);
    await controller.setNavigationDelegate(
      NavigationDelegate(
        onProgress: (p) {
          if (mounted) setState(() => _progress = p);
        },
        onNavigationRequest: (request) {
          final uri = Uri.tryParse(request.url);
          // Site içi sayfalar burada; WhatsApp, telefon, e-posta ve başka siteler dışarıda açılır
          if (uri != null && (uri.scheme == 'http' || uri.scheme == 'https') && (uri.host == _siteHost || uri.host.endsWith('.$_siteHost'))) {
            return NavigationDecision.navigate;
          }
          if (uri != null) launchUrl(uri, mode: LaunchMode.externalApplication);
          return NavigationDecision.prevent;
        },
      ),
    );
    final platform = controller.platform;
    if (platform is AndroidWebViewController) {
      // Geliştirmede Chrome'dan (chrome://inspect) incelenebilsin
      if (kDebugMode) await AndroidWebViewController.enableDebugging(true);
      await AndroidWebViewCookieManager(const PlatformWebViewCookieManagerCreationParams()).setAcceptThirdPartyCookies(platform, true);
    }
    try {
      final agent = await controller.getUserAgent();
      if (agent != null && !agent.contains('PiKampusApp')) await controller.setUserAgent('$agent $appUserAgentMarker');
    } catch (_) {}
    return controller;
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final navigator = Navigator.of(context);
        if (controller != null && await controller.canGoBack()) {
          await controller.goBack();
        } else {
          navigator.pop();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.title),
          bottom: _progress > 0 && _progress < 100 ? PreferredSize(preferredSize: const Size.fromHeight(2), child: LinearProgressIndicator(value: _progress / 100, minHeight: 2)) : null,
          actions: [if (controller != null) IconButton(tooltip: 'Yenile', icon: const Icon(Icons.refresh_rounded), onPressed: controller.reload)],
        ),
        body: _error != null
            ? Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    FilledButton(onPressed: _start, child: const Text('Tekrar dene')),
                  ]),
                ),
              )
            : controller == null
                ? const Center(child: CircularProgressIndicator())
                : WebViewWidget(controller: controller),
      ),
    );
  }
}
