import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Başlıklı kart bölümü.
class SectionCard extends StatelessWidget {
  const SectionCard({super.key, this.title, this.subtitle, this.trailing, required this.child, this.padding = const EdgeInsets.all(16), this.color});

  final String? title;
  final String? subtitle;
  final Widget? trailing;
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      color: color,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (title != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 12, 0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title!, style: Theme.of(context).textTheme.titleMedium),
                        if (subtitle != null) ...[
                          const SizedBox(height: 2),
                          Text(subtitle!, style: TextStyle(fontSize: 13, color: scheme.onSurfaceVariant)),
                        ],
                      ],
                    ),
                  ),
                  ?trailing,
                ],
              ),
            ),
          Padding(padding: padding, child: child),
        ],
      ),
    );
  }
}

/// Etiket — değer satırı.
class InfoRow extends StatelessWidget {
  const InfoRow({super.key, required this.label, required this.value, this.icon});

  final String label;
  final String value;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (icon != null) ...[Icon(icon, size: 18, color: scheme.onSurfaceVariant), const SizedBox(width: 10)],
          SizedBox(
            width: 110,
            child: Text(label, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 14)),
          ),
          Expanded(child: SelectableText(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14))),
        ],
      ),
    );
  }
}

/// Küçük istatistik kutusu.
class StatTile extends StatelessWidget {
  const StatTile({super.key, required this.label, required this.value, this.hint, this.icon, this.hintColor, this.onTap});

  final String label;
  final String value;
  final String? hint;
  final IconData? icon;
  final Color? hintColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  if (icon != null) ...[Icon(icon, size: 16, color: scheme.primary), const SizedBox(width: 6)],
                  Expanded(
                    child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: scheme.onSurfaceVariant, fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: -0.4)),
              ),
              if (hint != null) ...[
                const SizedBox(height: 2),
                Text(hint!, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: hintColor ?? scheme.onSurfaceVariant)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Oran çubuğu (0-1). Renk oranına göre yeşil / sarı / kırmızı.
class RateBar extends StatelessWidget {
  const RateBar({super.key, required this.value, this.color, this.height = 8});

  final double value;
  final Color? color;
  final double height;

  static Color colorFor(double rate) {
    if (rate >= 0.7) return const Color(0xFF10B981);
    if (rate >= 0.5) return Brand.gold500;
    return const Color(0xFFF43F5E);
  }

  @override
  Widget build(BuildContext context) {
    final clamped = value.clamp(0.0, 1.0);
    return ClipRRect(
      borderRadius: BorderRadius.circular(height),
      child: LinearProgressIndicator(
        value: clamped,
        minHeight: height,
        backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
        color: color ?? colorFor(clamped),
      ),
    );
  }
}

/// Bilgi / uyarı kutusu.
class NoticeBox extends StatelessWidget {
  const NoticeBox({super.key, required this.message, this.title, this.tone = Tone.sky, this.icon, this.action});

  final String message;
  final String? title;
  final Tone tone;
  final IconData? icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final colors = ToneColors.of(tone, Theme.of(context).brightness);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: colors.background, borderRadius: BorderRadius.circular(14)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon ?? _iconFor(tone), color: colors.foreground, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title != null) Text(title!, style: TextStyle(fontWeight: FontWeight.w800, color: colors.foreground)),
                if (title != null) const SizedBox(height: 2),
                Text(message, style: TextStyle(color: colors.foreground, height: 1.4)),
                if (action != null) ...[const SizedBox(height: 8), action!],
              ],
            ),
          ),
        ],
      ),
    );
  }

  static IconData _iconFor(Tone tone) {
    switch (tone) {
      case Tone.rose:
        return Icons.error_outline_rounded;
      case Tone.amber:
        return Icons.schedule_rounded;
      case Tone.green:
        return Icons.check_circle_outline_rounded;
      default:
        return Icons.info_outline_rounded;
    }
  }
}

/// Sekme/ekran içi başlık.
class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.action, this.padding = const EdgeInsets.fromLTRB(16, 20, 8, 8)});

  final String text;
  final Widget? action;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Row(
        children: [
          Expanded(child: Text(text, style: Theme.of(context).textTheme.titleLarge)),
          ?action,
        ],
      ),
    );
  }
}
