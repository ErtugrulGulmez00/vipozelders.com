import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/pi_logo.dart';
import '../../core/session.dart';
import '../../core/theme.dart';

/// Giriş: sitedeki gibi tek hesap, üç kapı (özel ders, kurum, Pi Koç). Hesabın o kapıda tarafı yoksa doğru kapı söylenir.
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

  static const _hints = {
    Door.ozel: 'Veliler, öğrenciler ve özel ders öğretmenleri',
    Door.kurum: 'Etüt merkezi personeli ve kurumun velileri',
    Door.koc: 'Öğrenci koçları ve öğrencileri',
  };

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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: Brand.ink900,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Center(child: PiLogo(light: true, size: 44, name: 'Pi Kampüs')),
                  const SizedBox(height: 12),
                  const Text('Etüt merkezi paneli, Pi Koç ve özel ders tek uygulamada.', textAlign: TextAlign.center, style: TextStyle(color: Brand.ink200)),
                  const SizedBox(height: 24),
                  // Giriş kapıları
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(16)),
                    child: Row(children: [
                      for (final d in Door.values)
                        Expanded(
                          child: GestureDetector(
                            key: Key('door-${d.name}'),
                            onTap: () => setState(() {
                              _door = d;
                              _error = null;
                            }),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 180),
                              padding: const EdgeInsets.symmetric(vertical: 11),
                              decoration: BoxDecoration(color: _door == d ? Brand.b600 : Colors.transparent, borderRadius: BorderRadius.circular(12)),
                              child: Text(d.label, textAlign: TextAlign.center, style: TextStyle(color: _door == d ? Colors.white : Brand.ink200, fontWeight: FontWeight.w700)),
                            ),
                          ),
                        ),
                    ]),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(color: theme.colorScheme.surface, borderRadius: BorderRadius.circular(26)),
                    child: AutofillGroup(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text('${_door.label} girişi', style: theme.textTheme.titleLarge),
                          const SizedBox(height: 2),
                          Text(_hints[_door]!, style: theme.textTheme.bodySmall),
                          const SizedBox(height: 16),
                          TextField(
                            key: const Key('login-id'),
                            controller: _id,
                            keyboardType: TextInputType.emailAddress,
                            autofillHints: const [AutofillHints.username],
                            textInputAction: TextInputAction.next,
                            decoration: const InputDecoration(labelText: 'E-posta veya kullanıcı adı'),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            key: const Key('login-password'),
                            controller: _password,
                            obscureText: _hidden,
                            autofillHints: const [AutofillHints.password],
                            onSubmitted: (_) => _submit(),
                            decoration: InputDecoration(
                              labelText: 'Şifre',
                              suffixIcon: IconButton(
                                tooltip: _hidden ? 'Şifreyi göster' : 'Şifreyi gizle',
                                icon: Icon(_hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                                onPressed: () => setState(() => _hidden = !_hidden),
                              ),
                            ),
                          ),
                          if (_error != null) ...[
                            const SizedBox(height: 12),
                            Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
                          ],
                          const SizedBox(height: 18),
                          FilledButton(
                            key: const Key('login-submit'),
                            onPressed: _busy ? null : _submit,
                            child: _busy ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white)) : const Text('Giriş yap'),
                          ),
                          const SizedBox(height: 8),
                          TextButton(
                            onPressed: () => launchUrl(Uri.parse('${AppConfig.siteUrl}/sifremi-unuttum'), mode: LaunchMode.externalApplication),
                            child: const Text('Şifremi unuttum'),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  ..._footer(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Kapıya göre kısa açıklama ve kayıt bağlantısı
  List<Widget> _footer() {
    Widget link(String text, String path) => TextButton(
          onPressed: () => launchUrl(Uri.parse('${AppConfig.siteUrl}$path'), mode: LaunchMode.externalApplication),
          child: Text(text, style: const TextStyle(color: Brand.gold400)),
        );
    const note = TextStyle(color: Brand.ink300, fontSize: 13);
    return switch (_door) {
      Door.ozel => [
          const Text('Öğretmen bulmak ve ders talebi göndermek ücretsizdir.', textAlign: TextAlign.center, style: note),
          link('Veli / öğrenci olarak kaydol', '/kayit'),
          link('Öğretmen olarak başvur', '/ogretmen-ol'),
        ],
      Door.kurum => [
          const Text('Kurum personelinin giriş bilgilerini kurum yöneticisi verir.', textAlign: TextAlign.center, style: note),
          link('Kurumunuz için paneli inceleyin', '/kurumlar-icin'),
        ],
      Door.koc => [
          const Text('Öğrenciysen kullanıcı adını ve ilk şifreni koçun verir.', textAlign: TextAlign.center, style: note),
          link('Koç olarak ücretsiz başla', '/pi-koc'),
        ],
    };
  }
}
