import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/format/dates.dart';
import '../../core/format/money.dart';
import '../../core/models/pool.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';
import '../booking/booking_screen.dart' show ConsentText;

/// "Soru sor": soru kredisi bakiyesi, paketler ve satın alma, kredi paketleri ve hareketleri.
/// Her soru 1 kredi; soru kademe ve derse uygun öğretmenlerin havuzuna düşer, ilk üstlenen çözer.
class CreditsScreen extends ConsumerWidget {
  const CreditsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    return Scaffold(
      appBar: AppBar(
        leading: const AppBackButton(),
        title: const Text('Soru sor'),
        actions: [
          if (session.isStudent) TextButton(onPressed: () => context.push(Routes.myQuestions), child: const Text('Sorularım')),
        ],
      ),
      body: !session.isSignedIn
          ? const SignInPrompt(
              icon: Icons.photo_camera_rounded,
              title: 'Takıldığın sorunun fotoğrafını çek, öğretmen çözsün',
              message: 'Kredi alıp soru göndermek için giriş yapın ya da ücretsiz hesap oluşturun.',
              next: Routes.ask,
            )
          : !session.isStudent
              ? const EmptyView(icon: Icons.person_off_outlined, title: 'Soru kredisi veli/öğrenci hesabıyla alınır')
              : AsyncBody<Credits>(
                  value: ref.watch(creditsProvider),
                  onRetry: () => ref.invalidate(creditsProvider),
                  builder: (credits) => RefreshIndicator(
                    onRefresh: () async => ref.invalidate(creditsProvider),
                    child: _CreditsBody(credits: credits),
                  ),
                ),
    );
  }
}

class _CreditsBody extends ConsumerStatefulWidget {
  const _CreditsBody({required this.credits});

  final Credits credits;

  @override
  ConsumerState<_CreditsBody> createState() => _CreditsBodyState();
}

class _CreditsBodyState extends ConsumerState<_CreditsBody> {
  CreditPackage? _selected;
  bool _consent = false;
  bool _busy = false;
  String? _error;

  Credits get c => widget.credits;

  @override
  void initState() {
    super.initState();
    // Varsayılan: tek sorudan büyük ilk paket (genelde en avantajlısı ortadadır)
    _selected = c.packages.length > 1 ? c.packages[1] : (c.packages.isEmpty ? null : c.packages.first);
  }

