import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/models/commerce.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';

/// Arkadaşını getir: davet bağlantısıyla gelen arkadaşa ilk siparişinde indirim, size soru kredisi.
class InviteFriendsScreen extends ConsumerWidget {
  const InviteFriendsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(leading: const AppBackButton(fallback: Routes.account), title: const Text('Arkadaşını davet et')),
      body: AsyncBody<InviteInfo>(
        value: ref.watch(inviteProvider),
        onRetry: () => ref.invalidate(inviteProvider),
        builder: (info) {
          final scheme = Theme.of(context).colorScheme;
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            children: [
              if (!info.enabled) ...[
                const NoticeBox(tone: Tone.amber, message: 'Arkadaşını getir kampanyası şu an kapalı.'),
                const SizedBox(height: 12),
              ],
              Row(
                children: [
                  Expanded(child: StatTile(icon: Icons.card_giftcard_rounded, label: 'Arkadaşınıza', value: '%${info.discountPercent}', hint: 'İlk siparişinde, kod gerekmeden')),
                  const SizedBox(width: 10),
                  Expanded(child: StatTile(icon: Icons.toll_rounded, label: 'Size', value: '${info.rewardCredits} kredi', hint: 'Her arkadaşınızın ilk ödemesinde')),
                ],
              ),
              const SizedBox(height: 16),
              SectionCard(
                title: 'Davet kodunuz',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SelectableText(info.code, textAlign: TextAlign.center, style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800, letterSpacing: 4)),
                    const SizedBox(height: 4),
                    Text(info.url, textAlign: TextAlign.center, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      onPressed: () => SharePlus.instance.share(ShareParams(text: info.shareText)),
                      icon: const Icon(Icons.share_rounded),
                      label: const Text('Davet bağlantısını paylaş'),
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: () async {
                        await Clipboard.setData(ClipboardData(text: info.url));
                        if (context.mounted) showSnack(context, 'Bağlantı kopyalandı.');
                      },
                      icon: const Icon(Icons.copy_rounded),
                      label: const Text('Bağlantıyı kopyala'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Arkadaşınız bu bağlantıyla ya da uygulamada kayıt olurken “Davet kodu” alanına kodunuzu yazarak üye olabilir. '
                'Şimdiye kadar ${info.invited} kişi davetinizle üye oldu, ${info.rewarded} kişinin ilk siparişi size kredi kazandırdı.',
                style: TextStyle(color: scheme.onSurfaceVariant, height: 1.45),
              ),
            ],
          );
        },
      ),
    );
  }
}
