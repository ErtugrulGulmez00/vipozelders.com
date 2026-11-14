import 'package:flutter/material.dart';

import 'pi_logo.dart';
import 'session.dart';
import 'theme.dart';

/// Kapı simgesi: Pi Koç'ta logodaki eğik mercan kare ve π; özel derste tahta başında öğretmen; kurumda öğrenci grubu.
class DoorIcon extends StatelessWidget {
  const DoorIcon({super.key, required this.door, this.size = 36});

  final Door door;
  final double size;

  @override
  Widget build(BuildContext context) {
    final r = BorderRadius.circular(size * 0.3);
    return switch (door) {
      Door.koc => Transform.rotate(
        angle: -0.105,
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(color: Brand.b600, borderRadius: r),
          alignment: Alignment.center,
          child: PiMark(size: size * 0.66, color: Colors.white),
        ),
      ),
      Door.ozel => _box(const Color(0xFFE3E6FF), r, CustomPaint(painter: _TeacherPainter(const Color(0xFF3B3F9E)))),
      Door.kurum => _box(Brand.gold100, r, CustomPaint(painter: _GroupPainter(Brand.gold700))),
    };
  }

  Widget _box(Color bg, BorderRadius r, Widget painter) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(color: bg, borderRadius: r),
    alignment: Alignment.center,
    child: SizedBox.square(dimension: size * 0.61, child: painter),
  );
}

Paint _stroke(Color color, double s) => Paint()
  ..color = color
  ..style = PaintingStyle.stroke
  ..strokeWidth = 2 * s
  ..strokeCap = StrokeCap.round
  ..strokeJoin = StrokeJoin.round;

/// Tahta başında öğretmen (24×24 çizimden ölçeklenir)
class _TeacherPainter extends CustomPainter {
  _TeacherPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 24;
    final p = _stroke(color, s);
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(9 * s, 3 * s, 13 * s, 10 * s), Radius.circular(1.5 * s)), p);
    canvas.drawLine(Offset(12 * s, 7 * s), Offset(18 * s, 7 * s), p);
    canvas.drawLine(Offset(12 * s, 10 * s), Offset(15 * s, 10 * s), p);
    canvas.drawCircle(Offset(5.5 * s, 9 * s), 2.2 * s, p);
    final body = Path()
      ..moveTo(2 * s, 21 * s)
      ..lineTo(2 * s, 18.5 * s)
      ..arcToPoint(Offset(9 * s, 18.5 * s), radius: Radius.circular(3.5 * s))
      ..lineTo(9 * s, 21 * s);
    canvas.drawPath(body, p);
    canvas.drawLine(Offset(8.5 * s, 15.5 * s), Offset(12 * s, 13 * s), p);
  }

  @override
  bool shouldRepaint(_TeacherPainter old) => old.color != color;
}

/// Öğrenci grubu (kurum)
class _GroupPainter extends CustomPainter {
  _GroupPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 24;
    final p = _stroke(color, s);
    canvas.drawCircle(Offset(12 * s, 7.5 * s), 3 * s, p);
    canvas.drawPath(
      Path()
        ..moveTo(6.5 * s, 20 * s)
        ..arcToPoint(Offset(17.5 * s, 20 * s), radius: Radius.circular(5.5 * s)),
      p,
    );
    canvas.drawCircle(Offset(5 * s, 10 * s), 2.2 * s, p);
    canvas.drawPath(
      Path()
        ..moveTo(1.5 * s, 19 * s)
        ..quadraticBezierTo(1.8 * s, 15.2 * s, 6.1 * s, 15.6 * s),
      p,
    );
    canvas.drawCircle(Offset(19 * s, 10 * s), 2.2 * s, p);
    canvas.drawPath(
      Path()
        ..moveTo(22.5 * s, 19 * s)
        ..quadraticBezierTo(22.2 * s, 15.2 * s, 17.9 * s, 15.6 * s),
      p,
    );
  }

  @override
  bool shouldRepaint(_GroupPainter old) => old.color != color;
}
