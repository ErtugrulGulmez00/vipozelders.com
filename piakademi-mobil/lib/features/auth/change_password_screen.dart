import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import 'auth_widgets.dart';
import 'validators.dart';

/// Şifre değiştirme. Geçici şifreyle giren kullanıcı (mustChangePassword) bu ekranı kapatamaz.
class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  ConsumerState<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _repeat = TextEditingController();
  bool _busy = false;
  ApiException? _error;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _repeat.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    final router = ref.read(routerProvider);
    final session = ref.read(sessionProvider);
    final forced = session.mustChangePassword;
    try {
      final message = await ref.read(apiProvider).changePassword(current: _current.text, next: _next.text);
      ref.read(sessionProvider.notifier).passwordChanged();
      if (mounted) showSnack(context, message);
      if (forced) {
        router.go(Routes.homeOf(session.view));
      } else if (mounted && context.canPop()) {
        context.pop();
      }
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final forced = ref.watch(sessionProvider.select((s) => s.mustChangePassword));
    return PopScope(
      canPop: !forced,
      child: AuthScaffold(
        title: forced ? 'Yeni şifrenizi belirleyin' : 'Şifre değiştir',
        subtitle: forced ? 'Size verilen geçici şifreyi değiştirmeden devam edemezsiniz.' : 'Diğer cihazlardaki oturumlarınız kapatılır.',
        canPop: !forced,
        children: [
          if (forced) ...[
            const NoticeBox(message: 'Güvenliğiniz için ilk girişte kendi şifrenizi belirlemeniz gerekiyor.', tone: Tone.amber),
            const SizedBox(height: 16),
          ],
          if (_error != null && _error!.fields.isEmpty) FormErrorBox(message: _error!.message),
          Form(
            key: _formKey,
            child: Column(
              children: [
                PasswordField(
                  controller: _current,
                  label: forced ? 'Geçici şifre' : 'Mevcut şifre',
                  errorText: _error?.field('currentPassword'),
                  textInputAction: TextInputAction.next,
                  validator: (v) => (v ?? '').isEmpty ? 'Mevcut şifrenizi yazın.' : null,
                ),
                const SizedBox(height: 14),
                PasswordField(
                  controller: _next,
                  label: 'Yeni şifre',
                  newPassword: true,
                  errorText: _error?.field('newPassword'),
                  helperText: 'En az 8 karakter; harf ve rakam içermeli.',
                  textInputAction: TextInputAction.next,
                  validator: passwordProblem,
                ),
                const SizedBox(height: 14),
                PasswordField(
                  controller: _repeat,
                  label: 'Yeni şifre (tekrar)',
                  newPassword: true,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _submit(),
                  validator: (v) => v != _next.text ? 'Şifreler aynı değil.' : null,
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          BusyButton(busy: _busy, onPressed: _submit, label: 'Şifreyi kaydet'),
          if (forced) ...[
            const SizedBox(height: 10),
            TextButton(onPressed: () => ref.read(sessionProvider.notifier).logout(), child: const Text('Çıkış yap')),
          ],
        ],
      ),
    );
  }
}
