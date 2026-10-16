import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import 'auth_widgets.dart';
import 'validators.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  bool _busy = false;
  String? _sent;
  ApiException? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final message = await ref.read(apiProvider).forgotPassword(_email.text.trim());
      if (mounted) setState(() => _sent = message);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Şifremi unuttum',
      subtitle: 'E-posta adresinizi yazın; şifrenizi yenilemeniz için bir bağlantı gönderelim.',
      children: [
        if (_sent != null) ...[
          NoticeBox(title: 'E-postanızı kontrol edin', message: _sent!, tone: Tone.green),
          const SizedBox(height: 16),
          const Text('Bağlantı web sitemizde açılır; yeni şifrenizi belirledikten sonra uygulamaya o şifreyle giriş yapabilirsiniz.'),
        ] else ...[
          if (_error != null && _error!.fields.isEmpty) FormErrorBox(message: _error!.message),
          Form(
            key: _formKey,
            child: TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              autofillHints: const [AutofillHints.email],
              decoration: InputDecoration(labelText: 'E-posta', prefixIcon: const Icon(Icons.alternate_email_rounded), errorText: _error?.field('email')),
              validator: emailProblem,
              onFieldSubmitted: (_) => _submit(),
            ),
          ),
          const SizedBox(height: 18),
          BusyButton(busy: _busy, onPressed: _submit, label: 'Bağlantı gönder'),
          const SizedBox(height: 16),
          Text(
            'Öğretmen hesabınızın şifresini unuttuysanız Pi Kampüs destek ekibine yazın; size geçici şifre verilir.',
            style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 13, height: 1.4),
          ),
        ],
      ],
    );
  }
}
