import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class ToneBadge extends StatelessWidget {
  const ToneBadge({super.key, required this.label, this.tone = Tone.slate, this.icon});

  final String label;
  final Tone tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final colors = ToneColors.of(tone, Theme.of(context).brightness);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(color: colors.background, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: 13, color: colors.foreground), const SizedBox(width: 4)],
          Flexible(
            child: Text(
              label,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: colors.foreground, height: 1.2),
            ),
          ),
        ],
      ),
    );
  }
}

/// Sitedeki durum renkleriyle ders durumu rozeti.
class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.status, required this.label});

  final String status;
  final String label;

  static Tone toneOf(String status) {
    switch (status) {
      case 'PENDING_PAYMENT':
      case 'PENDING_APPROVAL':
        return Tone.amber;
      case 'CONFIRMED':
        return Tone.green;
      case 'COMPLETED':
        return Tone.brand;
      case 'PAYMENT_FAILED':
      case 'REJECTED':
      case 'CANCELLED_BY_TEACHER':
      case 'NO_SHOW_TEACHER':
        return Tone.rose;
      case 'NO_SHOW_STUDENT':
      case 'DISPUTED':
        return Tone.violet;
      default:
        return Tone.slate;
    }
  }

  @override
  Widget build(BuildContext context) => ToneBadge(label: label, tone: toneOf(status));
}

class VerifiedBadge extends StatelessWidget {
  const VerifiedBadge({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (compact) {
      return Tooltip(
        message: 'Onaylı öğretmen: kimlik ve diploma kontrol edildi',
        child: Icon(Icons.verified_rounded, size: 18, color: Theme.of(context).colorScheme.primary),
      );
    }
    return const ToneBadge(label: 'Onaylı öğretmen', tone: Tone.green, icon: Icons.verified_rounded);
  }
}
