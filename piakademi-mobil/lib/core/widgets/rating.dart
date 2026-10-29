import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// 4,67 ★ (3 yorum)
class RatingLine extends StatelessWidget {
  const RatingLine({super.key, required this.average, required this.count, this.size = 14});

  final double average;
  final int count;
  final double size;

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    if (count == 0) {
      // Sitedeki gibi "değerlendirme yok" yerine mavi "Yeni öğretmen" rozeti
      final tone = ToneColors.of(Tone.sky, Theme.of(context).brightness);
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(color: tone.background, borderRadius: BorderRadius.circular(999)),
        child: Text('Yeni öğretmen', style: TextStyle(fontSize: size - 1.5, color: tone.foreground, fontWeight: FontWeight.w700)),
      );
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.star_rounded, size: size + 4, color: Brand.gold400),
        const SizedBox(width: 2),
        Text(formatRating(average), style: TextStyle(fontSize: size, fontWeight: FontWeight.w800)),
        const SizedBox(width: 4),
        Text('($count yorum)', style: TextStyle(fontSize: size - 1, color: muted)),
      ],
    );
  }
}

String formatRating(double value) {
  final rounded = (value * 10).round() / 10;
  return rounded.toStringAsFixed(rounded == rounded.roundToDouble() ? 0 : 1).replaceAll('.', ',');
}

class Stars extends StatelessWidget {
  const Stars({super.key, required this.rating, this.size = 16});

  final int rating;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '5 üzerinden $rating puan',
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(
          5,
          (i) => Icon(i < rating ? Icons.star_rounded : Icons.star_outline_rounded, size: size, color: i < rating ? Brand.gold400 : Brand.slate300),
        ),
      ),
    );
  }
}

/// Dokunarak puan seçme.
class StarInput extends StatelessWidget {
  const StarInput({super.key, required this.value, required this.onChanged, this.size = 40});

  final int value;
  final ValueChanged<int> onChanged;
  final double size;

  static const labels = ['Çok kötü', 'Kötü', 'Orta', 'İyi', 'Çok iyi'];

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(5, (i) {
            final selected = i < value;
            return IconButton(
              tooltip: '${i + 1} yıldız',
              iconSize: size,
              onPressed: () => onChanged(i + 1),
              icon: Icon(selected ? Icons.star_rounded : Icons.star_outline_rounded, color: selected ? Brand.gold400 : Brand.slate300),
            );
          }),
        ),
        if (value > 0) Text(labels[value - 1], style: const TextStyle(fontWeight: FontWeight.w700)),
      ],
    );
  }
}
