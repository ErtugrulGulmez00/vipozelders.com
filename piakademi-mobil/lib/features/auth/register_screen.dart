import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/widgets/feedback.dart';
import 'auth_widgets.dart';
import 'validators.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key, this.next});

  final String? next;

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  String _accountType = 'PARENT';
  bool _kvkk = false;
  bool _terms = false;
  bool _marketing = false;
  bool _busy = false;
  bool _consentError = false;
  ApiException? _error;

  @override
  void dispose() {
    for (final c in [_firstName, _lastName, _email, _phone, _password]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    final valid = _formKey.currentState!.validate();
    setState(() => _consentError = !_kvkk || !_terms);
    if (!valid || !_kvkk || !_terms) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    final router = ref.read(routerProvider);
    final messenger = ScaffoldMessenger.of(context);
    final next = widget.next;
    try {
      await ref.read(sessionProvider.notifier).register(
            firstName: _firstName.text.trim(),
            lastName: _lastName.text.trim(),
            email: _email.text.trim(),
            phone: _phone.text.trim().isEmpty ? null : _phone.text.trim(),
            password: _password.text,
            accountType: _accountType,
            marketing: _marketing,
          );
      messenger.showSnackBar(const SnackBar(content: Text('Hoş geldiniz! Hesabınız oluşturuldu.')));
      router.go(next != null && next.startsWith('/') ? next : Routes.explore);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  TextSpan _link(String text, String slug) => TextSpan(
        text: text,
        style: TextStyle(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.w700, decoration: TextDecoration.underline),
        recognizer: TapGestureRecognizer()..onTap = () => context.push(Routes.page(slug)),
      );

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return AuthScaffold(
      title: 'Ücretsiz hesap oluştur',
      subtitle: 'Öğretmen bulun, ders alın, çocuğunuzun kurumdaki gelişimini takip edin.',
      children: [
        if (_error != null && _error!.fields.isEmpty) FormErrorBox(message: _error!.message),
        if (_error != null && _error!.fields.isNotEmpty && _error!.code != 'VALIDATION') FormErrorBox(message: _error!.message),
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Hesap tipi', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 8),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'PARENT', label: Text('Veliyim'), icon: Icon(Icons.family_restroom_rounded)),
                  ButtonSegment(value: 'STUDENT', label: Text('Öğrenciyim (18+)'), icon: Icon(Icons.school_outlined)),
                ],
                selected: {_accountType},
                onSelectionChanged: (s) => setState(() => _accountType = s.first),
              ),
              const SizedBox(height: 18),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _firstName,
                      textCapitalization: TextCapitalization.words,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.givenName],
                      decoration: InputDecoration(labelText: 'Ad', errorText: _error?.field('firstName')),
                      validator: (v) => requiredText(v, 'Adınızı yazın.', min: 2),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _lastName,
                      textCapitalization: TextCapitalization.words,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.familyName],
                      decoration: InputDecoration(labelText: 'Soyad', errorText: _error?.field('lastName')),
                      validator: (v) => requiredText(v, 'Soyadınızı yazın.', min: 2),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autocorrect: false,
                autofillHints: const [AutofillHints.email],
                decoration: InputDecoration(labelText: 'E-posta', prefixIcon: const Icon(Icons.alternate_email_rounded), errorText: _error?.field('email')),
                validator: emailProblem,
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.telephoneNumber],
                decoration: InputDecoration(
                  labelText: 'Cep telefonu (isteğe bağlı)',
                  hintText: '05XX XXX XX XX',
                  prefixIcon: const Icon(Icons.phone_outlined),
                  errorText: _error?.field('phone'),
                  helperText: 'Ders hatırlatmaları ve öğretmeninizin size ulaşması için.',
                ),
                validator: phoneProblem,
              ),
              const SizedBox(height: 14),
              PasswordField(
                controller: _password,
                newPassword: true,
                textInputAction: TextInputAction.done,
                errorText: _error?.field('password'),
                helperText: 'En az 8 karakter; harf ve rakam içermeli.',
                validator: passwordProblem,
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        CheckboxListTile(
          value: _kvkk,
          onChanged: (v) => setState(() => _kvkk = v ?? false),
          controlAffinity: ListTileControlAffinity.leading,
          contentPadding: EdgeInsets.zero,
          title: Text.rich(TextSpan(children: [_link('KVKK Aydınlatma Metni', 'kvkk-aydinlatma-metni'), const TextSpan(text: '’ni okudum.')]), style: const TextStyle(fontSize: 14)),
        ),
        CheckboxListTile(
          value: _terms,
          onChanged: (v) => setState(() => _terms = v ?? false),
          controlAffinity: ListTileControlAffinity.leading,
          contentPadding: EdgeInsets.zero,
          title: Text.rich(TextSpan(children: [_link('Kullanım Şartları', 'kullanim-sartlari'), const TextSpan(text: '’nı kabul ediyorum.')]), style: const TextStyle(fontSize: 14)),
        ),
        CheckboxListTile(
          value: _marketing,
          onChanged: (v) => setState(() => _marketing = v ?? false),
          controlAffinity: ListTileControlAffinity.leading,
          contentPadding: EdgeInsets.zero,
          title: const Text('Kampanya ve yeniliklerden e-posta/SMS ile haberdar olmak istiyorum (isteğe bağlı).', style: TextStyle(fontSize: 14)),
        ),
        if (_consentError || _error?.field('kvkk') != null || _error?.field('terms') != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              _error?.field('kvkk') ?? _error?.field('terms') ?? 'Devam etmek için aydınlatma metnini ve kullanım şartlarını onaylayın.',
              style: TextStyle(color: scheme.error),
            ),
          ),
        const SizedBox(height: 8),
        BusyButton(busy: _busy, onPressed: _submit, label: 'Hesap oluştur'),
        const SizedBox(height: 16),
        TextButton(
          onPressed: () => context.pushReplacement(Uri(path: Routes.login, queryParameters: widget.next == null ? null : {'devam': widget.next}).toString()),
          child: const Text('Zaten hesabım var — giriş yap'),
        ),
      ],
    );
  }
}
