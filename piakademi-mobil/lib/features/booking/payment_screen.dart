import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/models/booking.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/widgets/states.dart';
import '../../core/widgets/web_view.dart';
import '../shared/data.dart';
import '../shared/purchase_status_screen.dart';

/// Güvenli ödeme sayfası (sitedeki PayTR formu) uygulama içinde açılır. Kart bilgisi uygulamaya hiç gelmez.
/// Sayfa ödeme sonucu adresine geçince kapanır ve "ödemeniz kontrol ediliyor" ekranı açılır.
class PaymentScreen extends ConsumerStatefulWidget {
  const PaymentScreen({super.key, required this.bookingId, this.link, this.purchase});

  /// Randevu kimliği; [purchase] verilirse o satın almanın (kredi, paket, abonelik, grup kaydı) kimliği.
  final String bookingId;
  final PaymentLink? link;
  final PurchaseKind? purchase;

  @override
  ConsumerState<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends ConsumerState<PaymentScreen> {
  PaymentLink? _link;
  Object? _error;
  WebViewController? _controller;
  int _progress = 0;
  bool _finished = false;

  @override
  void initState() {
    super.initState();
    _link = widget.link;
    if (_link == null && widget.purchase != null) {
      // Bu ödemelerin bağlantısı yeniden alınamaz; durum ekranında sonuç gösterilir.
      WidgetsBinding.instance.addPostFrameCallback((_) => _finish());
    } else if (_link == null) {
      _fetchLink();
    } else {
      _open(_link!);
    }
  }

  Future<void> _fetchLink() async {
    setState(() => _error = null);
    try {
      final link = await ref.read(apiProvider).retryPayment(widget.bookingId);
      if (!mounted) return;
      setState(() => _link = link);
      _open(link);
    } catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  Future<void> _open(PaymentLink link) async {
    if (kIsWeb) {
      // Web önizlemesinde ödeme sayfası yeni sekmede açılır.
      await launchUrl(Uri.parse(link.url), webOnlyWindowName: '_blank');
      return;
    }
    bool isReturn(String url) => link.returnUrlPrefix.isNotEmpty && url.startsWith(link.returnUrlPrefix);
    final controller = await createAppWebView(
      delegate: NavigationDelegate(
        onNavigationRequest: (request) {
          if (isReturn(request.url)) {
            _finish();
            return NavigationDecision.prevent;
          }
          return NavigationDecision.navigate;
        },
        onUrlChange: (change) {
          final url = change.url;
          if (url != null && isReturn(url)) _finish();
        },
        onProgress: (value) {
          if (mounted) setState(() => _progress = value);
        },
      ),
    );
    await controller.loadRequest(Uri.parse(link.url));
    if (mounted) setState(() => _controller = controller);
  }

  void _finish() {
    if (_finished || !mounted) return;
    _finished = true;
    final purchase = widget.purchase;
    if (purchase != null) {
      context.pushReplacement(Routes.purchaseStatus(purchase, widget.bookingId));
      return;
    }
    bumpBookings(ref);
    context.pushReplacement(Routes.paymentStatus(widget.bookingId));
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _finish();
      },
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(tooltip: 'Kapat', icon: const Icon(Icons.close_rounded), onPressed: _finish),
          title: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.lock_rounded, size: 18, color: Color(0xFF059669)),
              SizedBox(width: 6),
              Text('Güvenli ödeme'),
            ],
          ),
          bottom: _progress > 0 && _progress < 100
              ? PreferredSize(preferredSize: const Size.fromHeight(3), child: LinearProgressIndicator(value: _progress / 100, minHeight: 3))
              : null,
        ),
        body: _error != null
            ? ErrorView(error: _error!, onRetry: _fetchLink)
            : kIsWeb
                ? _WebPreviewPayment(onDone: _finish)
                : _controller == null
                    ? const LoadingView(message: 'Ödeme sayfası hazırlanıyor…')
                    : WebViewWidget(controller: _controller!),
      ),
    );
  }
}

class _WebPreviewPayment extends StatelessWidget {
  const _WebPreviewPayment({required this.onDone});

  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.open_in_new_rounded, size: 48),
            const SizedBox(height: 12),
            const Text('Ödeme sayfası yeni sekmede açıldı. Ödemeyi tamamladıktan sonra aşağıdaki düğmeye basın.', textAlign: TextAlign.center),
            const SizedBox(height: 20),
            FilledButton(onPressed: onDone, child: const Text('Ödemeyi kontrol et')),
          ],
        ),
      ),
    );
  }
}
