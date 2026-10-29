import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Pi Kampüs logosundaki π işareti (sitedeki SVG ile aynı çizim).
class PiMark extends StatelessWidget {
  const PiMark({super.key, this.size = 24, this.color});

  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: size,
      child: CustomPaint(painter: _PiPainter(color ?? IconTheme.of(context).color ?? Colors.black)),
    );
  }
}

class _PiPainter extends CustomPainter {
  _PiPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 24;
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.6 * s
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final top = Path()
      ..moveTo(4.2 * s, 9.2 * s)
      ..cubicTo(4.8 * s, 7.5 * s, 6.0 * s, 6.6 * s, 7.8 * s, 6.6 * s)
      ..lineTo(19.8 * s, 6.6 * s);
    final left = Path()
      ..moveTo(9.6 * s, 6.6 * s)
      ..cubicTo(9.6 * s, 11.6 * s, 9.1 * s, 15.2 * s, 7.2 * s, 18.2 * s);
    final right = Path()
      ..moveTo(15.4 * s, 6.6 * s)
      ..lineTo(15.4 * s, 15.2 * s)
      ..cubicTo(15.4 * s, 17.0 * s, 16.3 * s, 18.0 * s, 17.7 * s, 18.0 * s)
      ..cubicTo(18.7 * s, 18.0 * s, 19.4 * s, 17.5 * s, 19.8 * s, 16.6 * s);

    canvas
      ..drawPath(top, paint)
      ..drawPath(left, paint)
      ..drawPath(right, paint);
  }

  @override
  bool shouldRepaint(_PiPainter oldDelegate) => oldDelegate.color != color;
}

/// Hafif eğik mercan kare içinde beyaz π (sitedeki logo ve uygulama simgesiyle aynı).
class PiBadge extends StatelessWidget {
  const PiBadge({super.key, this.size = 40});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Transform.rotate(
      angle: -0.105, // -6°
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: Brand.b600,
          borderRadius: BorderRadius.circular(size * 0.4),
          boxShadow: [BoxShadow(color: Brand.ink900.withValues(alpha: 0.14), blurRadius: size * 0.16, offset: Offset(0, size * 0.05))],
        ),
        alignment: Alignment.center,
        child: PiMark(size: size * 0.6, color: Colors.white),
      ),
    );
  }
}

/// Logo + site adı.
class PiLogo extends StatelessWidget {
  const PiLogo({super.key, this.light = false, this.size = 36, this.name = 'Pi Kampüs'});

  final bool light;
  final double size;
  final String name;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        PiBadge(size: size),
        SizedBox(width: size * 0.28),
        Text(
          name,
          style: TextStyle(
            fontFamily: AppTheme.displayFamily,
            fontSize: size * 0.52,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.4,
            color: light ? Colors.white : (Theme.of(context).brightness == Brightness.dark ? Colors.white : Brand.ink900),
          ),
        ),
      ],
    );
  }
}
