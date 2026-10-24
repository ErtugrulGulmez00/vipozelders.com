import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/api/api_exception.dart';
import '../../core/format/dates.dart';
import '../../core/providers.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/states.dart';
import '../../core/widgets/web_view.dart';
import '../shared/data.dart';

/// Sanal sınıf: sitedeki sınıf sayfası (görüntü, ses, sohbet, beyaz tahta) tam ekran WebView'da açılır.
/// Giriş adresi her seferinde yeniden alınır (5 dakika geçerli, tek kullanımlık).
class ClassroomScreen extends ConsumerStatefulWidget {
  const ClassroomScreen({super.key, required this.bookingId, this.groupSession = false});

  /// Randevu kimliği; [groupSession] açıkken grup dersi oturumunun kimliği.
  final String bookingId;
  final bool groupSession;

  @override
  ConsumerState<ClassroomScreen> createState() => _ClassroomScreenState();
}

class _ClassroomScreenState extends ConsumerState<ClassroomScreen> {
  WebViewController? _controller;
  Object? _error;
  DateTime? _opensAt;
  bool _permissionsDenied = false;
  bool _closing = false;
  int _progress = 0;

  @override
  void initState() {
    super.initState();
    _enter();
  }

  @override
  void dispose() {
    if (!kIsWeb) WakelockPlus.disable();
    super.dispose();
  }

  Future<void> _enter() async {
    setState(() {
      _error = null;
      _permissionsDenied = false;
    });
    if (!kIsWeb) {
      final statuses = await [Permission.camera, Permission.microphone].request();
      final denied = statuses.values.any((s) => s.isPermanentlyDenied);
      if (denied && mounted) setState(() => _permissionsDenied = true);
    }
    try {
      final api = ref.read(apiProvider);
      final access = widget.groupSession ? await api.groupClassroom(widget.bookingId) : await api.classroom(widget.bookingId);
      if (!mounted) return;
      if (kIsWeb) {
        await launchUrl(Uri.parse(access.url), webOnlyWindowName: '_blank');
        if (mounted) context.pop();
        return;
      }
      await WakelockPlus.enable();
      final controller = await createAppWebView(
        media: true,
        delegate: NavigationDelegate(
          onUrlChange: (change) {
            final url = change.url;
            if (url != null && _isExit(url)) _leave();
          },
          onNavigationRequest: (request) {
            if (_isExit(request.url)) {
              _leave();
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
          onProgress: (value) {
            if (mounted) setState(() => _progress = value);
          },
        ),
      );
      await controller.loadRequest(Uri.parse(access.url));
      if (mounted) setState(() => _controller = controller);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _opensAt = asOpensAt(error);
      });
    }
  }

  static DateTime? asOpensAt(ApiException error) {
    final value = error.extra['opensAt'];
    return value is String ? DateTime.tryParse(value)?.toUtc() : null;
  }

  /// Sınıftaki "Dersten çık" ders sayfasına yönlendirir; uygulama bunu yakalayıp WebView'ı kapatır.
  bool _isExit(String url) {
    final path = Uri.tryParse(url)?.path ?? '';
    return path.startsWith('/hesabim/derslerim/') ||
        path.startsWith('/ogretmen-paneli/dersler/') ||
        path.startsWith('/hesabim/grup-derslerim') ||
        path.startsWith('/ogretmen-paneli/grup-dersleri') ||
        path == '/giris';
  }

  void _leave() {
    if (_closing || !mounted) return;
    _closing = true;
    bumpBookings(ref);
    context.pop();
  }

  Future<void> _confirmLeave() async {
    final ok = await confirmDialog(context, title: 'Dersten çıkılsın mı?', message: 'Ders süresince tekrar katılabilirsiniz.', confirmText: 'Çık');
    if (ok) _leave();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _controller == null,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmLeave();
      },
      child: Scaffold(
        backgroundColor: _controller == null ? null : Colors.black,
        appBar: _controller == null
            ? AppBar(title: const Text('Sanal sınıf'))
            : PreferredSize(
                preferredSize: const Size.fromHeight(3),
                child: SafeArea(
                  bottom: false,
                  child: _progress > 0 && _progress < 100 ? LinearProgressIndicator(value: _progress / 100, minHeight: 3) : const SizedBox(height: 3),
                ),
              ),
        body: _error != null
            ? _ClosedView(error: _error!, opensAt: _opensAt, onRetry: _enter)
            : _controller == null
                ? const LoadingView(message: 'Sınıfa bağlanılıyor…')
                : SafeArea(
                    child: Column(
                      children: [
                        if (_permissionsDenied)
                          MaterialBanner(
                            content: const Text('Kamera/mikrofon izni kapalı. Görüntü ve ses için ayarlardan izin verin.'),
                            actions: [TextButton(onPressed: openAppSettings, child: const Text('Ayarlar'))],
                          ),
                        Expanded(child: WebViewWidget(controller: _controller!)),
                      ],
                    ),
                  ),
      ),
    );
  }
}

class _ClosedView extends StatelessWidget {
  const _ClosedView({required this.error, required this.opensAt, required this.onRetry});

  final Object error;
  final DateTime? opensAt;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final closed = error is ApiException && (error as ApiException).code == 'CLASSROOM_CLOSED';
    if (!closed) return ErrorView(error: error, onRetry: onRetry);
    return EmptyView(
      icon: Icons.meeting_room_outlined,
      title: 'Sınıf henüz açık değil',
      message: '${errorMessage(error)}${opensAt != null ? '\nAçılış: ${formatDateTime(opensAt!)}' : ''}',
      action: OutlinedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh_rounded), label: const Text('Tekrar dene')),
    );
  }
}
