import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/api/api_exception.dart';
import '../../core/auth/sides.dart';
import '../../core/config.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/states.dart';
import '../../core/widgets/web_view.dart';

/// Kurum paneli (personel): sitedeki /kurum, tek kullanımlık girişle oturum açık açılır. Panel telefona uygun;
/// yoklama, etüt, ödev, deneme, muhasebe gibi tüm bölümler web panelindeki gibi çalışır.
///
/// * Panelin "Özel ders paneline geç" / "Veli portalı" bağlantıları uygulamadaki tarafa geçer.
/// * Panelde çıkış yapılırsa uygulamadan da çıkılır; web oturumu düşerse sessizce yeniden açılır.
/// * Excel dışa aktarımları tarayıcıda (tek kullanımlık girişle) indirilir.
class CenterPanelScreen extends ConsumerStatefulWidget {
  const CenterPanelScreen({super.key, this.path = '/kurum'});

  /// Açılacak panel sayfası (bildirim bağlantısı olabilir: /kurum/sorular/...)
  final String path;

  @override
  ConsumerState<CenterPanelScreen> createState() => _CenterPanelScreenState();
}

class _CenterPanelScreenState extends ConsumerState<CenterPanelScreen> {
  WebViewController? _controller;
  int _progress = 0;
  ApiException? _error;
  DateTime? _lastReauth;
  bool _leaving = false;

  Uri get _site => Uri.parse(AppConfig.siteUrl);

  @override
  void initState() {
    super.initState();
    if (!kIsWeb) _open(widget.path);
  }

