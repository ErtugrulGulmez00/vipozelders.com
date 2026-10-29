import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/api/api_exception.dart';
import '../../core/config.dart';
import '../../core/providers.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/states.dart';
import '../../core/widgets/web_view.dart';
import '../shared/widgets.dart';

/// Sitedeki yasal/bilgi sayfaları uygulama içinde açılır (KVKK, sözleşmeler, SSS).
/// Site içindeki diğer bağlantılar tarayıcıda açılır.
class WebPageScreen extends ConsumerStatefulWidget {
  const WebPageScreen({super.key, required this.url, this.title, this.panelPath, this.guide = false, this.section});

  factory WebPageScreen.page({Key? key, required String slug}) => WebPageScreen(key: key, url: '${AppConfig.siteUrl}/sayfa/$slug', title: null);

  /// "Nasıl çalışır?": sitedeki ekran ekran rehberler (özel ders, etüt merkezi, dershane); rehberler arasında gezinilir.
  factory WebPageScreen.howItWorks({Key? key}) =>
      WebPageScreen(key: key, url: '${AppConfig.siteUrl}/nasil-calisir', title: 'Nasıl çalışır?', section: '/nasil-calisir');

  /// Öğretmen web paneli sayfası (profil, fotoğraf, fiyatlar, belgeler): tek kullanımlık bağlantıyla oturum açık açılır
  /// ve panel içinde gezinilebilir.
  factory WebPageScreen.teacherPanel({Key? key, required String path, required String title}) =>
      WebPageScreen(key: key, url: '${AppConfig.siteUrl}$path', title: title, panelPath: path);

  final String url;
  final String? title;
  final String? panelPath;

  /// Rehber (blog): /rehber ve yazıları uygulama içinde gezilir.
  final bool guide;

  /// Bu adresle başlayan site sayfaları uygulama içinde kalır (diğerleri tarayıcıda açılır)
  final String? section;

  @override
  ConsumerState<WebPageScreen> createState() => _WebPageScreenState();
}

class _WebPageScreenState extends ConsumerState<WebPageScreen> {
  String get _url => widget.guide ? '${AppConfig.siteUrl}/rehber' : widget.url;

  WebViewController? _controller;
  int _progress = 0;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    if (!kIsWeb) _load();
  }

  Future<void> _load() async {
    final start = Uri.parse(widget.guide ? '${AppConfig.siteUrl}/rehber' : widget.url);
    final panel = widget.panelPath != null;
    Uri entry = start;
    if (panel) {
      try {
        entry = Uri.parse(await ref.read(apiProvider).teacherPanelLink(widget.panelPath!));
      } catch (_) {
        if (mounted) setState(() => _failed = true);
        return;
      }
    }
    final controller = await createAppWebView(
      delegate: NavigationDelegate(
        onProgress: (value) {
          if (mounted) setState(() => _progress = value);
        },
        onWebResourceError: (error) {
          if ((error.isForMainFrame ?? true) && mounted) setState(() => _failed = true);
        },
        onNavigationRequest: (request) {
          final uri = Uri.tryParse(request.url);
          // Yalnızca aynı sayfa içinde kalınır; diğer bağlantılar tarayıcıda açılır.
          if (uri != null && uri.path == start.path && uri.host == start.host) return NavigationDecision.navigate;
          if (widget.guide && uri != null && uri.host == start.host && uri.path.startsWith('/rehber')) return NavigationDecision.navigate;
          if (widget.section != null && uri != null && uri.host == start.host && uri.path.startsWith(widget.section!)) return NavigationDecision.navigate;
          // Panel sayfasında giriş bağlantısı ve panelin kendi sayfaları uygulamada kalır.
          if (panel && uri != null && uri.host == entry.host && (uri.path.startsWith('/ogretmen-paneli') || uri.path.startsWith('/api/mobil/v1/web-giris'))) {
            return NavigationDecision.navigate;
          }
          if (uri != null) launchUrl(uri, mode: LaunchMode.externalApplication);
          return NavigationDecision.prevent;
        },
      ),
    );
    await controller.loadRequest(entry);
    if (mounted) setState(() => _controller = controller);
  }

  @override
  Widget build(BuildContext context) {
    final slug = Uri.parse(widget.url).pathSegments.lastOrNull;
    final title = widget.title ?? ref.watch(catalogProvider).valueOrNull?.page(slug ?? '')?.title ?? 'Pi Kampüs';
    return Scaffold(
      appBar: AppBar(
        leading: const AppBackButton(),
        title: Text(title),
        actions: [IconButton(tooltip: 'Tarayıcıda aç', onPressed: () => openExternal(context, _url), icon: const Icon(Icons.open_in_new_rounded))],
        bottom: _progress > 0 && _progress < 100 ? PreferredSize(preferredSize: const Size.fromHeight(3), child: LinearProgressIndicator(value: _progress / 100, minHeight: 3)) : null,
      ),
      body: kIsWeb
          ? Center(child: FilledButton(onPressed: () => openExternal(context, _url), child: const Text('Sayfayı aç')))
          : _failed
              ? ErrorView(
                  error: const ApiException(code: ApiException.network, message: 'Sayfa yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.'),
                  onRetry: () {
                    setState(() => _failed = false);
                    // Panel bağlantısı tek kullanımlıktır; yeniden alınır.
                    if (widget.panelPath != null || _controller == null) {
                      _load();
                    } else {
                      _controller!.loadRequest(Uri.parse(_url));
                    }
                  },
                )
              : _controller == null
                  ? const LoadingView()
                  : WebViewWidget(controller: _controller!),
    );
  }
}
