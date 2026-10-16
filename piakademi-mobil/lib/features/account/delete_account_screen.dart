import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';

/// Hesap silme talebi (App Store ve Google Play zorunluluğu).
class DeleteAccountScreen extends ConsumerStatefulWidget {
  const DeleteAccountScreen({super.key});

  @override
  ConsumerState<DeleteAccountScreen> createState() => _DeleteAccountScreenState();
}

class _DeleteAccountScreenState extends ConsumerState<DeleteAccountScreen> {
  final _reason = TextEditingController();
  bool _confirmed = false;
  bool _busy = false;
  String? _done;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _busy = true);
    try {
      final message = await ref.read(apiProvider).requestDeletion(_reason.text.trim());
      if (mounted) setState(() => _done = message);
    } on ApiException catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Hesabımı sil')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (_done != null) ...[
            NoticeBox(title: 'Talebiniz alındı', message: _done!, tone: Tone.green),
            const SizedBox(height: 20),
            FilledButton(onPressed: () => context.pop(), child: const Text('Tamam')),
            const SizedBox(height: 10),
            OutlinedButton(onPressed: () => ref.read(sessionProvider.notifier).logout(), child: const Text('Çıkış yap')),
          ] else ...[
            const NoticeBox(
              tone: Tone.amber,
              title: 'Hesap silme talebi',
              message:
                  'Talebiniz ekibimize iletilir. Açık dersleriniz, iadeleriniz ve yasal saklama yükümlülükleri kontrol edildikten sonra hesabınız en geç 30 gün içinde silinir ve size e-postayla bilgi verilir.',
            ),
            const SizedBox(height: 16),
            Text('Silinince:', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 6),
            for (final line in const [
              'Profil bilgileriniz, favorileriniz ve bildirimleriniz silinir.',
              'Kurum (veli portalı) bağlantılarınız kaldırılır.',
              'Fatura ve ödeme kayıtları yasal süre boyunca saklanır.',
            ])
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.circle, size: 6, color: scheme.onSurfaceVariant),
                    const SizedBox(width: 8),
                    Expanded(child: Text(line, style: TextStyle(color: scheme.onSurfaceVariant))),
                  ],
                ),
              ),
            const SizedBox(height: 16),
            TextField(
              controller: _reason,
              maxLines: 3,
              maxLength: 500,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(labelText: 'Neden ayrılıyorsunuz? (isteğe bağlı)'),
            ),
            CheckboxListTile(
              value: _confirmed,
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              onChanged: (v) => setState(() => _confirmed = v ?? false),
              title: const Text('Hesabımın silinmesini istiyorum.'),
            ),
            const SizedBox(height: 12),
            BusyButton(busy: _busy, onPressed: _confirmed ? _submit : null, label: 'Silme talebi gönder', destructive: true),
          ],
        ],
      ),
    );
  }
}
