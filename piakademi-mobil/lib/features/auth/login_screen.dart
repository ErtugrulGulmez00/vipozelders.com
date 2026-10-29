import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/auth/sides.dart';
import '../../core/config.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import 'auth_widgets.dart';

/// İki giriş kapısı, tek hesap (sitedeki /giris ve /kurum-giris):
///  - Özel ders girişi: veli, öğrenci, öğretmen
///  - Kurum girişi: etüt merkezi / dershane personeli, kurumun öğrencisi ve velisi
/// Kişi hangi kapıdan girerse o tarafı görür; o tarafta hesabı yoksa kendi tarafına geçer.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key, this.next, this.kurum = false});

  final String? next;

  /// Kurum kapısıyla açıldı
  final bool kurum;

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  late Side _door = widget.kurum ? Side.kurum : Side.ozel;
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
      await ref.read(sessionProvider.notifier).login(_identifier.text, _password.text, door: _door);
      router.go(next != null && next.startsWith('/') ? next : Routes.homeOf(ref.read(sessionProvider).view));
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
    final kurum = _door == Side.kurum;
    return AuthScaffold(
      title: kurum ? 'Kurum girişi' : 'Giriş yap',
      subtitle: kurum
          ? 'Etüt merkezi ve dershane personeli, kurumun öğrencileri ve velileri buradan girer.'
          : 'Veliler ve öğrenciler e-postasıyla, öğretmenler kullanıcı adıyla giriş yapar.',
      children: [
        _DoorTabs(door: _door, onChanged: (door) => setState(() => _door = door)),
        const SizedBox(height: 20),
        if (notice != null && _error == null) ...[
          NoticeBox(message: notice, tone: Tone.amber),
          const SizedBox(height: 16),
        ],
        if (_error != null && _error!.fields.isEmpty)
          _error!.code == 'ADMIN_NOT_SUPPORTED'
              ? Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: NoticeBox(
                    title: 'Bu hesap web panelinde kullanılır',
                    message: _error!.message,
                    tone: Tone.amber,
                    action: TextButton.icon(
                      onPressed: () => openExternal(context, '${AppConfig.siteUrl}/giris'),
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
        if (kurum) ...[
          Text(
            'Personel ve öğrenci giriş bilgilerini kurum verir; ilk girişte kendi şifrenizi belirlersiniz. Veliler, kurumun davetiyle açtıkları hesapla girer.',
            textAlign: TextAlign.center,
            style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: 10),
          TextButton(
            onPressed: () => openExternal(context, '${AppConfig.siteUrl}/kurumlar-icin'),
            child: const Text('Kurumunuz henüz Pi Kampüs kullanmıyor mu? Kurumlar için'),
          ),
        ] else ...[
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
      ],
    );
  }
}

/// Sitedeki giriş sekmeleri: "Özel ders girişi" / "Kurum girişi".
class _DoorTabs extends StatelessWidget {
  const _DoorTabs({required this.door, required this.onChanged});

  final Side door;
  final ValueChanged<Side> onChanged;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    Widget tab(Side side, String label, String hint) {
      final active = door == side;
      return Expanded(
        child: Semantics(
          selected: active,
          button: true,
          child: Material(
            color: active ? scheme.surface : Colors.transparent,
            elevation: active ? 1 : 0,
            borderRadius: BorderRadius.circular(16),
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () => onChanged(side),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                child: Column(
                  children: [
                    Text(label, textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: active ? scheme.primary : scheme.onSurface)),
                    Text(hint, textAlign: TextAlign.center, style: TextStyle(fontSize: 11.5, color: scheme.onSurfaceVariant)),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: scheme.surfaceContainer, borderRadius: BorderRadius.circular(20)),
      child: Row(
        children: [
          tab(Side.ozel, 'Özel ders girişi', 'Veli · öğrenci · öğretmen'),
          const SizedBox(width: 4),
          tab(Side.kurum, 'Kurum girişi', 'Etüt merkezi / dershane'),
        ],
      ),
    );
  }
}
