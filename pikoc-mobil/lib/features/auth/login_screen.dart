import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/pi_logo.dart';
import '../../core/session.dart';
import '../../core/theme.dart';

/// Giriş: sitedeki gibi tek hesap, üç kapı (Pi Koç, özel ders, kurum). Hesabın o kapıda tarafı yoksa doğru kapı söylenir.
/// Görünüm her zaman açık renktir (telefon karanlık modda olsa da).
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _id = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _hidden = true;
  String? _error;
  late Door _door = SessionScope.read(context).lastDoor;

  /// Pi Koç öne çıksın diye en solda
  static const _doors = [Door.koc, Door.ozel, Door.kurum];

  Future<void> _submit() async {
    if (_id.text.trim().isEmpty || _password.text.isEmpty) {
      setState(() => _error = 'Kullanıcı adınızı ve şifrenizi yazın.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await SessionScope.read(context).login(_id.text, _password.text, _door);
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _open(String path) => launchUrl(Uri.parse('${AppConfig.siteUrl}$path'), mode: LaunchMode.externalApplication);

  @override
  void dispose() {
    _id.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: AppTheme.light(),
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.dark.copyWith(statusBarColor: Colors.transparent),
        child: Scaffold(
          backgroundColor: Colors.white,
          body: DecoratedBox(
            decoration: const BoxDecoration(
              gradient: RadialGradient(center: Alignment(1, -1), radius: 1.3, colors: [Brand.b100, Colors.white], stops: [0, 0.55]),
            ),
            child: Stack(children: [
              // Silik dev π
              Positioned(right: -110, top: -40, child: PiMark(size: 360, color: Brand.b600.withValues(alpha: 0.07))),
              SafeArea(
                child: LayoutBuilder(
                  builder: (context, box) => SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
                    child: ConstrainedBox(
                      constraints: BoxConstraints(minHeight: box.maxHeight - 44),
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 440),
                          child: IntrinsicHeight(child: _content()),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _content() {
    const label = TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Brand.ink700);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Align(alignment: Alignment.centerLeft, child: PiLogo(size: 40)),
        const SizedBox(height: 40),
        const Text(
          'Tekrar hoş\ngeldiniz.',
          style: TextStyle(fontFamily: AppTheme.displayFamily, fontSize: 38, height: 1.05, fontWeight: FontWeight.w800, letterSpacing: -1, color: Brand.ink900),
        ),
        const SizedBox(height: 8),
        const Text('Hangi taraftan giriyorsunuz?', style: TextStyle(fontSize: 15, color: Brand.ink500)),
        const SizedBox(height: 24),
        Row(children: [
          for (final d in _doors) ...[
            if (d != _doors.first) const SizedBox(width: 8),
            Expanded(
              child: _DoorTile(
                key: Key('door-${d.name}'),
                door: d,
                selected: _door == d,
                onTap: () => setState(() {
                  _door = d;
                  _error = null;
                }),
              ),
            ),
          ],
        ]),
        const SizedBox(height: 26),
        const Text('E-posta veya kullanıcı adı', style: label),
        const SizedBox(height: 6),
        AutofillGroup(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            TextField(
              key: const Key('login-id'),
              controller: _id,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.username],
              textInputAction: TextInputAction.next,
              style: const TextStyle(fontSize: 16, color: Brand.ink900),
              decoration: _field(hint: 'ornek@eposta.com'),
            ),
            const SizedBox(height: 14),
            Row(children: [
              const Expanded(child: Text('Şifre', style: label)),
              GestureDetector(
                onTap: () => _open('/sifremi-unuttum'),
                child: const Padding(
                  padding: EdgeInsets.symmetric(vertical: 4),
                  child: Text('Şifremi unuttum', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Brand.b700)),
                ),
              ),
            ]),
            const SizedBox(height: 6),
            TextField(
              key: const Key('login-password'),
              controller: _password,
              obscureText: _hidden,
              autofillHints: const [AutofillHints.password],
              onSubmitted: (_) => _submit(),
              style: const TextStyle(fontSize: 16, color: Brand.ink900),
              decoration: _field(
                suffix: IconButton(
                  tooltip: _hidden ? 'Şifreyi göster' : 'Şifreyi gizle',
                  icon: Icon(_hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined, color: Brand.ink400),
                  onPressed: () => setState(() => _hidden = !_hidden),
                ),
              ),
            ),
          ]),
        ),
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(_error!, style: const TextStyle(color: Brand.b700, fontWeight: FontWeight.w500)),
        ],
        const SizedBox(height: 20),
        DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            boxShadow: [BoxShadow(color: Brand.b600.withValues(alpha: 0.25), blurRadius: 24, offset: const Offset(0, 10))],
          ),
          child: FilledButton(
            key: const Key('login-submit'),
            onPressed: _busy ? null : _submit,
            style: FilledButton.styleFrom(
              backgroundColor: Brand.b600,
              foregroundColor: Colors.white,
              minimumSize: const Size.fromHeight(54),
              shape: const StadiumBorder(),
              textStyle: const TextStyle(fontFamily: AppTheme.fontFamily, fontSize: 16, fontWeight: FontWeight.w700),
            ),
            child: _busy
                ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                : Text(switch (_door) {
                    Door.koc => "Pi Koç'a giriş yap",
                    Door.ozel => 'Özel derse giriş yap',
                    Door.kurum => 'Kuruma giriş yap',
                  }),
          ),
        ),
        const Spacer(),
        const SizedBox(height: 28),
        ..._footer(),
      ],
    );
  }

  InputDecoration _field({String? hint, Widget? suffix}) {
    final border = OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Brand.ink100));
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: Brand.ink400),
      filled: true,
      fillColor: Brand.ink50,
      suffixIcon: suffix,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: border,
      enabledBorder: border,
      focusedBorder: border.copyWith(borderSide: const BorderSide(color: Brand.b600, width: 1.6)),
    );
  }

  /// Kapıya göre kayıt düğmesi ve kısa not
  List<Widget> _footer() {
    Widget primary(String text, String path) => OutlinedButton(
          onPressed: () => _open(path),
          style: OutlinedButton.styleFrom(
            backgroundColor: Brand.b50,
            foregroundColor: Brand.b700,
            side: const BorderSide(color: Brand.b200, width: 1.5),
            minimumSize: const Size.fromHeight(52),
            shape: const StadiumBorder(),
            textStyle: const TextStyle(fontFamily: AppTheme.fontFamily, fontSize: 17, fontWeight: FontWeight.w700),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Flexible(child: Text(text, overflow: TextOverflow.ellipsis)),
            const SizedBox(width: 8),
            const Icon(Icons.arrow_forward_rounded, size: 19),
          ]),
        );
    Widget note(String text) => Text(text, textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: Brand.ink500));
    Widget link(String text, String path) => TextButton(
          onPressed: () => _open(path),
          child: Text(text, style: const TextStyle(color: Brand.b700, fontWeight: FontWeight.w700)),
        );
    return switch (_door) {
      Door.koc => [primary('Koç olarak ücretsiz başlayın', '/pi-koc'), const SizedBox(height: 10), note('Öğrenciyseniz bilgilerinizi koçunuz verir.')],
      Door.ozel => [
          primary('Öğretmen olarak başvurun', '/ogretmen-ol'),
          const SizedBox(height: 4),
          link('Veli / öğrenci olarak kaydolun', '/kayit'),
          note('Öğretmen bulmak ve ders talebi göndermek ücretsizdir.'),
        ],
      Door.kurum => [primary('Kurumunuz için paneli inceleyin', '/kurumlar-icin'), const SizedBox(height: 10), note('Kurum personelinin giriş bilgilerini kurum yöneticisi verir.')],
    };
  }
}

