import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/config.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import 'auth_widgets.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key, this.next});

  final String? next;

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  ApiException? _error;

  @override
  void dispose() {
    _identifier.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      // Oturum açılınca yönlendirici bu sayfayı yeniden kurabilir; yönlendirme ekrandan bağımsız yapılır.
      final router = ref.read(routerProvider);
      final next = widget.next;
      final me = await ref.read(sessionProvider.notifier).login(_identifier.text, _password.text);
      router.go(next != null && next.startsWith('/') ? next : (me.isTeacher ? Routes.teacherHome : Routes.explore));
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error);
    } catch (error) {
      if (mounted) setState(() => _error = ApiException(code: 'INTERNAL', message: errorMessage(error)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final notice = ref.watch(sessionProvider.select((s) => s.notice));
    final scheme = Theme.of(context).colorScheme;
    final centerAccount = _error?.code == 'CENTER_NOT_SUPPORTED' || _error?.code == 'ADMIN_NOT_SUPPORTED';
    return AuthScaffold(
      title: 'Giriş yap',
      subtitle: 'Veliler ve öğrenciler e-postasıyla, öğretmenler kullanıcı adıyla giriş yapar.',
      children: [
        if (notice != null && _error == null) ...[
          NoticeBox(message: notice, tone: Tone.amber),
          const SizedBox(height: 16),
        ],
        if (_error != null && _error!.fields.isEmpty)
          centerAccount
              ? Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: NoticeBox(
                    title: 'Bu hesap web panelinde kullanılır',
                    message: _error!.message,
                    tone: Tone.amber,
                    action: TextButton.icon(
                      onPressed: () => openExternal(context, _error!.code == 'CENTER_NOT_SUPPORTED' ? '${AppConfig.siteUrl}/kurum-giris' : '${AppConfig.siteUrl}/giris'),
                      icon: const Icon(Icons.open_in_new_rounded, size: 18),
                      label: const Text('Web panelini aç'),
                    ),
                  ),
                )
              : FormErrorBox(message: _error!.message),
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _identifier,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autocorrect: false,
                autofillHints: const [AutofillHints.email, AutofillHints.username],
                decoration: InputDecoration(
                  labelText: 'E-posta veya kullanıcı adı',
                  prefixIcon: const Icon(Icons.person_outline_rounded),
                  errorText: _error?.field('identifier'),
                ),
                validator: (v) => (v ?? '').trim().isEmpty ? 'E-posta veya kullanıcı adınızı yazın.' : null,
              ),
              const SizedBox(height: 14),
              PasswordField(
                controller: _password,
                errorText: _error?.field('password'),
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _submit(),
                validator: (v) => (v ?? '').isEmpty ? 'Şifrenizi yazın.' : null,
              ),
            ],
          ),
        ),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(onPressed: () => context.push(Routes.forgot), child: const Text('Şifremi unuttum')),
        ),
        const SizedBox(height: 8),
        BusyButton(busy: _busy, onPressed: _submit, label: 'Giriş yap'),
        const SizedBox(height: 22),
        Row(
          children: [
            const Expanded(child: Divider()),
            Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: Text('Hesabınız yok mu?', style: TextStyle(color: scheme.onSurfaceVariant))),
            const Expanded(child: Divider()),
          ],
        ),
        const SizedBox(height: 14),
        OutlinedButton(
          onPressed: () => context.pushReplacement(Uri(path: Routes.register, queryParameters: widget.next == null ? null : {'devam': widget.next}).toString()),
          child: const Text('Veli / öğrenci olarak kayıt ol'),
        ),
        const SizedBox(height: 18),
        Text(
          'Öğretmen hesapları Pi Kampüs ekibi tarafından açılır. Öğretmen olmak için web sitemizdeki başvuru formunu doldurabilirsiniz.',
          textAlign: TextAlign.center,
          style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13, height: 1.4),
        ),
        TextButton(
          onPressed: () => openExternal(context, '${AppConfig.siteUrl}/ogretmen-ol'),
          child: const Text('Öğretmen başvurusu'),
        ),
      ],
    );
  }
}