  /// Tek kullanımlık bağlantıyla panel sayfasını açar (web oturumu WebView'da kurulur).
  Future<void> _open(String path) async {
    setState(() => _error = null);
    try {
      final link = Uri.parse(await ref.read(apiProvider).teacherPanelLink(path));
      final controller = _controller ?? await createAppWebView(delegate: _delegate());
      await controller.loadRequest(link);
      if (mounted) setState(() => _controller = controller);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  NavigationDelegate _delegate() => NavigationDelegate(
        onProgress: (value) {
          if (mounted) setState(() => _progress = value);
        },
        onWebResourceError: (error) {
          if ((error.isForMainFrame ?? true) && mounted) {
            setState(() => _error = const ApiException(code: ApiException.network, message: 'Panel yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.'));
          }
        },
        onNavigationRequest: (request) {
          final uri = Uri.tryParse(request.url);
          if (uri == null) return NavigationDecision.prevent;
          if (uri.host != _site.host) {
            // Telefon, e-posta, WhatsApp ve dış siteler uygulama dışında açılır
            launchUrl(uri, mode: LaunchMode.externalApplication);
            return NavigationDecision.prevent;
          }
          if (uri.path.startsWith('/api/kurum/disa-aktar/')) {
            _download(uri);
            return NavigationDecision.prevent;
          }
          return _handleSitePath(uri) ? NavigationDecision.prevent : NavigationDecision.navigate;
        },
        // Panel içi geçişler istemci tarafında olur (Next.js); adres değişimi buradan izlenir
        onUrlChange: (change) {
          final uri = Uri.tryParse(change.url ?? '');
          if (uri != null && uri.host == _site.host) _handleSitePath(uri);
        },
      );

  /// Panelin dışına çıkan site adresleri uygulamada karşılanır; true: WebView o adrese gitmesin.
  bool _handleSitePath(Uri uri) {
    final path = uri.path;
    final session = ref.read(sessionProvider.notifier);
    // Panelin "çıkış" düğmesi ana sayfaya yönlenir: uygulamadan da çıkılır
    if (path == '/' && !_leaving) {
      _leaving = true;
      session.logout();
      return true;
    }
    // Web oturumu düştü (süre doldu, şifre değişti): yeni tek kullanımlık bağlantıyla dakikada bir kez yeniden açılır
    if (path == '/giris' || path == '/kurum-giris') {
      final now = DateTime.now();
      if (_lastReauth == null || now.difference(_lastReauth!) > const Duration(minutes: 1)) {
        _lastReauth = now;
        _open(uri.queryParameters['next'] ?? widget.path);
      } else {
        setState(() => _error = const ApiException(code: 'UNAUTHENTICATED', message: 'Kurum paneli oturumu açılamadı. Tekrar deneyin ya da çıkış yapıp yeniden giriş yapın.'));
      }
      return true;
    }
    // Panelin taraf bağlantıları: uygulamadaki tarafa geçilir
    final target = path.startsWith('/ogretmen-paneli')
        ? AppView.teacher
        : path.startsWith('/hesabim/kurum')
            ? AppView.portal
            : path.startsWith('/hesabim')
                ? AppView.student
                : null;
    if (target != null) {
      _switchTo(target);
      return true;
    }
    return false;
  }

  /// Taraf değişir (gerekirse) ve o tarafın açılış sayfasına gidilir; WebView webdeki panele geçmeden ekran kapanır.
  Future<void> _switchTo(AppView target) async {
    final session = ref.read(sessionProvider);
    if (session.me == null || !availableViews(session.me!).contains(target)) return;
    final router = ref.read(routerProvider);
    if (target != session.view) await ref.read(sessionProvider.notifier).switchView(target);
    router.go(Routes.homeOf(target));
  }

  Future<void> _download(Uri uri) async {
    try {
      final link = await ref.read(apiProvider).teacherPanelLink(uri.hasQuery ? '${uri.path}?${uri.query}' : uri.path);
      await launchUrl(Uri.parse(link), mode: LaunchMode.externalApplication);
    } on ApiException catch (error) {
      if (mounted) showError(context, error);
    }
  }

  Future<bool> _back() async {
    final controller = _controller;
    if (controller != null && await controller.canGoBack()) {
      await controller.goBack();
      return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final me = session.me;
    // Açılış sayfası (kurum personelinin uygulamadaki tek tarafı) ya da bildirimden açılan sayfa
    final root = session.view == AppView.centerPanel && !context.canPop();
    final switches = me == null ? const <SideSwitch>[] : sideSwitches(me, AppView.centerPanel);
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final leave = await _back();
        if (leave && context.mounted && !root) context.pop();
      },
      child: Scaffold(
        appBar: AppBar(
          leading: root ? null : BackButton(onPressed: () => context.canPop() ? context.pop() : context.go(Routes.homeOf(session.view))),
          automaticallyImplyLeading: !root,
          title: const Text('Kurum paneli'),
          actions: [
            IconButton(tooltip: 'Yenile', onPressed: () => _controller?.reload(), icon: const Icon(Icons.refresh_rounded)),
            PopupMenuButton<String>(
              tooltip: 'Menü',
              onSelected: (value) async {
                if (value == 'cikis') {
                  final ok = await confirmDialog(context, title: 'Çıkış yapılsın mı?', message: 'Bu cihazdaki oturumunuz kapatılır.', confirmText: 'Çıkış yap');
                  if (ok) await ref.read(sessionProvider.notifier).logout();
                } else if (value == 'profil') {
                  if (context.mounted) context.push(Routes.profileEdit);
                } else if (value == 'sifre') {
                  if (context.mounted) context.push(Routes.changePassword);
                } else {
                  final target = AppView.fromName(value);
                  if (target != null) _switchTo(target);
                }
              },
              itemBuilder: (context) => [
                for (final s in switches) PopupMenuItem(value: s.target.name, child: ListTile(leading: const Icon(Icons.swap_horiz_rounded), title: Text(s.label))),
                const PopupMenuItem(value: 'profil', child: ListTile(leading: Icon(Icons.badge_outlined), title: Text('Profil bilgileri'))),
                const PopupMenuItem(value: 'sifre', child: ListTile(leading: Icon(Icons.lock_reset_rounded), title: Text('Şifre değiştir'))),
                const PopupMenuItem(value: 'cikis', child: ListTile(leading: Icon(Icons.logout_rounded), title: Text('Çıkış yap'))),
              ],
            ),
          ],
          bottom: _progress > 0 && _progress < 100 ? PreferredSize(preferredSize: const Size.fromHeight(3), child: LinearProgressIndicator(value: _progress / 100, minHeight: 3)) : null,
        ),
        body: kIsWeb
            ? Center(child: FilledButton(onPressed: () => openExternal(context, '${AppConfig.siteUrl}/kurum'), child: const Text('Kurum panelini aç')))
            : _error != null
                ? ErrorView(error: _error!, onRetry: () => _open(widget.path))
                : _controller == null
                    ? const LoadingView()
                    : WebViewWidget(controller: _controller!),
      ),
    );
  }
}
