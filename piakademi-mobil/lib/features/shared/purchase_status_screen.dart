import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/api/pi_api.dart';
import '../../core/format/money.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/cards.dart';
import 'data.dart';

/// Ders dışındaki satın almalar: ödeme sayfası (WebView) dönüşünde sonuç bu türe göre sorgulanır.
enum PurchaseKind {
  credits('kredi'),
  package('paket'),
  subscription('abonelik'),
  group('grup');

  const PurchaseKind(this.slug);

  final String slug;

  static PurchaseKind? fromSlug(String slug) => PurchaseKind.values.where((k) => k.slug == slug).firstOrNull;
}

/// Sorgulama sonucu: ödendi mi, başarısız mı, kullanıcıya gösterilecek metinler ve düğmeler.
class _Outcome {
  const _Outcome({required this.pending, required this.paid, this.title = '', this.message = '', this.failure});

  final bool pending;
  final bool paid;
  final String title;
  final String message;
  final String? failure;
}

/// "Ödemeniz kontrol ediliyor": satın alma 3 saniyede bir (en çok 3 dakika) sorgulanır.
class PurchaseStatusScreen extends ConsumerStatefulWidget {
  const PurchaseStatusScreen({super.key, required this.kind, required this.id});

  final PurchaseKind kind;
  final String id;

  @override
  ConsumerState<PurchaseStatusScreen> createState() => _PurchaseStatusScreenState();
}

class _PurchaseStatusScreenState extends ConsumerState<PurchaseStatusScreen> {
  _Outcome? _outcome;
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

  Future<_Outcome> _load(PiApi api) async {
    switch (widget.kind) {
      case PurchaseKind.credits:
        final p = await api.creditPurchase(widget.id);
        return _Outcome(
          pending: p.status == 'PENDING_PAYMENT' && p.paymentStatus != 'FAILED',
          paid: p.isPaid,
          title: '${p.credits} soru kredisi hesabınızda',
          message: '${formatMoney(p.price)} ödemeniz alındı. Şimdi sorunuzun fotoğrafını çekip gönderebilirsiniz.',
          failure: p.failureReason,
        );
      case PurchaseKind.package:
        final p = await api.package(widget.id);
        return _Outcome(
          pending: p.status == 'PENDING_PAYMENT' && !(p.payment?.failed ?? false),
          paid: p.status == 'PAID',
          title: p.recurring ? 'Düzenli dersleriniz planlanıyor' : '${p.lessonCount} derslik paketiniz hazır',
          message: p.recurring
              ? 'Her hafta için öğretmeninize ders talebi gönderiliyor; onayladıkça bildirim alacaksınız. Uygun olmayan haftalar paketinizde kalır.'
              : 'Öğretmeninizin takviminden saat seçip “Paketimden kullan” ile ödemesiz ders alabilirsiniz.',
          failure: p.payment?.failureReason,
        );
      case PurchaseKind.subscription:
        final s = await api.subscription(widget.id);
        return _Outcome(
          pending: s.status == 'PENDING_PAYMENT' && !(s.payment?.failed ?? false),
          paid: s.status == 'ACTIVE',
          title: s.running ? 'Aboneliğiniz başladı' : 'Yeni döneminiz hazır',
          message: s.running
              ? '${s.teacher.name} ile ${s.title} aboneliğiniz aktif. Günde ${s.dailyLimit} soru gönderebilirsiniz.'
              : 'Yeni dönem mevcut döneminiz bitince başlayacak.',
          failure: s.payment?.failureReason,
        );
      case PurchaseKind.group:
        final e = await api.groupEnrollment(widget.id);
        return _Outcome(
          pending: e.status == 'PENDING_PAYMENT' && !(e.payment?.failed ?? false),
          paid: e.status == 'PAID',
          title: 'Grup dersine kaydınız tamam',
          message: '${e.courseTitle ?? 'Ders'}: kayıt bitişinde en az katılımcı sayısına ulaşılırsa ders kesinleşir; ulaşılmazsa ödemenizin tamamı iade edilir.',
          failure: e.payment?.failureReason,
        );
    }
  }

