import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/format/money.dart';
import '../../core/models/commerce.dart';
import '../../core/models/teacher.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/avatar.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/states.dart';
import '../booking/booking_screen.dart';
import '../shared/coupon_field.dart';
import '../shared/data.dart';
import '../shared/purchase_status_screen.dart';
import '../shared/widgets.dart';

/// Aylık soru aboneliği: öğretmenin kendi soru çözüm planı. Dönem ödemeyle hemen başlar (otomatik çekim yok);
/// abone soruları havuza düşmeden doğrudan öğretmene gelir, kredi harcamaz.
class SubscribeScreen extends ConsumerWidget {
  const SubscribeScreen({super.key, required this.slug, required this.planId});

  final String slug;
  final String planId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(leading: const AppBackButton(), title: const Text('Soru aboneliği')),
      body: AsyncBody<TeacherProfile>(
        value: ref.watch(teacherProfileProvider(slug)),
        onRetry: () => ref.invalidate(teacherProfileProvider(slug)),
        builder: (teacher) {
          final plan = teacher.questionPlans.where((p) => p.id == planId).firstOrNull;
          if (plan == null) return const EmptyView(icon: Icons.event_busy_rounded, title: 'Bu abonelik şu an satışta değil');
          return _SubscribeForm(teacher: teacher, plan: plan);
        },
      ),
    );
  }
}

class _SubscribeForm extends ConsumerStatefulWidget {
  const _SubscribeForm({required this.teacher, required this.plan});

  final TeacherProfile teacher;
  final QuestionPlan plan;

  @override
  ConsumerState<_SubscribeForm> createState() => _SubscribeFormState();
}

class _SubscribeFormState extends ConsumerState<_SubscribeForm> {
  bool _consent = false;
  bool _busy = false;
  String? _error;
  String? _couponCode;
  CouponCheck? _coupon;

  Future<void> _buy() async {
    if (!_consent) {
      setState(() => _error = 'Sözleşmeleri ve cayma hakkı bilgilendirmesini onaylayın.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final (sub, payment) = await ref.read(apiProvider).subscribe(widget.plan.id, couponCode: _couponCode);
      if (!mounted) return;
      context.pushReplacement(Routes.purchasePayment(PurchaseKind.subscription, sub.id), extra: payment);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.teacher;
    final p = widget.plan;
    final scheme = Theme.of(context).colorScheme;
    final price = _coupon?.finalPrice ?? p.price;
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              Row(
                children: [
                  Avatar(name: t.name, photoUrl: t.photoUrl, size: 48),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(t.name, style: Theme.of(context).textTheme.titleMedium),
                        Text(p.title, style: TextStyle(color: scheme.onSurfaceVariant)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              SectionCard(
                title: '${p.days} günlük soru aboneliği',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    InfoRow(label: 'Günlük soru', value: 'En fazla ${p.dailyLimit}'),
                    InfoRow(label: 'Cevap süresi', value: 'En geç ${p.answerHours} saat'),
                    InfoRow(label: 'Ücret', value: '${formatMoney(p.price)} / ${p.days} gün'),
                    if (p.description != null) ...[const SizedBox(height: 8), Text(p.description!)],
                  ],
                ),
              ),
              const SizedBox(height: 12),
              const NoticeBox(
                tone: Tone.sky,
                icon: Icons.info_outline_rounded,
                message:
                    'Sorularınız havuza düşmeden doğrudan bu öğretmene gelir ve kredi harcamaz. Otomatik çekim yoktur; dönem bitmeden yenileme hatırlatması gelir. Abonelik ödemeyle hemen başladığı için cayma hakkı kullanılamaz.',
              ),
              const SizedBox(height: 8),
              CouponField(
                target: 'subscription',
                refId: p.id,
                onChanged: (code, check) => setState(() {
                  _couponCode = code;
                  _coupon = check;
                }),
              ),
              CheckboxListTile(
                value: _consent,
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                onChanged: (v) => setState(() => _consent = v ?? false),
                title: ConsentText(onOpen: (slug) => context.push(Routes.page(slug))),
                subtitle: const Text('Hizmetin hemen başlamasını istiyorum; cayma hakkım olmadığını biliyorum.'),
              ),
              if (_error != null) NoticeBox(message: _error!, tone: Tone.rose),
            ],
          ),
        ),
        SafeArea(
          top: false,
          child: Container(
            decoration: BoxDecoration(color: scheme.surface, border: Border(top: BorderSide(color: scheme.outlineVariant))),
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
            child: Row(
              children: [
                Expanded(child: Text(formatMoney(price), style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w800))),
                Expanded(child: BusyButton(busy: _busy, onPressed: _buy, label: 'Abone ol', icon: Icons.lock_rounded)),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
