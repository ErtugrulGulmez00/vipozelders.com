import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/format/money.dart';
import '../../core/models/center.dart';
import '../../core/theme/app_theme.dart';

/// Deneme net gelişimi: öğrencinin neti ve kurum ortalaması.
class NetTrendChart extends StatelessWidget {
  const NetTrendChart({super.key, required this.points, this.maxNet, this.height = 200});

  final List<TrendPoint> points;
  final double? maxNet;
  final double height;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final ordered = [...points]..sort((a, b) => a.date.compareTo(b.date));
    final peak = ordered.fold<double>(0, (m, p) => math.max(m, math.max(p.net, p.average ?? 0)));
    final double top = maxNet != null && maxNet! > 0 ? math.max(maxNet!, peak) : (peak <= 0 ? 10.0 : (peak * 1.15).ceilToDouble());
    final last = ordered.isEmpty ? null : ordered.last;
    return Semantics(
      label: last == null ? 'Net gelişimi' : 'Net gelişimi, son deneme ${formatNet(last.net)} net',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            height: height,
            width: double.infinity,
            child: CustomPaint(
              painter: _TrendPainter(
                points: ordered,
                top: top,
                lineColor: scheme.primary,
                averageColor: Brand.gold500,
                gridColor: scheme.outlineVariant,
                labelColor: scheme.onSurfaceVariant,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 16,
            children: [
              _Legend(color: scheme.primary, label: 'Net'),
              const _Legend(color: Brand.gold500, label: 'Kurum ortalaması', dashed: true),
            ],
          ),
        ],
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend({required this.color, required this.label, this.dashed = false});

  final Color color;
  final String label;
  final bool dashed;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 18, height: 3, decoration: BoxDecoration(color: dashed ? color.withValues(alpha: 0.7) : color, borderRadius: BorderRadius.circular(2))),
        const SizedBox(width: 6),
        Text(label, style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
      ],
    );
  }
}

class _TrendPainter extends CustomPainter {
  _TrendPainter({required this.points, required this.top, required this.lineColor, required this.averageColor, required this.gridColor, required this.labelColor});

  final List<TrendPoint> points;
  final double top;
  final Color lineColor;
  final Color averageColor;
  final Color gridColor;
  final Color labelColor;

  @override
  void paint(Canvas canvas, Size size) {
    const left = 34.0;
    const bottom = 22.0;
    const right = 8.0;
    const topPad = 10.0;
    final chart = Rect.fromLTRB(left, topPad, size.width - right, size.height - bottom);
    final grid = Paint()
      ..color = gridColor
      ..strokeWidth = 1;

    // Yatay çizgiler ve değerler
    for (var i = 0; i <= 4; i++) {
      final y = chart.bottom - chart.height * i / 4;
      canvas.drawLine(Offset(chart.left, y), Offset(chart.right, y), grid);
      _text(canvas, formatNet(top * i / 4), Offset(0, y - 7), width: left - 6, align: TextAlign.right);
    }
    if (points.isEmpty) return;

    Offset at(int i, double value) {
      final x = points.length == 1 ? chart.center.dx : chart.left + chart.width * i / (points.length - 1);
      final y = chart.bottom - chart.height * (value / top).clamp(0, 1);
      return Offset(x, y);
    }

    // Kurum ortalaması (kesikli)
    final avgPaint = Paint()
      ..color = averageColor
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;
    final averages = [for (var i = 0; i < points.length; i++) if (points[i].average != null) at(i, points[i].average!)];
    for (var i = 0; i < averages.length - 1; i++) {
      _dashed(canvas, averages[i], averages[i + 1], avgPaint);
    }

    // Öğrencinin neti
    final linePaint = Paint()
      ..color = lineColor
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final path = Path();
    for (var i = 0; i < points.length; i++) {
      final p = at(i, points[i].net);
      if (i == 0) {
        path.moveTo(p.dx, p.dy);
      } else {
        path.lineTo(p.dx, p.dy);
      }
    }
    final fill = Path.from(path)
      ..lineTo(at(points.length - 1, 0).dx, chart.bottom)
      ..lineTo(at(0, 0).dx, chart.bottom)
      ..close();
    canvas.drawPath(fill, Paint()..color = lineColor.withValues(alpha: 0.08));
    canvas.drawPath(path, linePaint);

    for (var i = 0; i < points.length; i++) {
      final p = at(i, points[i].net);
      canvas.drawCircle(p, 4.5, Paint()..color = lineColor);
      canvas.drawCircle(p, 2, Paint()..color = Colors.white);
      // Son noktada değer
      if (i == points.length - 1) _text(canvas, formatNet(points[i].net), Offset(p.dx - 30, p.dy - 22), width: 60, align: TextAlign.center, bold: true, color: lineColor);
      // Alt etiket: tarih (gün.ay)
      final date = points[i].date;
      final label = date.length >= 10 ? '${date.substring(8, 10)}.${date.substring(5, 7)}' : date;
      if (points.length <= 6 || i % ((points.length / 6).ceil()) == 0 || i == points.length - 1) {
        _text(canvas, label, Offset(p.dx - 22, chart.bottom + 5), width: 44, align: TextAlign.center);
      }
    }
  }

  void _dashed(Canvas canvas, Offset a, Offset b, Paint paint) {
    const dash = 6.0;
    const gap = 4.0;
    final total = (b - a).distance;
    final direction = (b - a) / total;
    var drawn = 0.0;
    while (drawn < total) {
      final start = a + direction * drawn;
      final end = a + direction * math.min(drawn + dash, total);
      canvas.drawLine(start, end, paint);
      drawn += dash + gap;
    }
  }

  void _text(Canvas canvas, String text, Offset offset, {required double width, TextAlign align = TextAlign.left, bool bold = false, Color? color}) {
    final painter = TextPainter(
      text: TextSpan(text: text, style: TextStyle(fontSize: 10.5, color: color ?? labelColor, fontWeight: bold ? FontWeight.w800 : FontWeight.w500, fontFamily: AppTheme.fontFamily)),
      textAlign: align,
      textDirection: TextDirection.ltr,
      maxLines: 1,
    )..layout(minWidth: width, maxWidth: width);
    painter.paint(canvas, offset);
  }

  @override
  bool shouldRepaint(_TrendPainter oldDelegate) => oldDelegate.points != points || oldDelegate.top != top || oldDelegate.lineColor != lineColor;
}
