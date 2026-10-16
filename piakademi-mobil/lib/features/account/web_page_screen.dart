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
  const WebPageScreen({super.key, required this.url, this.title});

  factory WebPageScreen.page({Key? key, required String slug}) => WebPageScreen(key: key, url: '${AppConfig.siteUrl}/sayfa/$slug', title: null);

  final String url;
  final String? title;

  @override
  ConsumerState<WebPageScreen> createState() => _WebPageScreenState();
}

class _WebPageScreenState extends ConsumerState<WebPageScreen> {
  WebViewController? _controller;
  int _progress = 0;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    if (!kIsWeb) _load();
  }

  Future<void> _load() async {
    final start = Uri.parse(widget.url);
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
          if (uri != null) launchUrl(uri, mode: LaunchMode.externalApplication);
          return NavigationDecision.prevent;
        },
      ),
    );
    await controller.loadRequest(start);
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
        actions: [IconButton(tooltip: 'Tarayıcıda aç', onPressed: () => openExternal(context, widget.url), icon: const Icon(Icons.open_in_new_rounded))],
        bottom: _progress > 0 && _progress < 100 ? PreferredSize(preferredSize: const Size.fromHeight(3), child: LinearProgressIndicator(value: _progress / 100, minHeight: 3)) : null,
      ),
      body: kIsWeb
          ? Center(child: FilledButton(onPressed: () => openExternal(context, widget.url), child: const Text('Sayfayı aç')))
          : _failed
              ? ErrorView(
                  error: const ApiException(code: ApiException.network, message: 'Sayfa yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.'),
                  onRetry: () {
                    setState(() => _failed = false);
                    _controller?.loadRequest(Uri.parse(widget.url));
                  },
                )
              : _controller == null
                  ? const LoadingView()
                  : WebViewWidget(controller: _controller!),
    );
  }
}
