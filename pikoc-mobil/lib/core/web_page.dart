import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

import 'api.dart';
import 'file_download.dart';
import 'remote_config.dart';
import 'session.dart';

/// Site, user-agent'ta bunu görünce menüsünü, alt bilgisini ve çerez bandını gizler (uygulama görünümü).
const appUserAgentMarker = 'PiKampusApp/1.0';

/// Sitenin bir sayfası (uygulamanın içinde). [authPath] verilirse (ör. "/koc/abonelik", "/kurum") önce tek kullanımlık
/// web oturumu bağlantısı alınır; kullanıcı yeniden giriş yapmaz. Site dışı bağlantılar telefonun tarayıcısında açılır.
class WebPanel extends StatefulWidget {
  const WebPanel({super.key, this.url, this.authPath, this.loadUrl}) : assert(url != null || authPath != null || loadUrl != null);

  final String? url;
  final String? authPath;

  /// Bağlantıyı uygulama kendisi alır (ör. görüşme tahtası için ayrı API ucu)
  final Future<String?> Function()? loadUrl;

  @override
  State<WebPanel> createState() => WebPanelState();
}

class WebPanelState extends State<WebPanel> {
  WebViewController? _controller;
  String? _error;
  int _progress = 0;
  late final String _siteHost = Uri.parse(AppConfig.siteUrl).host;

  @override
  void initState() {
    super.initState();
    _start();
  }

  /// Sayfa içinde geri gidebildiyse true (Android geri tuşu önce sayfada geri gider)
  Future<bool> goBack() async {
    final c = _controller;
    if (c != null && await c.canGoBack()) {
      await c.goBack();
      return true;
    }
    return false;
  }

  Future<void> reload() async {
    if (_controller == null) return _start();
    await _controller!.reload();
  }

  Future<void> _start() async {
    setState(() => _error = null);
    try {
      var url = widget.url;
      if (widget.loadUrl != null) {
        url = await widget.loadUrl!();
      } else if (widget.authPath != null) {
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
          final internal = uri != null && (uri.scheme == 'http' || uri.scheme == 'https') && (uri.host == _siteHost || uri.host.endsWith('.$_siteHost'));
          // Kurumun paylaştığı dosya: web görünümü indiremez; uygulama oturum anahtarıyla indirip açar
          if (internal && uri.host == _siteHost && uri.path.startsWith('/api/kurum/dosya/')) {
            openRemoteFile(context, uri.replace(queryParameters: const {}).toString().replaceFirst(RegExp(r'\?$'), ''));
            return NavigationDecision.prevent;
          }
          if (internal) {
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
      // Sayfadaki dosya seçme düğmeleri (tahtaya PDF/fotoğraf, kurum dosyaları): Android web görünümü bunu kendisi açmaz
      await platform.setOnShowFileSelector(_pickFiles);
    }
    try {
      final agent = await controller.getUserAgent();
      if (agent != null && !agent.contains('PiKampusApp')) await controller.setUserAgent('$agent $appUserAgentMarker');
    } catch (_) {}
    return controller;
  }

  /// Sistemin dosya seçicisi (izin gerekmez); seçilen dosyalar uygulamanın geçici klasörüne kopyalanıp sayfaya verilir.
  Future<List<String>> _pickFiles(FileSelectorParams params) async {
    final accept = params.acceptTypes.join(',').toLowerCase();
    final imagesOnly = accept.isNotEmpty && accept.split(',').every((t) => t.trim().startsWith('image/') || t.trim().isEmpty);
    final type = imagesOnly ? FileType.image : FileType.any;
    try {
      if (params.mode == FileSelectorMode.openMultiple) {
        final files = await FilePicker.pickFiles(type: type);
        return [for (final f in files) f.uri.toString()];
      }
      final file = await FilePicker.pickFile(type: type);
      return file == null ? const [] : [file.uri.toString()];
    } catch (_) {
      return const [];
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(onPressed: _start, child: const Text('Tekrar dene')),
          ]),
        ),
      );
    }
    if (controller == null) return const Center(child: CircularProgressIndicator());
    return Stack(children: [
      WebViewWidget(controller: controller),
      if (_progress > 0 && _progress < 100) Positioned(top: 0, left: 0, right: 0, child: LinearProgressIndicator(value: _progress / 100, minHeight: 2)),
    ]);
  }
}

/// Sitenin sayfasını geri tuşlu ayrı bir ekranda açar.
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

  /// Oturum açık bir site sayfası (ör. "/ogretmen-paneli/profil")
  static void openPath(BuildContext context, String title, String path) {
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => WebPageScreen(title: title, authPath: path)));
  }

  @override
  State<WebPageScreen> createState() => _WebPageScreenState();
}

class _WebPageScreenState extends State<WebPageScreen> {
  final _panel = GlobalKey<WebPanelState>();

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final navigator = Navigator.of(context);
        if (!(await _panel.currentState?.goBack() ?? false)) navigator.pop();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.title),
          actions: [IconButton(tooltip: 'Yenile', icon: const Icon(Icons.refresh_rounded), onPressed: () => _panel.currentState?.reload())],
        ),
        body: WebPanel(key: _panel, url: widget.url, authPath: widget.authPath),
      ),
    );
  }
}

/// Ana ekran olarak site paneli (kurum paneli, veli portalı, Hesabım): geri tuşu önce sayfada geri gider.
class WebHome extends StatefulWidget {
  const WebHome({super.key, required this.title, required this.path, this.actions = const []});

  final String title;
  final String path;
  final List<Widget> actions;

  @override
  State<WebHome> createState() => _WebHomeState();
}

class _WebHomeState extends State<WebHome> {
  final _panel = GlobalKey<WebPanelState>();
  bool _canExit = false;

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _canExit,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (!(await _panel.currentState?.goBack() ?? false)) {
          setState(() => _canExit = true);
          if (context.mounted) Navigator.of(context).maybePop();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.title),
          actions: [IconButton(tooltip: 'Yenile', icon: const Icon(Icons.refresh_rounded), onPressed: () => _panel.currentState?.reload()), ...widget.actions],
        ),
        body: WebPanel(key: _panel, authPath: widget.path),
      ),
    );
  }
}
