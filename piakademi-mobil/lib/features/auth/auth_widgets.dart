import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/pi_logo.dart';

/// Giriş/kayıt ekranlarının ortak düzeni: üstte marka, altta form kartı.
class AuthScaffold extends StatelessWidget {
  const AuthScaffold({super.key, required this.title, this.subtitle, required this.children, this.canPop = true});

  final String title;
  final String? subtitle;
  final List<Widget> children;
  final bool canPop;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(statusBarColor: Colors.transparent),
      child: Scaffold(
      backgroundColor: scheme.surface,
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Container(
              decoration: const BoxDecoration(color: Brand.hero),
              padding: EdgeInsets.fromLTRB(20, MediaQuery.paddingOf(context).top + 8, 20, 36),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    height: 48,
                    child: Row(
                      children: [
                        if (canPop && context.canPop())
                          IconButton(
                            tooltip: 'Geri',
                            color: Colors.white,
                            onPressed: () => context.pop(),
                            icon: const Icon(Icons.arrow_back_rounded),
                          )
                        else if (canPop)
                          IconButton(
                            tooltip: 'Ana sayfa',
                            color: Colors.white,
                            onPressed: () => context.go('/'),
                            icon: const Icon(Icons.close_rounded),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  const PiLogo(light: true, size: 40),
                  const SizedBox(height: 22),
                  Text(title, style: const TextStyle(fontFamily: AppTheme.displayFamily, color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: -0.6)),
                  if (subtitle != null) ...[
                    const SizedBox(height: 6),
                    Text(subtitle!, style: const TextStyle(color: Brand.ink200, height: 1.4)),
                  ],
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Transform.translate(
              offset: const Offset(0, -18),
              child: Container(
                decoration: BoxDecoration(
                  color: scheme.surface,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
                ),
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
                child: AutofillGroup(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
                ),
              ),
            ),
          ),
        ],
      ),
      ),
    );
  }
}

class PasswordField extends StatefulWidget {
  const PasswordField({
    super.key,
    required this.controller,
    this.label = 'Şifre',
    this.errorText,
    this.helperText,
    this.validator,
    this.newPassword = false,
    this.onSubmitted,
    this.textInputAction,
  });

  final TextEditingController controller;
  final String label;
  final String? errorText;
  final String? helperText;
  final FormFieldValidator<String>? validator;
  final bool newPassword;
  final ValueChanged<String>? onSubmitted;
  final TextInputAction? textInputAction;

  @override
  State<PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<PasswordField> {
  bool _hidden = true;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: widget.controller,
      obscureText: _hidden,
      autocorrect: false,
      enableSuggestions: false,
      textInputAction: widget.textInputAction,
      autofillHints: [widget.newPassword ? AutofillHints.newPassword : AutofillHints.password],
      validator: widget.validator,
      onFieldSubmitted: widget.onSubmitted,
      decoration: InputDecoration(
        labelText: widget.label,
        errorText: widget.errorText,
        helperText: widget.helperText,
        prefixIcon: const Icon(Icons.lock_outline_rounded),
        suffixIcon: IconButton(
          tooltip: _hidden ? 'Şifreyi göster' : 'Şifreyi gizle',
          onPressed: () => setState(() => _hidden = !_hidden),
          icon: Icon(_hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined),
        ),
      ),
    );
  }
}

/// Sunucudan gelen genel hata (alan dışı) kutusu.
class FormErrorBox extends StatelessWidget {
  const FormErrorBox({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = ToneColors.of(Tone.rose, Theme.of(context).brightness);
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: colors.background, borderRadius: BorderRadius.circular(12)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.error_outline_rounded, color: colors.foreground, size: 20),
          const SizedBox(width: 10),
          Expanded(child: Text(message, style: TextStyle(color: colors.foreground, fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}