  Future<void> _check() async {
    try {
      final outcome = await _load(ref.read(apiProvider));
      if (!mounted) return;
      setState(() {
        _outcome = outcome;
        _networkProblem = null;
      });
      if (outcome.pending) {
        _schedule();
      } else {
        bumpPurchases(ref);
        if (widget.kind == PurchaseKind.credits || widget.kind == PurchaseKind.subscription) bumpQuestions(ref);
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

  /// Kapatınca gidilecek ekran.
  String get _home => switch (widget.kind) {
        PurchaseKind.credits => Routes.ask,
        PurchaseKind.package => Routes.packages,
        PurchaseKind.subscription => Routes.subscriptions,
        PurchaseKind.group => Routes.myGroups,
      };

  List<Widget> _successActions(BuildContext context) => switch (widget.kind) {
        PurchaseKind.credits => [
            FilledButton.icon(onPressed: () => context.go(Routes.askQuestion), icon: const Icon(Icons.add_a_photo_rounded), label: const Text('Soru gönder')),
            const SizedBox(height: 8),
            OutlinedButton(onPressed: () => context.go(Routes.ask), child: const Text('Kredilerime dön')),
          ],
        PurchaseKind.package => [FilledButton(onPressed: () => context.go(Routes.packages), child: const Text('Paketlerim'))],
        PurchaseKind.subscription => [FilledButton.icon(onPressed: () => context.go(Routes.subscriptions), icon: const Icon(Icons.add_a_photo_rounded), label: const Text('Aboneliklerim · soru sor'))],
        PurchaseKind.group => [FilledButton(onPressed: () => context.go(Routes.myGroups), child: const Text('Grup derslerim'))],
      };

  @override
  Widget build(BuildContext context) {
    final o = _outcome;
    final scheme = Theme.of(context).colorScheme;
    final title = Theme.of(context).textTheme.headlineSmall;
    final muted = TextStyle(color: scheme.onSurfaceVariant, height: 1.45, fontSize: 15);
    final paid = o != null && o.paid;
    final failed = o != null && !o.paid && !o.pending;
    final checking = !paid && !failed && !_timedOut;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) context.go(_home);
      },
      child: Scaffold(
        appBar: AppBar(
          automaticallyImplyLeading: false,
          title: const Text('Ödeme sonucu'),
          actions: [IconButton(tooltip: 'Kapat', onPressed: () => context.go(_home), icon: const Icon(Icons.close_rounded))],
        ),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              const SizedBox(height: 24),
              Center(
                child: checking
                    ? const SizedBox(width: 72, height: 72, child: CircularProgressIndicator(strokeWidth: 6))
                    : Icon(paid ? Icons.check_circle_rounded : Icons.error_rounded, size: 88, color: paid ? const Color(0xFF059669) : scheme.error),
              ),
              const SizedBox(height: 24),
              if (checking) ...[
                Text('Ödemeniz kontrol ediliyor', textAlign: TextAlign.center, style: title),
                const SizedBox(height: 8),
                Text('Bankanızdan onay bekleniyor. Bu birkaç saniye sürebilir; lütfen bu ekranı kapatmayın.', textAlign: TextAlign.center, style: muted),
                if (_networkProblem != null) ...[const SizedBox(height: 12), NoticeBox(message: _networkProblem!, tone: Tone.amber)],
              ] else if (paid) ...[
                Text(o.title, textAlign: TextAlign.center, style: title),
                const SizedBox(height: 8),
                Text(o.message, textAlign: TextAlign.center, style: muted),
                const SizedBox(height: 24),
                ..._successActions(context),
              ] else ...[
                Text(_timedOut ? 'Ödeme sonucu henüz gelmedi' : 'Ödeme tamamlanamadı', textAlign: TextAlign.center, style: title),
                const SizedBox(height: 8),
                Text(
                  _timedOut
                      ? 'Bankadan yanıt gelmedi. Kartınızdan çekim yapıldıysa işleminiz birkaç dakika içinde tamamlanır; ilgili ekrandan kontrol edebilirsiniz.'
                      : (o?.failure ?? 'Kart bankası ödemeyi onaylamadı. Başka bir kartla tekrar deneyebilirsiniz.'),
                  textAlign: TextAlign.center,
                  style: muted,
                ),
                const SizedBox(height: 24),
                FilledButton(onPressed: () => context.go(_home), child: const Text('Tamam')),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
