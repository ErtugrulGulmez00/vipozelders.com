import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/format/money.dart';
import '../../core/models/commerce.dart';
import '../../core/providers.dart';

/// "İndirim kodunuz var mı?" alanı: kod denenir, geçerliyse indirim ve ödenecek tutar gösterilir.
/// Kod ödemede sunucuda yeniden doğrulanır. Geçerli kod [onChanged] ile bildirilir (kaldırılınca null).
class CouponField extends ConsumerStatefulWidget {
  const CouponField({super.key, required this.target, this.refId, this.duration, this.credits, required this.onChanged});

  /// booking · credits · subscription · group
  final String target;

  /// booking: offeringId · subscription: planId · group: courseId
  final String? refId;
  final int? duration;
  final int? credits;
  final void Function(String? code, CouponCheck? check) onChanged;

  @override
  ConsumerState<CouponField> createState() => _CouponFieldState();
}

class _CouponFieldState extends ConsumerState<CouponField> {
  final _code = TextEditingController();
  bool _open = false;
  bool _busy = false;
  CouponCheck? _result;

  @override
  void didUpdateWidget(covariant CouponField old) {
    super.didUpdateWidget(old);
    // Paket / süre değişince indirim yeniden hesaplanmalı
    if (_result?.ok == true && (old.refId != widget.refId || old.duration != widget.duration || old.credits != widget.credits)) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _apply());
    }
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _apply() async {
    final code = _code.text.trim();
    if (code.isEmpty) return;
    FocusScope.of(context).unfocus();
    setState(() => _busy = true);
    try {
      final result = await ref.read(apiProvider).checkCoupon(target: widget.target, code: code, ref: widget.refId, duration: widget.duration, credits: widget.credits);
      if (!mounted) return;
      setState(() => _result = result);
      widget.onChanged(result.ok ? code : null, result.ok ? result : null);
    } on ApiException catch (error) {
      if (mounted) setState(() => _result = CouponCheck(ok: false, error: error.message));
      widget.onChanged(null, null);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _clear() {
    _code.clear();
    setState(() => _result = null);
    widget.onChanged(null, null);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    if (!_open) {
      return Align(
        alignment: Alignment.centerLeft,
        child: TextButton.icon(onPressed: () => setState(() => _open = true), icon: const Icon(Icons.local_offer_outlined, size: 18), label: const Text('İndirim kodunuz var mı?')),
      );
    }
    final ok = _result?.ok == true;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: TextField(
                controller: _code,
                enabled: !ok,
                textCapitalization: TextCapitalization.characters,
                autocorrect: false,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _apply(),
                decoration: InputDecoration(
                  labelText: 'İndirim kodu',
                  prefixIcon: const Icon(Icons.local_offer_outlined),
                  errorText: _result != null && !_result!.ok ? _result!.error : null,
                  errorMaxLines: 3,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: ok
                  ? IconButton(tooltip: 'Kodu kaldır', onPressed: _clear, icon: const Icon(Icons.close_rounded))
                  : FilledButton.tonal(
                      onPressed: _busy ? null : _apply,
                      child: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Uygula'),
                    ),
            ),
          ],
        ),
        if (ok)
          Padding(
            padding: const EdgeInsets.only(top: 6, left: 4),
            child: Text(
              '${_result!.label ?? 'İndirim'}: −${formatMoney(_result!.discount)} · ödenecek ${formatMoney(_result!.finalPrice)}',
              style: TextStyle(color: scheme.primary, fontWeight: FontWeight.w700),
            ),
          ),
      ],
    );
  }
}