/// Kapı kutusu: renkli simge kutusu + ad. Pi Koç'ta logodaki eğik mercan kare ve π.
class _DoorTile extends StatelessWidget {
  const _DoorTile({super.key, required this.door, required this.selected, required this.onTap});

  final Door door;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final icon = switch (door) {
      Door.koc => Transform.rotate(
          angle: -0.105,
          child: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: Brand.b600, borderRadius: BorderRadius.circular(11)),
            alignment: Alignment.center,
            child: const PiMark(size: 24, color: Colors.white),
          ),
        ),
      Door.ozel => _iconBox(const Color(0xFFE3E6FF), CustomPaint(painter: _TeacherPainter(const Color(0xFF3B3F9E)))),
      Door.kurum => _iconBox(Brand.gold100, CustomPaint(painter: _GroupPainter(Brand.gold700))),
    };
    return Semantics(
      selected: selected,
      button: true,
      label: '${door.label} girişi',
      excludeSemantics: true,
      child: Material(
        color: selected ? Brand.b50 : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(color: selected ? Brand.b600 : Brand.ink100, width: selected ? 1.5 : 1),
        ),
        shadowColor: Brand.b600.withValues(alpha: 0.3),
        elevation: selected ? 4 : 0,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          child: SizedBox(
            height: 84,
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              icon,
              const SizedBox(height: 7),
              Text(door.label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: selected ? Brand.b700 : Brand.ink700)),
            ]),
          ),
        ),
      ),
    );
  }

  static Widget _iconBox(Color bg, Widget painter) => Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(11)),
        alignment: Alignment.center,
        child: SizedBox.square(dimension: 22, child: painter),
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