  Future<void> _buy() async {
    final pack = _selected;
    if (pack == null) return;
    if (!_consent) {
      setState(() => _error = 'Ön bilgilendirme formunu ve mesafeli satış sözleşmesini onaylayın.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final (purchase, payment) = await ref.read(apiProvider).buyCredits(pack.credits);
      if (!mounted) return;
      context.push(Routes.creditPayment(purchase.id), extra: payment);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _refund(CreditPurchase p) async {
    final ok = await confirmDialog(
      context,
      title: 'Kredi iadesi',
      message: '${p.credits} soru kredilik paketin kullanılmayan kredileri silinecek ve ${formatMoney(p.refundAmount)} kartınıza iade edilecek. Onaylıyor musunuz?',
      confirmText: 'İade iste',
    );
    if (!ok || !mounted) return;
    try {
      final message = await ref.read(apiProvider).refundCredits(p.id);
      if (!mounted) return;
      showSnack(context, message);
      bumpQuestions(ref);
    } on ApiException catch (error) {
      if (mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final rules = c.rules;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        _BalanceCard(balance: c.balance, hasSubjects: c.subjects.isNotEmpty),
        const SizedBox(height: 16),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ToneBadge(label: 'En geç ${rules.answerHours} saatte çözüm', tone: Tone.brand, icon: Icons.schedule_rounded),
            const ToneBadge(label: 'Çözülmezse kredi iade', tone: Tone.green, icon: Icons.replay_rounded),
            const ToneBadge(label: 'Bir kez ek soru', tone: Tone.sky, icon: Icons.chat_bubble_outline_rounded),
          ],
        ),
        const SectionTitle('Kredi paketleri'),
        Text(
          'Fiyatlara KDV dahildir. Krediler ${rules.validityMonths} ay geçerlidir; ${rules.refundDays} gün içinde kullanılmayan kredilerin iadesini isteyebilirsiniz '
          '(kullanılanlar tek soru fiyatından düşülür).',
          style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13, height: 1.4),
        ),
        const SizedBox(height: 12),
        if (!c.salesOpen) ...[
          const NoticeBox(tone: Tone.amber, title: 'Çok yakında', message: 'Online ödeme altyapımız çok yakında açılıyor; kredi satışı o zaman başlayacak.'),
          const SizedBox(height: 12),
        ],
        for (final p in c.packages)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: _PackageTile(package: p, selected: _selected?.credits == p.credits, onTap: c.salesOpen ? () => setState(() => _selected = p) : null),
          ),
        if (c.salesOpen && _selected != null) ...[
          CheckboxListTile(
            value: _consent,
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            onChanged: (v) => setState(() => _consent = v ?? false),
            title: ConsentText(onOpen: (slug) => context.push(Routes.page(slug))),
          ),
          if (_error != null) ...[NoticeBox(message: _error!, tone: Tone.rose), const SizedBox(height: 8)],
          BusyButton(busy: _busy, onPressed: _buy, label: '${_selected!.title} · ${formatMoney(_selected!.price)} öde', icon: Icons.lock_rounded),
        ],
        if (c.purchases.isNotEmpty) ...[
          const SectionTitle('Paketlerim'),
          for (final p in c.purchases) _PurchaseTile(purchase: p, onRefund: () => _refund(p)),
        ],
        if (c.entries.isNotEmpty) ...[
          const SectionTitle('Kredi hareketleri'),
          SectionCard(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Column(
              children: [
                for (final e in c.entries)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    title: Text(e.kindLabel, style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text([formatCompact(e.createdAt), if (e.note != null) e.note!].join(' · ')),
                    trailing: Text(
                      e.amount > 0 ? '+${e.amount}' : '${e.amount}',
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: e.amount > 0 ? const Color(0xFF047857) : scheme.onSurface),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.balance, required this.hasSubjects});

  final int balance;
  final bool hasSubjects;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(colors: [Color(0xFF312E81), Color(0xFF4F46E5)], begin: Alignment.topLeft, end: Alignment.bottomRight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Soru krediniz', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text('$balance', style: const TextStyle(color: Colors.white, fontSize: 40, fontWeight: FontWeight.w800, height: 1.1)),
          const SizedBox(height: 4),
          const Text('Her soru 1 kredi. Fotoğrafını çek, branş öğretmeni adım adım çözsün.', style: TextStyle(color: Colors.white, height: 1.35)),
          const SizedBox(height: 16),
          if (balance > 0 && hasSubjects)
            FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFFFBBF24), foregroundColor: const Color(0xFF1E1B4B)),
              onPressed: () => context.push(Routes.askQuestion),
              icon: const Icon(Icons.add_a_photo_rounded),
              label: const Text('Soru gönder'),
            )
          else if (balance > 0)
            const Text('Şu an soru çözen öğretmenimiz yok. Çok yakında burada olacak; krediniz güvende.', style: TextStyle(color: Colors.white70))
          else
            const Text('Başlamak için aşağıdan bir kredi paketi seçin.', style: TextStyle(color: Colors.white70)),
        ],
      ),
    );
  }
}

class _PackageTile extends StatelessWidget {
  const _PackageTile({required this.package, required this.selected, this.onTap});

  final CreditPackage package;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: selected ? scheme.primaryContainer.withValues(alpha: 0.5) : scheme.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: selected ? scheme.primary : scheme.outlineVariant, width: selected ? 2 : 1),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Icon(selected ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded, color: selected ? scheme.primary : scheme.outline),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(package.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                    Text('Soru başı ${formatMoney(package.unitPrice)}', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(formatMoney(package.price), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                  if (package.savingPercent > 0) ToneBadge(label: '%${package.savingPercent} avantajlı', tone: Tone.green),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PurchaseTile extends StatelessWidget {
  const _PurchaseTile({required this.purchase, required this.onRefund});

  final CreditPurchase purchase;
  final VoidCallback onRefund;

  @override
  Widget build(BuildContext context) {
    final p = purchase;
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: SectionCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text('${p.credits} soru kredisi', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16))),
                ToneBadge(label: p.expired ? 'Süresi doldu' : p.statusLabel, tone: p.expired ? Tone.slate : (p.isPaid ? Tone.green : Tone.sky)),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              [
                p.code,
                formatMoney(p.price),
                if (p.refundedAmount > 0) '${formatMoney(p.refundedAmount)} iade',
                'Kalan ${p.remaining}',
                if (p.expiresAt != null) 'Son kullanma ${formatDate(p.expiresAt!)}',
              ].join(' · '),
              style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13),
            ),
            if (p.refundAllowed) ...[
              const SizedBox(height: 8),
              OutlinedButton.icon(onPressed: onRefund, icon: const Icon(Icons.undo_rounded, size: 18), label: Text('${formatMoney(p.refundAmount)} iade iste')),
            ],
          ],
        ),
      ),
    );
  }
}
