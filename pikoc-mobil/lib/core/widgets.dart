import 'package:flutter/material.dart';

import 'api.dart';
import 'theme.dart';

/// Yükleniyor / hata / içerik: bir istek sonucunu çizen ortak sarmalayıcı.
class AsyncView<T> extends StatelessWidget {
  const AsyncView({super.key, required this.future, required this.builder, required this.onRetry});

  final Future<T> future;
  final Widget Function(BuildContext context, T data) builder;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<T>(
      future: future,
      builder: (context, snap) {
        if (snap.hasError) return ErrorView(message: errorText(snap.error!), onRetry: onRetry);
        if (!snap.hasData) return const Center(child: CircularProgressIndicator());
        return builder(context, snap.data as T);
      },
    );
  }
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off_rounded, size: 44, color: Theme.of(context).colorScheme.onSurfaceVariant),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton.tonal(onPressed: onRetry, child: const Text('Tekrar dene')),
          ],
        ),
      ),
    );
  }
}

/// Beyaz kart: başlık, isteğe bağlı açıklama ve sağda eylem.
class SectionCard extends StatelessWidget {
  const SectionCard({super.key, required this.title, this.subtitle, this.action, required this.child, this.padding = const EdgeInsets.fromLTRB(16, 0, 16, 16)});

  final String title;
  final String? subtitle;
  final Widget? action;
  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 8, 10),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: theme.textTheme.titleMedium),
                      if (subtitle != null) Text(subtitle!, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                    ],
                  ),
                ),
                ?action,
              ],
            ),
          ),
          Padding(padding: padding, child: child),
        ],
      ),
    );
  }
}

/// Küçük gösterge kutusu (bugünkü görev, bu hafta soru, seri…)
class StatTile extends StatelessWidget {
  const StatTile({super.key, required this.icon, required this.label, required this.value, this.hint, this.color});

  final IconData icon;
  final String label;
  final String value;
  final String? hint;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(icon, size: 16, color: color ?? Brand.b600),
            const SizedBox(width: 6),
            Expanded(child: Text(label, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant), overflow: TextOverflow.ellipsis)),
          ]),
          const SizedBox(height: 6),
          Text(value, style: theme.textTheme.titleLarge),
          if (hint != null) Text(hint!, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
        ],
      ),
    );
  }
}

/// İki sütunlu gösterge ızgarası
class StatGrid extends StatelessWidget {
  const StatGrid({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i += 2) {
      rows.add(Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: IntrinsicHeight(
          child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Expanded(child: children[i]),
            const SizedBox(width: 10),
            Expanded(child: i + 1 < children.length ? children[i + 1] : const SizedBox()),
          ]),
        ),
      ));
    }
    return Column(children: rows);
  }
}

/// Basit sütun grafiği (günlük soru / dakika)
class MiniBars extends StatelessWidget {
  const MiniBars({super.key, required this.values, required this.labels, this.height = 90, this.color = Brand.b500});

  final List<num> values;
  final List<String> labels;
  final double height;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final max = values.fold<num>(0, (m, v) => v > m ? v : m);
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    return SizedBox(
      height: height + 18,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (var i = 0; i < values.length; i++)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Container(
                      height: max == 0 ? 2 : (values[i] / max * height).clamp(2, height).toDouble(),
                      decoration: BoxDecoration(color: values[i] == 0 ? muted.withValues(alpha: 0.2) : color, borderRadius: BorderRadius.circular(4)),
                    ),
                    const SizedBox(height: 4),
                    Text(labels[i], style: TextStyle(fontSize: 9, color: muted), maxLines: 1),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Yatay oran çubuğu (ders doğruluğu, program tamamlanma)
class RatioBar extends StatelessWidget {
  const RatioBar({super.key, required this.label, required this.ratio, required this.trailing});

  final String label;
  final double ratio;
  final String trailing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(children: [
            Expanded(child: Text(label, style: theme.textTheme.bodyMedium)),
            Text(trailing, style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(value: ratio.clamp(0, 1), minHeight: 8, backgroundColor: theme.colorScheme.surfaceContainerHigh, color: Brand.b500),
          ),
        ],
      ),
    );
  }
}

class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, this.tone = Tone.slate});

  final String text;
  final Tone tone;

  @override
  Widget build(BuildContext context) {
    final c = ToneColors.of(tone, Theme.of(context).brightness);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: c.background, borderRadius: BorderRadius.circular(20)),
      child: Text(text, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: c.foreground)),
    );
  }
}

class EmptyNote extends StatelessWidget {
  const EmptyNote(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Text(text, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant)),
    );
  }
}

void showMessage(BuildContext context, String text, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(text), backgroundColor: error ? Theme.of(context).colorScheme.error : null, behavior: SnackBarBehavior.floating));
}

Future<bool> confirm(BuildContext context, String text, {String ok = 'Evet'}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      content: Text(text),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Vazgeç')),
        FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(ok)),
      ],
    ),
  );
  return result ?? false;
}

/// Koyu başlık kartı (sitedeki lacivert karşılama alanı)
class HeroHeader extends StatelessWidget {
  const HeroHeader({super.key, required this.overline, required this.title, this.lines = const [], this.action});

  final String overline;
  final String title;
  final List<String> lines;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
      decoration: BoxDecoration(color: Brand.ink900, borderRadius: BorderRadius.circular(26)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(overline, style: const TextStyle(color: Brand.ink200, fontSize: 13)),
          const SizedBox(height: 4),
          Text(title, style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: Colors.white)),
          for (final line in lines.where((l) => l.isNotEmpty))
            Padding(padding: const EdgeInsets.only(top: 4), child: Text(line, style: const TextStyle(color: Brand.ink200, fontSize: 13))),
          if (action != null) ...[const SizedBox(height: 14), action!],
        ],
      ),
    );
  }
}
