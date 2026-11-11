import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/pi_logo.dart';
import '../../core/session.dart';
import '../../core/theme.dart';

/// Giriş: koç e-postasıyla, öğrenci koçunun verdiği kullanıcı adıyla.
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
      await SessionScope.read(context).login(_id.text, _password.text);
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
                  const Center(child: PiLogo(light: true, size: 44, name: 'Pi Koç')),
                  const SizedBox(height: 12),
                  const Text('Koçluk takibin cebinde: görevler, soru takibi, denemeler ve online görüşme.', textAlign: TextAlign.center, style: TextStyle(color: Brand.ink200)),
                  const SizedBox(height: 28),
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(color: theme.colorScheme.surface, borderRadius: BorderRadius.circular(26)),
                    child: AutofillGroup(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text('Giriş yap', style: theme.textTheme.titleLarge),
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
                  const Text('Öğrenciysen kullanıcı adını ve ilk şifreni koçun verir.\nKoçsan pikampus.com/pi-koc üzerinden ücretsiz başlayabilirsin.', textAlign: TextAlign.center, style: TextStyle(color: Brand.ink300, fontSize: 13)),
                  TextButton(
                    onPressed: () => launchUrl(Uri.parse('${AppConfig.siteUrl}/pi-koc'), mode: LaunchMode.externalApplication),
                    child: const Text('Koç olarak kaydol', style: TextStyle(color: Brand.gold400)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
