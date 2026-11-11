import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/session.dart';

/// Şifre değiştirme. İlk girişte (koçun verdiği geçici şifre) zorunludur.
class PasswordScreen extends StatefulWidget {
  const PasswordScreen({super.key, this.firstLogin = false});

  final bool firstLogin;

  @override
  State<PasswordScreen> createState() => _PasswordScreenState();
}

class _PasswordScreenState extends State<PasswordScreen> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _again = TextEditingController();
  bool _busy = false;
  String? _error;

  Future<void> _submit() async {
    if (_next.text != _again.text) {
      setState(() => _error = 'Yeni şifreler aynı değil.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final session = SessionScope.read(context);
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    try {
      final res = await session.api.post('/ben/sifre', {'currentPassword': _current.text, 'newPassword': _next.text});
      messenger.showSnackBar(SnackBar(content: Text(res.str('message', 'Şifreniz değiştirildi.'))));
      if (widget.firstLogin) {
        await session.refreshMe();
      } else {
        navigator.pop();
      }
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Şifre değiştir'),
        actions: [
          if (widget.firstLogin) TextButton(onPressed: () => SessionScope.read(context).logout(), child: const Text('Çıkış')),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (widget.firstLogin)
            const Padding(
              padding: EdgeInsets.only(bottom: 16),
              child: Text('Koçunun verdiği geçici şifreyle girdin. Devam etmek için kendine yeni bir şifre belirle.'),
            ),
          TextField(controller: _current, obscureText: true, decoration: InputDecoration(labelText: widget.firstLogin ? 'Geçici şifre' : 'Mevcut şifre')),
          const SizedBox(height: 12),
          TextField(controller: _next, obscureText: true, decoration: const InputDecoration(labelText: 'Yeni şifre', helperText: 'En az 8 karakter; harf ve rakam içersin.')),
          const SizedBox(height: 12),
          TextField(controller: _again, obscureText: true, decoration: const InputDecoration(labelText: 'Yeni şifre (tekrar)'), onSubmitted: (_) => _submit()),
          if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
          const SizedBox(height: 20),
          FilledButton(onPressed: _busy ? null : _submit, child: Text(_busy ? 'Kaydediliyor…' : 'Şifreyi kaydet')),
        ],
      ),
    );
  }
}
