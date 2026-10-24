import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/format/money.dart';
import '../../core/models/pool.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/cards.dart';
import '../shared/data.dart';

/// Kredi paketi ödemesinin sonucu: satın alma 3 saniyede bir (en çok 3 dakika) sorgulanır.
class CreditPaymentStatusScreen extends ConsumerStatefulWidget {
  const CreditPaymentStatusScreen({super.key, required this.purchaseId});

  final String purchaseId;

  @override
  ConsumerState<CreditPaymentStatusScreen> createState() => _CreditPaymentStatusScreenState();
}

class _CreditPaymentStatusScreenState extends ConsumerState<CreditPaymentStatusScreen> {
  CreditPurchase? _purchase;
  Timer? _timer;
  late final DateTime _deadline = DateTime.now().add(const Duration(minutes: 3));
  bool _timedOut = false;
  String? _networkProblem;

  @override
  void initState() {
    super.initState();
    _check();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  bool _pending(CreditPurchase p) => p.status == 'PENDING_PAYMENT' && p.paymentStatus != 'FAILED';

  Future<void> _check() async {
    try {
      final purchase = await ref.read(apiProvider).creditPurchase(widget.purchaseId);
      if (!mounted) return;
      setState(() {
        _purchase = purchase;
        _networkProblem = null;
      });
      if (_pending(purchase)) {
        _schedule();
      } else {
        bumpQuestions(ref);
      }
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _networkProblem = error.message);
      _schedule();
    }
  }

  void _schedule() {
    if (DateTime.now().isAfter(_deadline)) {
      setState(() => _timedOut = true);
      return;
    }
    _timer?.cancel();
    _timer = Timer(const Duration(seconds: 3), _check);
  }

  @override
  Widget build(BuildContext context) {
    final p = _purchase;
    final scheme = Theme.of(context).colorScheme;
    final title = Theme.of(context).textTheme.headlineSmall;
    final muted = TextStyle(color: scheme.onSurfaceVariant, height: 1.45, fontSize: 15);
    final paid = p != null && p.isPaid;
    final failed = p != null && !paid && !_pending(p);
    final checking = !paid && !failed && !_timedOut;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) context.go(Routes.ask);
      },
      child: Scaffold(
        appBar: AppBar(
          automaticallyImplyLeading: false,
          title: const Text('Ödeme sonucu'),
          actions: [IconButton(tooltip: 'Kapat', onPressed: () => context.go(Routes.ask), icon: const Icon(Icons.close_rounded))],
        ),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              const SizedBox(height: 24),
              Center(
                child: checking
                    ? const SizedBox(width: 72, height: 72, child: CircularProgressIndicator(strokeWidth: 6))
                    : Icon(
                        paid ? Icons.check_circle_rounded : Icons.error_rounded,
                        size: 88,
                        color: paid ? const Color(0xFF059669) : scheme.error,
                      ),
              ),
              const SizedBox(height: 24),
              if (checking) ...[
                Text('Ödemeniz kontrol ediliyor', textAlign: TextAlign.center, style: title),
                const SizedBox(height: 8),
                Text('Bankanızdan onay bekleniyor. Bu birkaç saniye sürebilir; lütfen bu ekranı kapatmayın.', textAlign: TextAlign.center, style: muted),
                if (_networkProblem != null) ...[const SizedBox(height: 12), NoticeBox(message: _networkProblem!, tone: Tone.amber)],
              ] else if (paid) ...[
                Text('${p.credits} soru kredisi hesabınızda', textAlign: TextAlign.center, style: title),
                const SizedBox(height: 8),
                Text('${formatMoney(p.price)} ödemeniz alındı. Şimdi sorunuzun fotoğrafını çekip gönderebilirsiniz.', textAlign: TextAlign.center, style: muted),
                const SizedBox(height: 24),
                FilledButton.icon(onPressed: () => context.go(Routes.askQuestion), icon: const Icon(Icons.add_a_photo_rounded), label: const Text('Soru gönder')),
                const SizedBox(height: 8),
                OutlinedButton(onPressed: () => context.go(Routes.ask), child: const Text('Kredilerime dön')),
              ] else ...[
                Text(_timedOut ? 'Ödeme sonucu henüz gelmedi' : 'Ödeme tamamlanamadı', textAlign: TextAlign.center, style: title),
                const SizedBox(height: 8),
                Text(
                  _timedOut
                      ? 'Bankadan yanıt gelmedi. Kartınızdan çekim yapıldıysa krediler birkaç dakika içinde hesabınıza geçer; Kredilerim ekranından kontrol edebilirsiniz.'
                      : (p?.failureReason ?? 'Kart bankası ödemeyi onaylamadı. Başka bir kartla tekrar deneyebilirsiniz.'),
                  textAlign: TextAlign.center,
                  style: muted,
                ),
                const SizedBox(height: 24),
                FilledButton(onPressed: () => context.go(Routes.ask), child: const Text('Paketlere dön')),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
